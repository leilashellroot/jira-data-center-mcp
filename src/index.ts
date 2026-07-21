#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools.js";
import { loadConfig } from "./config.js";
import { startRemoteServer } from "./remote.js";
import { runSetup } from "./setup.js";

async function main() {
  if (process.argv[2] === "setup") {
    await runSetup(process.argv.slice(3));
    return;
  }

  const config = loadConfig();

  if (config.transport !== "stdio") {
    await startRemoteServer(config);
    const endpoint = config.transport === "sse" ? config.ssePath : config.httpPath;
    console.error(`Jira Data Center MCP ${config.transport} server listening at http://${config.host}:${config.port}${endpoint}`);
    return;
  }

  const server = new McpServer(
    {
      name: "jira",
      version: "1.0.0",
    },
    { capabilities: { tools: {} } }
  );

  registerTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`Jira Data Center MCP running (${config.baseUrl})`);
}

main().catch((err) => {
  console.error("Failed to start MCP server:", err);
  process.exit(1);
});
