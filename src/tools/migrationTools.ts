import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { FW } from '../config/flyway.config.js';
import { discoverProjects } from '../services/projectDiscovery.js';

export function registerListProjectsTool(server: McpServer): void {
  const cfg = FW.TOOLS.LIST_PROJECTS;
  server.tool(cfg.NAME, cfg.DESCRIPTION, {}, async () => {
    try {
      const projects = await discoverProjects();
      if (projects.length === 0) {
        return {
          isError: true,
          content: [{ type: 'text', text: FW.MESSAGES.NO_PROJECTS }],
        };
      }

      const lines = projects.map(
        (p) => `- ${p.name} (QA: ${p.hasQa ? 'yes' : 'no'}, Dev: ${p.hasDev ? 'yes' : 'no'}) → ${p.path}`,
      );

      return {
        content: [{ type: 'text', text: `Flyway projects under FLYWAY_ROOT:\n\n${lines.join('\n')}` }],
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: error instanceof Error ? error.message : String(error),
        }],
      };
    }
  });
}

const projectFilterSchema = z.array(z.string()).optional();

function registerMigrationTool(
  server: McpServer,
  environment: 'qa' | 'dev',
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
      const { formatMigrationSummary, runEnvironmentMigration } = await import('../services/migrationService.js');

      try {
        const summary = await runEnvironmentMigration(environment, args.projects);
        const text = formatMigrationSummary(summary);
        const ok = summary.failed === 0;

        return {
          isError: !ok,
          content: [{ type: 'text', text }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{
            type: 'text',
            text: error instanceof Error ? error.message : String(error),
          }],
        };
      }
    },
  );
}

export function registerQaMigrationTool(server: McpServer): void {
  registerMigrationTool(server, FW.ENVIRONMENTS.QA, FW.TOOLS.QA_MIGRATION);
}

export function registerDevMigrationTool(server: McpServer): void {
  registerMigrationTool(server, FW.ENVIRONMENTS.DEV, FW.TOOLS.DEV_MIGRATION);
}
