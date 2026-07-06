import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { registerListProjectsTool, registerDevMigrationTool, registerQaMigrationTool } from './migrationTools.js';

export function registerTools(server: McpServer): void {
  registerListProjectsTool(server);
  registerQaMigrationTool(server);
  registerDevMigrationTool(server);
}
