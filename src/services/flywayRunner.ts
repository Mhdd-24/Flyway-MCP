import { spawn } from 'node:child_process';
import { FW } from '../config/flyway.config.js';
import { env } from '../env.js';
import type { FlywayRunResult } from '../interfaces/migration.js';
import { getConfigFiles } from './projectDiscovery.js';

/** Migrations must always execute SQL/JS. Never mark history without running scripts. */
const FORCE_EXECUTE_FLAG = '-skipExecutingMigrations=false';

function flywayArgs(environment: 'qa' | 'dev', subcommand: string): string[] {
  const args = [`-configFiles=${getConfigFiles(environment).join(',')}`, subcommand];
  if (subcommand === FW.COMMANDS.MIGRATE) {
    args.splice(1, 0, FORCE_EXECUTE_FLAG);
  }
  return args;
}

export function assertNoSkipExecute(commandText: string): void {
  if (/skipExecutingMigrations\s*=\s*true/i.test(commandText)) {
    throw new Error(FW.MESSAGES.SKIP_EXECUTE_FORBIDDEN);
  }
}

/** Flyway logs this when -skipExecutingMigrations=true was used. */
export function detectSkipExecuteInOutput(output: string): boolean {
  return /Skipping execution of migration/i.test(output)
    || /skipExecutingMigrations\s*=\s*true/i.test(output);
}

function runProcess(args: string[], cwd: string): Promise<FlywayRunResult> {
  return new Promise((resolve) => {
    const commandText = `${env.FLYWAY_CLI} ${args.join(' ')}`;
    try {
      assertNoSkipExecute(commandText);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      resolve({
        command: commandText,
        exitCode: 1,
        stdout: '',
        stderr: message,
        combined: message,
        success: false,
      });
      return;
    }

    const child = process.platform === 'win32'
      ? spawn(commandText, { cwd, shell: true, env: process.env })
      : spawn(env.FLYWAY_CLI, args, { cwd, env: process.env });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    child.on('close', (code) => {
      const exitCode = code ?? 1;
      resolve({
        command: commandText,
        exitCode,
        stdout,
        stderr,
        combined: `${stdout}\n${stderr}`.trim(),
        success: exitCode === 0,
      });
    });

    child.on('error', (error) => {
      resolve({
        command: commandText,
        exitCode: 1,
        stdout,
        stderr: error.message,
        combined: error.message,
        success: false,
      });
    });
  });
}

export async function runFlyway(projectPath: string, environment: 'qa' | 'dev', subcommand: 'repair' | 'migrate' | 'info'): Promise<FlywayRunResult> {
  return runProcess(flywayArgs(environment, subcommand), projectPath);
}

export async function runRepair(projectPath: string, environment: 'qa' | 'dev'): Promise<FlywayRunResult> {
  return runFlyway(projectPath, environment, FW.COMMANDS.REPAIR as 'repair');
}

export async function runMigrate(projectPath: string, environment: 'qa' | 'dev'): Promise<FlywayRunResult> {
  return runFlyway(projectPath, environment, FW.COMMANDS.MIGRATE as 'migrate');
}
