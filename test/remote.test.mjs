import assert from "node:assert/strict";
import test from "node:test";

process.env.JIRA_BASE_URL = "http://jira.invalid";
process.env.JIRA_PAT = "test-token";

const { startRemoteServer } = await import("../dist/remote.js");

function config(transport) {
  return {
    baseUrl: process.env.JIRA_BASE_URL,
    token: process.env.JIRA_PAT,
    transport,
    host: "127.0.0.1",
    port: 0,
    httpPath: "/mcp",
    ssePath: "/sse",
    messagesPath: "/messages",
    allowedHosts: [],
    allowedOrigins: [],
  };
}

function serverUrl(server) {
  const address = server.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, "object");
  return `http://127.0.0.1:${address.port}`;
}

async function closeServer(server) {
  if (!server.listening) return;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function initializeRequest() {
  return {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "test-client", version: "1.0.0" },
    },
  };
}

const streamableHeaders = {
  Accept: "application/json, text/event-stream",
  "Content-Type": "application/json",
};

test("Streamable HTTP initializes and routes requests by session", async () => {
  const server = await startRemoteServer(config("streamable-http"));
  const baseUrl = serverUrl(server);

  try {
    const initializeResponse = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: streamableHeaders,
      body: JSON.stringify(initializeRequest()),
    });

    assert.equal(initializeResponse.status, 200);
    assert.match(initializeResponse.headers.get("content-type") ?? "", /text\/event-stream/);
    assert.ok(initializeResponse.headers.get("mcp-session-id"));
    assert.match(await initializeResponse.text(), /"serverInfo":\{"name":"jira"/);

    const sessionId = initializeResponse.headers.get("mcp-session-id");
    const toolsResponse = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        ...streamableHeaders,
        "MCP-Session-Id": sessionId,
        "MCP-Protocol-Version": "2025-03-26",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
    });

    assert.equal(toolsResponse.status, 200);
    assert.match(await toolsResponse.text(), /jira_get_issue/);
  } finally {
    await closeServer(server);
  }
});

test("SSE exposes a message endpoint and delivers MCP responses", async () => {
  const server = await startRemoteServer(config("sse"));
  const baseUrl = serverUrl(server);
  const controller = new AbortController();
  let reader;

  try {
    const sseResponse = await fetch(`${baseUrl}/sse`, {
      headers: { Accept: "text/event-stream" },
      signal: controller.signal,
    });

    assert.equal(sseResponse.status, 200);
    assert.match(sseResponse.headers.get("content-type") ?? "", /text\/event-stream/);
    reader = sseResponse.body.getReader();

    const firstEvent = await reader.read();
    const endpointEvent = new TextDecoder().decode(firstEvent.value);
    const endpointMatch = endpointEvent.match(/data: ([^\r\n]+)/);
    assert.ok(endpointMatch);

    const messageResponse = await fetch(new URL(endpointMatch[1], baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(initializeRequest()),
    });

    assert.equal(messageResponse.status, 202);
    const responseEvent = await reader.read();
    assert.match(new TextDecoder().decode(responseEvent.value), /"serverInfo":\{"name":"jira"/);
  } finally {
    await reader?.cancel().catch(() => undefined);
    controller.abort();
    await closeServer(server);
  }
});
