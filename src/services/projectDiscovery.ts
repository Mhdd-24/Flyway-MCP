import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import { FW } from '../config/flyway.config.js';
import { env } from '../env.js';
import type { FlywayProject } from '../interfaces/flyway.js';

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function discoverProjects(): Promise<FlywayProject[]> {
  const root = env.FLYWAY_ROOT;
  if (!root) {
    return [];
  }

  const entries = await readdir(root, { withFileTypes: true });
  const projects: FlywayProject[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const projectPath = path.join(root, entry.name);
    const hasBase = await fileExists(path.join(projectPath, FW.CONFIG_FILES.BASE));
    if (!hasBase) {
      continue;
    }

    const hasQa = await fileExists(path.join(projectPath, FW.CONFIG_FILES.QA));
    const hasDev = await fileExists(path.join(projectPath, FW.CONFIG_FILES.DEV));

    if (!hasQa && !hasDev) {
      continue;
    }

    projects.push({
      name: entry.name,
      path: projectPath,
      hasQa,
      hasDev,
    });
  }

  projects.sort((a, b) => a.name.localeCompare(b.name));

  if (env.FLYWAY_PROJECTS.length > 0) {
    const allowed = new Set(env.FLYWAY_PROJECTS);
    return projects.filter((p) => allowed.has(p.name));
  }

  return projects;
}

export function getConfigFiles(environment: 'qa' | 'dev'): string[] {
  return [FW.CONFIG_FILES.BASE, environment === 'qa' ? FW.CONFIG_FILES.QA : FW.CONFIG_FILES.DEV];
}

export function assertEnvironmentConfig(project: FlywayProject, environment: 'qa' | 'dev'): void {
  if (environment === 'qa' && !project.hasQa) {
    throw new Error(FW.MESSAGES.CONFIG_MISSING(project.name, FW.ENVIRONMENTS.QA));
  }
  if (environment === 'dev' && !project.hasDev) {
    throw new Error(FW.MESSAGES.CONFIG_MISSING(project.name, FW.ENVIRONMENTS.DEV));
  }
}
