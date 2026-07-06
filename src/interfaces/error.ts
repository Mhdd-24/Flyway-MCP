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
