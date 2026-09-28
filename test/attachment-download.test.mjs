import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

test("jira_download_attachment returns Jira bytes as MCP content", async () => {
  const attachments = new Map([
    ["101", { filename: "diagram.png", mimeType: "image/png", bytes: Buffer.from([137, 80, 78, 71]) }],
    ["102", { filename: "notes.txt", mimeType: "text/plain", bytes: Buffer.from("attachment notes") }],
    ["103", { filename: "report.pdf", mimeType: "application/pdf", bytes: Buffer.from("%PDF-test") }],
    ["104", { filename: "large.bin", mimeType: "application/octet-stream", bytes: Buffer.alloc(20) }],
    ["105", { filename: "outside.bin", mimeType: "application/octet-stream", bytes: Buffer.from("no") }],
  ]);
  const downloadCounts = new Map();
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
    if (request.headers.authorization !== "Bearer attachment-test-token") {
      response.writeHead(401).end();
      return;
    }

    const metadataMatch = url.pathname.match(/^\/rest\/api\/2\/attachment\/(\d+)$/);
    if (request.method === "GET" && metadataMatch) {
      const id = metadataMatch[1];
      const attachment = attachments.get(id);
      if (!attachment) {
        response.writeHead(404).end();
        return;
      }
      const content = id === "105"
        ? "http://example.invalid/attachment/105"
        : `http://${request.headers.host}/secure/attachment/${id}/${attachment.filename}`;
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({
        id,
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        size: attachment.bytes.byteLength,
        content,
      }));
      return;
    }

    const downloadMatch = url.pathname.match(/^\/secure\/attachment\/(\d+)\//);
    if (request.method === "GET" && downloadMatch) {
      const id = downloadMatch[1];
      const attachment = attachments.get(id);
      if (!attachment) {
        response.writeHead(404).end();
        return;
      }
      downloadCounts.set(id, (downloadCounts.get(id) ?? 0) + 1);
      response.writeHead(200, { "Content-Type": attachment.mimeType });
      response.end(attachment.bytes);
      return;
    }

    response.writeHead(404).end();
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.notEqual(address, null);
  const baseUrl = `http://127.0.0.1:${address.port}`;
  process.env.JIRA_BASE_URL = baseUrl;
  process.env.JIRA_PAT = "attachment-test-token";

  try {
    const { registerTools } = await import("../dist/tools.js");
    const registeredTools = new Map();
    registerTools({
      tool: (name, _description, _schema, handler) => registeredTools.set(name, handler),
    });
    const download = registeredTools.get("jira_download_attachment");
    assert.equal(typeof download, "function");

    const imageResult = await download({ attachmentId: "101" });
    assert.equal(imageResult.isError, undefined);
    assert.equal(imageResult.content[1].type, "image");
    assert.equal(imageResult.content[1].mimeType, "image/png");
    assert.equal(imageResult.content[1].data, attachments.get("101").bytes.toString("base64"));

    const textResult = await download({ attachmentId: "102" });
    assert.match(textResult.content[0].text, /attachment notes/);

    const pdfResult = await download({ attachmentId: "103" });
    assert.equal(pdfResult.content[1].type, "resource");
    assert.equal(pdfResult.content[1].resource.mimeType, "application/pdf");
    assert.equal(pdfResult.content[1].resource.blob, attachments.get("103").bytes.toString("base64"));

    const tooLargeResult = await download({ attachmentId: "104", maxBytes: 10 });
    assert.equal(tooLargeResult.isError, true);
    assert.equal(downloadCounts.get("104"), undefined);

    const unsafeUrlResult = await download({ attachmentId: "105" });
    assert.equal(unsafeUrlResult.isError, true);
    assert.match(unsafeUrlResult.content[0].text, /different host/);
    assert.equal(downloadCounts.get("105"), undefined);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
