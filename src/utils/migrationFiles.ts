import { readdir } from 'node:fs/promises';
import path from 'node:path';

const VERSION_PATTERN = /^V(\d+)__(.+)$/i;

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
