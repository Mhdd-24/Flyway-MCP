import type { FlywayEnvironment } from '../config/flyway.config.js';
import type { RemediationAction } from './error.js';

export interface FlywayRunResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  combined: string;
  success: boolean;
}

export interface ProjectMigrationResult {
  project: string;
  environment: FlywayEnvironment;
  success: boolean;
  attempts: number;
  remediations: RemediationAction[];
  lastOutput: string;
  error?: string;
}

export interface MigrationSummary {
  environment: FlywayEnvironment;
  total: number;
  succeeded: number;
  failed: number;
  results: ProjectMigrationResult[];
}
