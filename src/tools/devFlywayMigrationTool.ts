import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { FW } from '../config/flyway.config.js';
import { registerEnvironmentMigrationTool } from './registerEnvironmentMigrationTool.js';

export function registerDevFlywayMigrationTool(server: McpServer): void {
  registerEnvironmentMigrationTool(server, FW.ENVIRONMENTS.DEV, FW.TOOLS.DEV_MIGRATION);
}
