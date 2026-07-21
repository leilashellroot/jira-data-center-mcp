export type MCPTransport = "stdio" | "sse" | "streamable-http";

export interface JiraMCPConfig {
  baseUrl: string;
  token: string;
  transport: MCPTransport;
  host: string;
  port: number;
  httpPath: string;
  ssePath: string;
  messagesPath: string;
  allowedHosts: string[];
  allowedOrigins: string[];
  corsOrigin?: string;
}

export function loadConfig(): JiraMCPConfig {
  const baseUrl = process.env.JIRA_BASE_URL;
  const token = process.env.JIRA_PAT;

  if (!baseUrl) {
    throw new Error("JIRA_BASE_URL environment variable is required");
  }
  if (!token) {
    throw new Error("JIRA_PAT environment variable is required");
  }

  const transport = process.env.MCP_TRANSPORT ?? "stdio";
  if (transport !== "stdio" && transport !== "sse" && transport !== "streamable-http") {
    throw new Error("MCP_TRANSPORT must be one of: stdio, sse, streamable-http");
  }

  const port = Number.parseInt(process.env.MCP_PORT ?? "3000", 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("MCP_PORT must be an integer between 1 and 65535");
  }

  const normalizePath = (value: string): string => {
    const path = value.trim();
    return path.startsWith("/") ? path : `/${path}`;
  };

  const splitList = (value?: string): string[] =>
    value
      ?.split(",")
      .map((item) => item.trim())
      .filter(Boolean) ?? [];

  return {
    baseUrl,
    token,
    transport,
    host: process.env.MCP_HOST ?? "127.0.0.1",
    port,
    httpPath: normalizePath(process.env.MCP_HTTP_PATH ?? "/mcp"),
    ssePath: normalizePath(process.env.MCP_SSE_PATH ?? "/sse"),
    messagesPath: normalizePath(process.env.MCP_MESSAGES_PATH ?? "/messages"),
    allowedHosts: splitList(process.env.MCP_ALLOWED_HOSTS),
    allowedOrigins: splitList(process.env.MCP_ALLOWED_ORIGINS),
    corsOrigin: process.env.MCP_CORS_ORIGIN,
  };
}
