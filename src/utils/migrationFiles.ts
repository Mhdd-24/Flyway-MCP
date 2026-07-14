import { readdir } from 'node:fs/promises';
import path from 'node:path';

const VERSION_PATTERN = /^V(\d+)__(.+)$/i;

/** Strip Flyway output noise like " (SQL)" / " (JavaScript)" from offender paths. */
export function cleanMigrationPath(rawPath: string): string {
  return rawPath
    .replace(/\s*\((?:SQL|JavaScript|Java|Python|C\#|Groovy)\)\s*$/i, '')
    .replace(/^"+|"+$/g, '')
    .trim();
}

/**
 * Resolve a Flyway-reported migration path against the project folder.
 * Flyway often emits relative paths (e.g. migrations\common\V6__foo.js);
 * Node would otherwise resolve them against the MCP process cwd (user home).
 */
export function resolveMigrationPath(projectPath: string, rawPath: string): string {
  const cleaned = cleanMigrationPath(rawPath);
  if (!cleaned) {
    return cleaned;
  }
  return path.isAbsolute(cleaned) ? path.normalize(cleaned) : path.resolve(projectPath, cleaned);
}

export function parseMigrationVersion(fileName: string): number | null {
  const match = fileName.match(VERSION_PATTERN);
  return match ? Number.parseInt(match[1], 10) : null;
}

export function buildVersionedName(version: number, suffix: string): string {
  return `V${version}__${suffix}`;
}

export async function listMigrationFiles(projectPath: string): Promise<string[]> {
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

export async function nextAvailableVersion(projectPath: string): Promise<number> {
  const files = await listMigrationFiles(projectPath);
  const versions = files.map((f) => parseMigrationVersion(path.basename(f))).filter((v): v is number => v !== null);
  return versions.length > 0 ? Math.max(...versions) + 1 : 1;
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
