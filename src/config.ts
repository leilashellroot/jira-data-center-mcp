import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";

export type MCPTransport = "stdio" | "sse" | "streamable-http";

export interface JiraMCPConfig {
  baseUrl: string;
  token: string;
  defaultPageSize: number;
  requestTimeoutMs: number;
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

export interface StoredConfigValues {
  baseUrl?: string;
  token?: string;
  defaultPageSize: number;
  requestTimeoutMs: number;
}

const DEFAULT_PAGE_SIZE = 25;
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const HOME_CONFIG_PATH = join(homedir(), ".atlassian-dc-mcp", "jira.env");

type RawValues = {
  host?: string;
  apiBasePath?: string;
  token?: string;
  defaultPageSize?: string;
  requestTimeoutMs?: string;
};

function parseEnvFile(contents: string): Record<string, string> {
  const values: Record<string, string> = {};

  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;

    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }

  return values;
}

function readEnvFile(path: string, required: boolean): Record<string, string> {
  if (!existsSync(path)) {
    if (required) throw new Error(`Configuration file does not exist: ${path}`);
    return {};
  }
  return parseEnvFile(readFileSync(path, "utf8"));
}

function readKeychainToken(): string | undefined {
  if (process.platform !== "darwin") return undefined;

  try {
    return execFileSync("/usr/bin/security", [
      "find-generic-password",
      "-s",
      "atlassian-dc-mcp",
      "-a",
      "jira-token",
      "-w",
    ], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || undefined;
  } catch {
    return undefined;
  }
}

function sourceValues(): RawValues[] {
  const configuredFile = process.env.ATLASSIAN_DC_MCP_CONFIG_FILE;
  if (configuredFile && !isAbsolute(configuredFile)) {
    throw new Error("ATLASSIAN_DC_MCP_CONFIG_FILE must be an absolute path");
  }
  const fileValues = configuredFile
    ? readEnvFile(configuredFile, true)
    : existsSync(join(process.cwd(), ".env"))
      ? readEnvFile(join(process.cwd(), ".env"), false)
      : {};
  const homeValues = readEnvFile(HOME_CONFIG_PATH, false);

  return [
    {
      host: process.env.JIRA_HOST,
      apiBasePath: process.env.JIRA_BASE_URL ?? process.env.JIRA_API_BASE_PATH,
      token: process.env.JIRA_PAT ?? process.env.JIRA_API_TOKEN,
      defaultPageSize: process.env.JIRA_DEFAULT_PAGE_SIZE,
      requestTimeoutMs: process.env.ATLASSIAN_DC_MCP_REQUEST_TIMEOUT_MS,
    },
    {
      host: fileValues.JIRA_HOST,
      apiBasePath: fileValues.JIRA_BASE_URL ?? fileValues.JIRA_API_BASE_PATH,
      token: fileValues.JIRA_PAT ?? fileValues.JIRA_API_TOKEN,
      defaultPageSize: fileValues.JIRA_DEFAULT_PAGE_SIZE,
      requestTimeoutMs: fileValues.ATLASSIAN_DC_MCP_REQUEST_TIMEOUT_MS,
    },
    {
      host: homeValues.JIRA_HOST,
      apiBasePath: homeValues.JIRA_BASE_URL ?? homeValues.JIRA_API_BASE_PATH,
      token: homeValues.JIRA_PAT ?? homeValues.JIRA_API_TOKEN,
      defaultPageSize: homeValues.JIRA_DEFAULT_PAGE_SIZE,
      requestTimeoutMs: homeValues.ATLASSIAN_DC_MCP_REQUEST_TIMEOUT_MS,
    },
    { token: readKeychainToken() },
  ];
}

function firstDefined<T>(values: Array<T | undefined>): T | undefined {
  return values.find((value) => value !== undefined && String(value).trim() !== "");
}

function parsePositiveInteger(value: string | undefined, fallback: number, label: string): number {
  if (value === undefined || value.trim() === "") return fallback;
  const normalized = value.trim();
  const parsed = Number.parseInt(normalized, 10);
  if (!/^\d+$/.test(normalized) || !Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}

export function normalizeBaseUrl(host: string | undefined, apiBasePath: string | undefined): string | undefined {
  const configured = apiBasePath ?? host;
  if (!configured) return undefined;

  if (!/^https?:\/\//i.test(configured) && configured.startsWith("/")) {
    if (!host) return undefined;
    const hostUrl = new URL(/^https?:\/\//i.test(host) ? host : `https://${host}`);
    let hostPath = configured.replace(/\/+$/, "");
    hostPath = hostPath.replace(/\/rest\/api\/2$/i, "").replace(/\/rest$/i, "");
    return `${hostUrl.origin}${hostPath}`;
  }

  const hasScheme = /^https?:\/\//i.test(configured);
  const base = hasScheme ? configured : `https://${configured}`;
  const url = new URL(base);
  let pathname = url.pathname.replace(/\/+$/, "");
  pathname = pathname.replace(/\/rest\/api\/2$/i, "").replace(/\/rest$/i, "");
  return `${url.origin}${pathname}`;
}

export function readConfigValues(): StoredConfigValues {
  const sources = sourceValues();
  const baseSource = sources.find((source) => source.apiBasePath || source.host);
  const host = baseSource?.host;
  const apiBasePath = baseSource?.apiBasePath;
  const token = firstDefined(sources.map((source) => source.token));
  const defaultPageSize = firstDefined(sources.map((source) => source.defaultPageSize));
  const requestTimeoutMs = firstDefined(sources.map((source) => source.requestTimeoutMs));

  return {
    baseUrl: normalizeBaseUrl(host, apiBasePath),
    token,
    defaultPageSize: parsePositiveInteger(defaultPageSize, DEFAULT_PAGE_SIZE, "JIRA_DEFAULT_PAGE_SIZE"),
    requestTimeoutMs: parsePositiveInteger(
      requestTimeoutMs,
      DEFAULT_REQUEST_TIMEOUT_MS,
      "ATLASSIAN_DC_MCP_REQUEST_TIMEOUT_MS",
    ),
  };
}

export function loadConfig(): JiraMCPConfig {
  const values = readConfigValues();
  const baseUrl = values.baseUrl;
  const token = values.token;

  if (!baseUrl) {
    throw new Error("JIRA_BASE_URL, JIRA_HOST, or JIRA_API_BASE_PATH is required");
  }
  if (!token) {
    throw new Error("JIRA_PAT or JIRA_API_TOKEN is required");
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
    defaultPageSize: values.defaultPageSize,
    requestTimeoutMs: values.requestTimeoutMs,
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

export function getHomeConfigPath(): string {
  return HOME_CONFIG_PATH;
}

export function writeKeychainToken(token: string): boolean {
  if (process.platform !== "darwin") return false;

  try {
    execFileSync("/usr/bin/security", [
      "add-generic-password",
      "-U",
      "-s",
      "atlassian-dc-mcp",
      "-a",
      "jira-token",
      "-w",
      token,
    ], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function quoteEnvValue(value: string): string {
  return JSON.stringify(value);
}

export function writeHomeConfig(values: { baseUrl: string; token?: string; defaultPageSize: number }, options?: { clearToken?: boolean }): void {
  const directory = dirname(HOME_CONFIG_PATH);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const existing = existsSync(HOME_CONFIG_PATH) ? readFileSync(HOME_CONFIG_PATH, "utf8") : "";
  const updates: Record<string, string> = {
    JIRA_API_BASE_PATH: values.baseUrl,
    JIRA_DEFAULT_PAGE_SIZE: String(values.defaultPageSize),
  };
  if (values.token !== undefined) updates.JIRA_API_TOKEN = values.token;
  const seen = new Set<string>();
  const lines = existing.split(/\r?\n/).filter((line) => line.length > 0).map((line) => {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (!match) return line;
    if (match[1] === "JIRA_API_TOKEN" && options?.clearToken) return "";
    if (updates[match[1]] === undefined) return line;
    seen.add(match[1]);
    return `${match[1]}=${quoteEnvValue(updates[match[1]])}`;
  });

  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) lines.push(`${key}=${quoteEnvValue(value)}`);
  }

  writeFileSync(HOME_CONFIG_PATH, `${lines.join("\n")}\n`, { mode: 0o600 });
  chmodSync(HOME_CONFIG_PATH, 0o600);
}
