import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseSoftwareMissionActionRecord,
  actionBlocks,
} from "../../src/mission/action-record-parser.mjs";

test("returns null for missing or malformed input", () => {
  assert.equal(parseSoftwareMissionActionRecord(null), null);
  assert.equal(parseSoftwareMissionActionRecord({}), null);
  assert.equal(parseSoftwareMissionActionRecord({ text: 42 }), null);
  assert.equal(parseSoftwareMissionActionRecord({ text: "not an action" }), null);
});

test("parses a JSON record with an action field", () => {
  const result = parseSoftwareMissionActionRecord({
    text: '{"action": "read", "args": {"path": "src/index.js"}, "reason": "check the file"}',
  });
  assert.deepEqual(result, {
    action: "read",
    args: { path: "src/index.js" },
    reason: "check the file",
  });
});

test("normalizes aliased action names", () => {
  const result = parseSoftwareMissionActionRecord({
    text: '{"action": "read_file", "args": {"path": "a.js"}}',
  });
  assert.equal(result.action, "read");
});

test("fills in a default reason when none is given", () => {
  const result = parseSoftwareMissionActionRecord({
    text: '{"action": "list_files", "args": {}}',
  });
  assert.equal(result.reason, "provider selected this next tool move");
});

test("reads JSON out of a fenced code block", () => {
  const result = parseSoftwareMissionActionRecord({
    text: 'Here is my move:\n```json\n{"action": "test", "reason": "run the suite"}\n```',
  });
  assert.equal(result.action, "test");
  assert.equal(result.reason, "run the suite");
});

test("parses a JSON record with a command field", () => {
  const result = parseSoftwareMissionActionRecord({
    text: '{"command": "edit_file", "path": "a.js", "blocks": []}',
  });
  assert.equal(result.action, "edit");
  assert.deepEqual(result.args, { path: "a.js", blocks: [] });
});

test("parses a JSON record keyed by a known action name", () => {
  const result = parseSoftwareMissionActionRecord({
    text: '{"search": {"query": "TODO"}, "reason": "find loose ends"}',
  });
  assert.deepEqual(result, {
    action: "search",
    args: { query: "TODO" },
    reason: "find loose ends",
  });
});

test("infers action from a bare path record", () => {
  const readResult = parseSoftwareMissionActionRecord({ text: '{"path": "a.js"}' });
  assert.equal(readResult.action, "read");

  const createResult = parseSoftwareMissionActionRecord({
    text: '{"path": "a.js", "content": "hello"}',
  });
  assert.equal(createResult.action, "create");

  const editResult = parseSoftwareMissionActionRecord({
    text: '{"path": "a.js", "blocks": [{"search": "x", "replace": "y"}]}',
  });
  assert.equal(editResult.action, "edit");
});

test("parses the plain-text TOOL: format for an edit", () => {
  const text = [
    "TOOL: edit_file",
    "PATH: src/index.js",
    "SEARCH:",
    "```",
    "old code",
    "```",
    "REPLACE:",
    "```",
    "new code",
    "```",
  ].join("\n");
  const result = parseSoftwareMissionActionRecord({ text });
  assert.equal(result.action, "edit");
  assert.deepEqual(result.args, {
    path: "src/index.js",
    blocks: [{ search: "old code", replace: "new code" }],
  });
});

test("parses the plain-text TOOL: format for a create", () => {
  const text = ["TOOL: create_file", "PATH: src/new.js", "CONTENT:", "```js", "export const x = 1;", "```"].join(
    "\n",
  );
  const result = parseSoftwareMissionActionRecord({ text });
  assert.equal(result.action, "create");
  assert.deepEqual(result.args, { path: "src/new.js", content: "export const x = 1;" });
});

test("parses the plain-text TOOL: format for read, search, and finish", () => {
  const readResult = parseSoftwareMissionActionRecord({ text: "TOOL: read_file\nPATH: a.js" });
  assert.deepEqual(readResult.args, { path: "a.js" });

  const searchResult = parseSoftwareMissionActionRecord({ text: "TOOL: search\nQUERY: TODO" });
  assert.deepEqual(searchResult.args, { query: "TODO" });

  const finishText = [
    "TOOL: finish",
    "---BEGIN WORK PRODUCT---",
    "Added the missing null check.",
    "---END WORK PRODUCT---",
  ].join("\n");
  const finishResult = parseSoftwareMissionActionRecord({ text: finishText });
  assert.equal(finishResult.action, "finish");
  assert.deepEqual(finishResult.args, { summary: "Added the missing null check." });
});

test("actionBlocks returns edit blocks as an array", () => {
  const single = { action: "edit", args: { blocks: { search: "a", replace: "b" } } };
  assert.deepEqual(actionBlocks(single), [{ search: "a", replace: "b" }]);

  const multiple = { action: "edit", args: { blocks: [{ search: "a", replace: "b" }] } };
  assert.deepEqual(actionBlocks(multiple), [{ search: "a", replace: "b" }]);
});

test("actionBlocks returns null for non-edit actions or missing blocks", () => {
  assert.equal(actionBlocks({ action: "read", args: {} }), null);
  assert.equal(actionBlocks({ action: "edit", args: {} }), null);
  assert.equal(actionBlocks(null), null);
});
