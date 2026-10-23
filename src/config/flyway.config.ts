export const FW = {
  SERVER: {
    NAME: '@mhdd_24/flyway-mcp',
    VERSION: '1.0.4',
    STARTUP_MESSAGE: 'Flyway MCP Server Started',
    FATAL_PREFIX: 'Fatal error:',
  },
  ENV: {
    ROOT_KEYS: ['FLYWAY_ROOT', 'flywayRoot'] as const,
    CLI_KEYS: ['FLYWAY_CLI', 'flywayCli'] as const,
    PROJECTS_KEYS: ['FLYWAY_PROJECTS', 'flywayProjects'] as const,
    MAX_RETRIES_KEYS: ['FLYWAY_MAX_RETRIES', 'flywayMaxRetries'] as const,
  },
  ENVIRONMENTS: {
    QA: 'qa',
    DEV: 'dev',
  } as const,
  CONFIG_FILES: {
    BASE: 'flyway.toml',
    QA: 'flyway_qa.toml',
    DEV: 'flyway_dev.toml',
  },
  COMMANDS: {
    REPAIR: 'repair',
    MIGRATE: 'migrate',
    INFO: 'info',
  },
  LIMITS: {
    OUTPUT_SLICE: 12000,
    MAX_RETRIES_DEFAULT: 3,
  },
  MESSAGES: {
    ROOT_MISSING: 'FLYWAY_ROOT is not set. Point it to your Flyway projects folder (e.g. /path/to/flyway-projects).',
    NO_PROJECTS: 'No Flyway projects found under FLYWAY_ROOT.',
    CONFIG_MISSING: (project: string, env: string) =>
      `Missing flyway_${env}.toml in ${project}`,
    CLI_FAILED: 'Flyway CLI failed',
    SKIP_EXECUTE_FORBIDDEN:
      'skipExecutingMigrations=true is forbidden. Migrations must execute scripts so schema/data are applied. ' +
      'Fix failing SQL to be idempotent (IF NOT EXISTS / WHERE NOT EXISTS), then re-run migrate — do not mark history without execute.',
    SKIP_EXECUTE_DETECTED:
      'Flyway reported skipped migration execution. Aborting so history is not left with execution_time=0 and missing data. ' +
      'Re-run without skipExecutingMigrations; make scripts idempotent if objects already exist.',
    REMEDIATION_APPLIED: 'Remediation applied',
    REMEDIATION_NONE: 'No automatic remediation available for this error',
  },
  TOOLS: {
    QA_MIGRATION: {
      NAME: 'qa_flyway_migration',
      DESCRIPTION:
        'QA Flyway Migration: run flyway repair and migrate for all configured projects against the QA environment. ' +
        'Use when the user says "QA Flyway Migration". Always executes migration scripts (never skipExecutingMigrations). ' +
        'Automatically fixes duplicate versions, checksum mismatches, ' +
        'Flyway placeholder errors in JS migrations, and missing-table failures where possible.',
    },
    DEV_MIGRATION: {
      NAME: 'dev_flyway_migration',
      DESCRIPTION:
        'Dev Flyway Migration: run flyway repair and migrate for all configured projects against the Development environment. ' +
        'Use when the user says "Dev Flyway Migration". Always executes migration scripts (never skipExecutingMigrations). ' +
        'Automatically fixes duplicate versions, checksum mismatches, ' +
        'Flyway placeholder errors in JS migrations, and missing-table failures where possible.',
    },
    LIST_PROJECTS: {
      NAME: 'list_flyway_projects',
      DESCRIPTION: 'List Flyway projects discovered under FLYWAY_ROOT with QA/Dev config availability.',
    },
  },
} as const;

export type FlywayEnvironment = typeof FW.ENVIRONMENTS.QA | typeof FW.ENVIRONMENTS.DEV;
