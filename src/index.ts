#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools.js";
import { loadConfig } from "./config.js";

function main() {
  const config = loadConfig();

  const server = new McpServer(
    {
      name: "jira",
      version: "1.0.0",
    },
    { capabilities: { tools: {} } }
  );

  registerTools(server);

  const transport = new StdioServerTransport();
  server.connect(transport).catch((err) => {
    console.error("Failed to connect transport:", err);
    process.exit(1);
  });

  console.error(`Jira Data Center MCP running (${config.baseUrl})`);
}

main();
