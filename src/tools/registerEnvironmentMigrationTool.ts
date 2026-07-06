import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { FlywayEnvironment } from '../config/flyway.config.js';
import { formatMigrationSummary, runEnvironmentMigration } from '../services/migrationService.js';
import { toolError, toolText } from '../utils/toolResponse.js';

const projectFilterSchema = z.array(z.string()).optional();

export function registerEnvironmentMigrationTool(
  server: McpServer,
  environment: FlywayEnvironment,
  cfg: { NAME: string; DESCRIPTION: string },
): void {
  server.tool(
    cfg.NAME,
    cfg.DESCRIPTION,
    {
      projects: projectFilterSchema.describe(
        'Optional list of project folder names (e.g. my-service-db). Runs all discovered projects when omitted.',
      ),
    },
    async (args) => {
      try {
        const summary = await runEnvironmentMigration(environment, args.projects);
        return toolText(formatMigrationSummary(summary), summary.failed > 0);
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
