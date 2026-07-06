#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { FW } from './config/flyway.config.js';
import { validateEnv } from './env.js';
import { registerTools } from './tools/index.js';

validateEnv();

const server = new McpServer({
  name: FW.SERVER.NAME,
  version: FW.SERVER.VERSION,
});

registerTools(server);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(FW.SERVER.STARTUP_MESSAGE);
}

main().catch((error) => {
  console.error(FW.SERVER.FATAL_PREFIX, error);
  process.exit(1);
});
