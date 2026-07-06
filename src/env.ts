import dotenv from 'dotenv';
import { FW } from './config/flyway.config.js';

dotenv.config();

function readEnv(keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key];
    if (value?.trim()) { return value.trim(); }
  }
  return undefined;
}

function readInt(keys: readonly string[], fallback: number): number {
  const raw = readEnv(keys);
  if (!raw) { return fallback; }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const env = {
  FLYWAY_ROOT: readEnv(FW.ENV.ROOT_KEYS) ?? '',
  FLYWAY_CLI: readEnv(FW.ENV.CLI_KEYS) ?? 'flyway',
  FLYWAY_PROJECTS: readEnv(FW.ENV.PROJECTS_KEYS)?.split(',').map((p) => p.trim()).filter(Boolean) ?? [],
  FLYWAY_MAX_RETRIES: readInt(FW.ENV.MAX_RETRIES_KEYS, FW.LIMITS.MAX_RETRIES_DEFAULT),
};

export function validateEnv(): void {
  if (!env.FLYWAY_ROOT) { console.error(FW.MESSAGES.ROOT_MISSING); }
}
