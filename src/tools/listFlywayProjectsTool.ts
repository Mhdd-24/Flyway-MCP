import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { FW } from '../config/flyway.config.js';
import { discoverProjects } from '../services/projectDiscovery.js';
import { toolError, toolText } from '../utils/toolResponse.js';

export function registerListFlywayProjectsTool(server: McpServer): void {
  const cfg = FW.TOOLS.LIST_PROJECTS;
  server.tool(cfg.NAME, cfg.DESCRIPTION, {}, async () => {
    try {
      const projects = await discoverProjects();
      if (projects.length === 0) { return toolText(FW.MESSAGES.NO_PROJECTS, true); }

      const lines = projects.map(
        (p) => `- ${p.name} (QA: ${p.hasQa ? 'yes' : 'no'}, Dev: ${p.hasDev ? 'yes' : 'no'}) → ${p.path}`,
      );

      return toolText(`Flyway projects under FLYWAY_ROOT:\n\n${lines.join('\n')}`);
    } catch (error) {
      return toolError(error);
    }
  });
}
