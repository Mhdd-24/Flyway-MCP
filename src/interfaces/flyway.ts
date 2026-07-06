import type { FlywayEnvironment } from '../config/flyway.config.js';

export interface FlywayProject {
  name: string;
  path: string;
  hasQa: boolean;
  hasDev: boolean;
}

export interface FlywayRunResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  combined: string;
  success: boolean;
}

export type FlywayErrorKind =
  | 'duplicate_version'
  | 'checksum_mismatch'
  | 'missing_relation'
  | 'placeholder'
  | 'failed_migration'
  | 'unknown';

export interface FlywayError {
  kind: FlywayErrorKind;
  message: string;
  version?: number;
  offenders?: string[];
  relation?: string;
  placeholder?: string;
  migrationFile?: string;
  line?: number;
}

export interface RemediationAction {
  description: string;
  filesChanged: string[];
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
