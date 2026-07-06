import { readdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { FlywayError, RemediationAction } from '../interfaces/flyway.js';

const VERSION_PATTERN = /^V(\d+)__(.+)$/i;

async function listMigrationFiles(projectPath: string): Promise<string[]> {
  const migrationsRoot = path.join(projectPath, 'migrations');
  const results: string[] = [];

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (VERSION_PATTERN.test(entry.name)) {
        results.push(full);
      }
    }
  }

  await walk(migrationsRoot);
  return results;
}

function parseVersion(fileName: string): number | null {
  const match = fileName.match(VERSION_PATTERN);
  return match ? Number.parseInt(match[1], 10) : null;
}

function buildVersionedName(version: number, suffix: string): string {
  return `V${version}__${suffix}`;
}

async function nextAvailableVersion(projectPath: string): Promise<number> {
  const files = await listMigrationFiles(projectPath);
  const versions = files
    .map((f) => parseVersion(path.basename(f)))
    .filter((v): v is number => v !== null);
  return versions.length > 0 ? Math.max(...versions) + 1 : 1;
}

export async function fixDuplicateVersions(
  projectPath: string,
  error: FlywayError,
): Promise<RemediationAction | null> {
  const version = error.version;
  if (!version) {
    return null;
  }

  const offenders = error.offenders?.length
    ? error.offenders
    : (await listMigrationFiles(projectPath)).filter((f) => parseVersion(path.basename(f)) === version);

  if (offenders.length < 2) {
    return null;
  }

  const sorted = [...offenders].sort((a, b) => a.localeCompare(b));
  const keep = sorted[0];
  const toRename = sorted.slice(1);
  const filesChanged: string[] = [];
  let nextVersion = await nextAvailableVersion(projectPath);

  for (const filePath of toRename) {
    const base = path.basename(filePath);
    const match = base.match(VERSION_PATTERN);
    if (!match) {
      continue;
    }
    const suffix = match[2];
    const newName = buildVersionedName(nextVersion, suffix);
    const newPath = path.join(path.dirname(filePath), newName);
    await rename(filePath, newPath);
    filesChanged.push(`${base} → ${newName}`);
    nextVersion += 1;
  }

  if (filesChanged.length === 0) {
    return null;
  }

  return {
    description: `Resolved duplicate V${version}: kept ${path.basename(keep)}, renamed ${filesChanged.length} file(s)`,
    filesChanged,
  };
}

export async function fixPlaceholderInJs(
  projectPath: string,
  error: FlywayError,
): Promise<RemediationAction | null> {
  const placeholder = error.placeholder;
  if (!placeholder) {
    return null;
  }

  let targetFile = error.migrationFile;
  if (targetFile && !path.isAbsolute(targetFile)) {
    targetFile = path.join(projectPath, targetFile);
  }

  const candidates = targetFile
    ? [targetFile]
    : (await listMigrationFiles(projectPath)).filter((f) => f.endsWith('.js'));

  for (const filePath of candidates) {
    let content: string;
    try {
      content = await readFile(filePath, 'utf8');
    } catch {
      continue;
    }

    const token = `\${${placeholder}}`;
    if (!content.includes(token)) {
      continue;
    }

    let updated = content;

    if (placeholder === 'dbName') {
      updated = updated
        .replace(/\$\{dbName\}/g, 'db')
        .replace(/const\s+dbName\s*=\s*db\s*;?\s*\n?/g, '')
        .replace(/let\s+dbName\s*=\s*db\s*;?\s*\n?/g, '');
    } else {
      updated = updated.replaceAll(token, '');
    }

    if (updated === content) {
      continue;
    }

    await writeFile(filePath, updated, 'utf8');
    return {
      description: `Removed Flyway placeholder \${${placeholder}} from ${path.basename(filePath)}`,
      filesChanged: [filePath],
    };
  }

  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function fixMissingRelation(
  projectPath: string,
  error: FlywayError,
): Promise<RemediationAction | null> {
  const relation = error.relation;
  if (!relation) {
    return null;
  }

  let targetFile = error.migrationFile;
  if (targetFile && !path.isAbsolute(targetFile)) {
    targetFile = path.join(projectPath, targetFile);
  }

  if (!targetFile) {
    const sqlFiles = (await listMigrationFiles(projectPath)).filter((f) => f.endsWith('.sql'));
    for (const file of sqlFiles) {
      const content = await readFile(file, 'utf8');
      if (content.includes(relation)) {
        targetFile = file;
        break;
      }
    }
  }

  if (!targetFile) {
    return null;
  }

  const content = await readFile(targetFile, 'utf8');
  const [schema, table] = relation.includes('.') ? relation.split('.') : ['public', relation];
  const commentPattern = new RegExp(
    `--\\s*${escapeRegExp(schema)}\\.${escapeRegExp(table)}[\\s\\S]*?(?=\\n--\\s*\\w|$)`,
    'i',
  );

  const blockMatch = content.match(commentPattern);
  if (!blockMatch) {
    return null;
  }

  const block = blockMatch[0];
  if (block.includes('to_regclass') || block.includes('fn_add_parent_tenant_id')) {
    return null;
  }

  const wrapped = `-- ${schema}.${table} (conditional: skip if table missing)
DO $$
BEGIN
  IF to_regclass('${schema}.${table}') IS NOT NULL THEN
${block
  .split('\n')
  .slice(1)
  .map((line) => `    ${line}`)
  .join('\n')
  .replace(/\n\s*$/g, '\n')}
  END IF;
END $$;
`;

  const updated = content.replace(block, wrapped);
  if (updated === content) {
    return null;
  }

  await writeFile(targetFile, updated, 'utf8');
  return {
    description: `Wrapped ${relation} migration block in conditional EXISTS check in ${path.basename(targetFile)}`,
    filesChanged: [targetFile],
  };
}

export async function applyRemediation(
  projectPath: string,
  error: FlywayError,
): Promise<RemediationAction | null> {
  switch (error.kind) {
    case 'duplicate_version':
      return fixDuplicateVersions(projectPath, error);
    case 'placeholder':
      return fixPlaceholderInJs(projectPath, error);
    case 'missing_relation':
      return fixMissingRelation(projectPath, error);
    case 'checksum_mismatch':
    case 'failed_migration':
      return {
        description: 'Checksum/failed migration — flyway repair will be retried',
        filesChanged: [],
      };
    default:
      return null;
  }
}
