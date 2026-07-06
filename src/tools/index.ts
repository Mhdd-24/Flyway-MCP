import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerDevFlywayMigrationTool } from './devFlywayMigrationTool.js';
import { registerListFlywayProjectsTool } from './listFlywayProjectsTool.js';
import { registerQaFlywayMigrationTool } from './qaFlywayMigrationTool.js';

export function registerTools(server: McpServer): void {
  registerListFlywayProjectsTool(server);
  registerQaFlywayMigrationTool(server);
  registerDevFlywayMigrationTool(server);
}
