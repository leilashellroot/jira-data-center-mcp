import assert from "node:assert/strict";
import test from "node:test";

const configKeys = [
  "JIRA_BASE_URL",
  "JIRA_PAT",
  "JIRA_HOST",
  "JIRA_API_BASE_PATH",
  "JIRA_API_TOKEN",
  "JIRA_DEFAULT_PAGE_SIZE",
  "ATLASSIAN_DC_MCP_REQUEST_TIMEOUT_MS",
];
const original = Object.fromEntries(configKeys.map((key) => [key, process.env[key]]));

const { loadConfig, normalizeBaseUrl } = await import("../dist/config.js");

test("supports upstream-compatible host and token configuration", () => {
  try {
    for (const key of configKeys) delete process.env[key];
    process.env.JIRA_HOST = "jira.example.com";
    process.env.JIRA_API_TOKEN = "test-token";
    process.env.JIRA_DEFAULT_PAGE_SIZE = "17";
    process.env.ATLASSIAN_DC_MCP_REQUEST_TIMEOUT_MS = "45000";

    const config = loadConfig();
    assert.equal(config.baseUrl, "https://jira.example.com");
    assert.equal(config.token, "test-token");
    assert.equal(config.defaultPageSize, 17);
    assert.equal(config.requestTimeoutMs, 45000);
  } finally {
    for (const key of configKeys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
});

test("normalizes API base paths without duplicating Jira REST suffixes", () => {
  assert.equal(normalizeBaseUrl("jira.example.com", "/rest"), "https://jira.example.com");
  assert.equal(normalizeBaseUrl(undefined, "https://jira.example.com/rest/api/2"), "https://jira.example.com");
  assert.equal(normalizeBaseUrl("jira.example.com", "/jira/rest"), "https://jira.example.com/jira");
});
