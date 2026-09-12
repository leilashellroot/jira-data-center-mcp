import assert from "node:assert/strict";
import test from "node:test";

const { getCreateMeta } = await import("../dist/tools.js");

function rawClient(responses) {
  const requests = [];
  return {
    requests,
    async get(url, config) {
      requests.push({ url, config });
      return { data: responses[requests.length - 1] };
    },
  };
}

test("loads create metadata from the project-scoped endpoints", async () => {
  const raw = rawClient([
    { values: [{ id: "10004", name: "Bug", subtask: false }] },
    { values: [{ fieldId: "summary", required: true }] },
  ]);

  const meta = await getCreateMeta(raw, "CS", "Bug");

  assert.deepEqual(raw.requests, [
    { url: "/issue/createmeta/CS/issuetypes", config: { params: { maxResults: 1000 } } },
    { url: "/issue/createmeta/CS/issuetypes/10004", config: { params: { maxResults: 1000 } } },
  ]);
  assert.deepEqual(meta, {
    projects: [{
      key: "CS",
      issuetypes: [{
        id: "10004",
        name: "Bug",
        subtask: false,
        fields: {
          summary: { fieldId: "summary", required: true },
        },
      }],
    }],
  });
});

test("returns an empty issue type list when the requested type is unavailable", async () => {
  const raw = rawClient([[{ id: "10002", name: "Task" }]]);

  const meta = await getCreateMeta(raw, "CS", "Bug");

  assert.deepEqual(raw.requests, [
    { url: "/issue/createmeta/CS/issuetypes", config: { params: { maxResults: 1000 } } },
  ]);
  assert.deepEqual(meta, { projects: [{ key: "CS", issuetypes: [] }] });
});
