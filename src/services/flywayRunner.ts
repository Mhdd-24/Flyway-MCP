import { spawn } from 'node:child_process';
import { FW } from '../config/flyway.config.js';
import { env } from '../env.js';
import type { FlywayRunResult } from '../interfaces/migration.js';
import { getConfigFiles } from './projectDiscovery.js';

function flywayArgs(environment: 'qa' | 'dev', subcommand: string): string[] {
  return [`-configFiles=${getConfigFiles(environment).join(',')}`, subcommand];
}

function runProcess(args: string[], cwd: string): Promise<FlywayRunResult> {
  return new Promise((resolve) => {
    const commandText = `${env.FLYWAY_CLI} ${args.join(' ')}`;
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
