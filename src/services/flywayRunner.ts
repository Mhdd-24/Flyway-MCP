import { spawn } from 'node:child_process';

import { FW } from '../config/flyway.config.js';
import { env } from '../env.js';
import type { FlywayRunResult } from '../interfaces/flyway.js';
import { getConfigFiles } from './projectDiscovery.js';

function runProcess(command: string, args: string[], cwd: string): Promise<FlywayRunResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      shell: process.platform === 'win32',
      env: process.env,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on('close', (code) => {
      const exitCode = code ?? 1;
      const combined = `${stdout}\n${stderr}`.trim();
      resolve({
        command: [command, ...args].join(' '),
        exitCode,
        stdout,
        stderr,
        combined,
        success: exitCode === 0,
      });
    });
    child.on('error', (error) => {
      const message = error.message;
      resolve({
        command: [command, ...args].join(' '),
        exitCode: 1,
        stdout,
        stderr: message,
        combined: message,
        success: false,
      });
    });
  });
}

function configArgs(environment: 'qa' | 'dev'): string[] {
  const files = getConfigFiles(environment);
  return ['-configFiles', files.join(',')];
}

export async function runFlyway(projectPath: string, environment: 'qa' | 'dev', subcommand: 'repair' | 'migrate' | 'info'): Promise<FlywayRunResult> {
  const args = [...configArgs(environment), subcommand];
  return runProcess(env.FLYWAY_CLI, args, projectPath);
}

export async function runRepair(projectPath: string, environment: 'qa' | 'dev'): Promise<FlywayRunResult> {
  return runFlyway(projectPath, environment, FW.COMMANDS.REPAIR as 'repair');
}

export async function runMigrate(projectPath: string, environment: 'qa' | 'dev'): Promise<FlywayRunResult> {
  return runFlyway(projectPath, environment, FW.COMMANDS.MIGRATE as 'migrate');
}