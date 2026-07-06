import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { FW } from '../config/flyway.config.js';
import { registerEnvironmentMigrationTool } from './registerEnvironmentMigrationTool.js';

export function registerQaFlywayMigrationTool(server: McpServer): void {
  registerEnvironmentMigrationTool(server, FW.ENVIRONMENTS.QA, FW.TOOLS.QA_MIGRATION);
}
