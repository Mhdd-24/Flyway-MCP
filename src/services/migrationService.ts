import { FW } from '../config/flyway.config.js';
import { env } from '../env.js';
import type { FlywayEnvironment } from '../config/flyway.config.js';
import type {
  MigrationSummary,
  ProjectMigrationResult,
  RemediationAction,
} from '../interfaces/flyway.js';
import { analyzeFlywayOutput, primaryError } from './errorAnalyzer.js';
import { applyRemediation } from './errorRemediator.js';
import { runMigrate, runRepair } from './flywayRunner.js';
import { assertEnvironmentConfig, discoverProjects } from './projectDiscovery.js';
import type { FlywayProject } from '../interfaces/flyway.js';

async function migrateProject(
  project: FlywayProject,
  environment: FlywayEnvironment,
): Promise<ProjectMigrationResult> {
  assertEnvironmentConfig(project, environment);

  const remediations: RemediationAction[] = [];
  let lastOutput = '';
  let attempts = 0;
  const maxRetries = env.FLYWAY_MAX_RETRIES;

  while (attempts < maxRetries) {
    attempts += 1;

    const repairResult = await runRepair(project.path, environment);
    lastOutput = repairResult.combined;

    const migrateResult = await runMigrate(project.path, environment);
    lastOutput = migrateResult.combined;

    if (migrateResult.success) {
      return {
        project: project.name,
        environment,
        success: true,
        attempts,
        remediations,
        lastOutput: sliceOutput(lastOutput),
      };
    }

    const errors = analyzeFlywayOutput(migrateResult.combined);
    const error = primaryError(errors);

    if (!error) {
      break;
    }

    const remediation = await applyRemediation(project.path, error);
    if (remediation) {
      remediations.push(remediation);
      if (remediation.filesChanged.length > 0 || error.kind === 'checksum_mismatch' || error.kind === 'failed_migration') {
        continue;
      }
    }

    if (error.kind === 'checksum_mismatch' || error.kind === 'failed_migration') {
      continue;
    }

    return {
      project: project.name,
      environment,
      success: false,
      attempts,
      remediations,
      lastOutput: sliceOutput(lastOutput),
      error: error.message,
    };
  }

  return {
    project: project.name,
    environment,
    success: false,
    attempts,
    remediations,
    lastOutput: sliceOutput(lastOutput),
    error: FW.MESSAGES.CLI_FAILED,
  };
}

function sliceOutput(output: string): string {
  if (output.length <= FW.LIMITS.OUTPUT_SLICE) {
    return output;
  }
  return `${output.slice(0, FW.LIMITS.OUTPUT_SLICE)}\n... (truncated)`;
}

export async function runEnvironmentMigration(
  environment: FlywayEnvironment,
  projectFilter?: string[],
): Promise<MigrationSummary> {
  let projects = await discoverProjects();

  if (projectFilter?.length) {
    const allowed = new Set(projectFilter);
    projects = projects.filter((p) => allowed.has(p.name));
  }

  if (projects.length === 0) {
    throw new Error(FW.MESSAGES.NO_PROJECTS);
  }

  const results: ProjectMigrationResult[] = [];

  for (const project of projects) {
    try {
      const result = await migrateProject(project, environment);
      results.push(result);
    } catch (error) {
      results.push({
        project: project.name,
        environment,
        success: false,
        attempts: 0,
        remediations: [],
        lastOutput: '',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const succeeded = results.filter((r) => r.success).length;

  return {
    environment,
    total: results.length,
    succeeded,
    failed: results.length - succeeded,
    results,
  };
}

export function formatMigrationSummary(summary: MigrationSummary): string {
  const lines: string[] = [
    `# Flyway ${summary.environment.toUpperCase()} Migration Summary`,
    '',
    `Projects: ${summary.succeeded}/${summary.total} succeeded`,
    '',
  ];

  for (const result of summary.results) {
    const status = result.success ? 'SUCCESS' : 'FAILED';
    lines.push(`## ${result.project} — ${status}`);
    lines.push(`Attempts: ${result.attempts}`);

    if (result.remediations.length > 0) {
      lines.push('Remediations:');
      for (const r of result.remediations) {
        lines.push(`- ${r.description}`);
        for (const f of r.filesChanged) {
          lines.push(`  - ${f}`);
        }
      }
    }

    if (result.error) {
      lines.push(`Error: ${result.error}`);
    }

    lines.push('');
    lines.push('```');
    lines.push(result.lastOutput || '(no output)');
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}
