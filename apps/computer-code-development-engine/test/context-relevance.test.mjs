import assert from "node:assert/strict";
import test from "node:test";

import { projectContextRelevance } from "../src/coding-context/context-relevance.mjs";

const observation = Object.freeze({
  packages: Object.freeze([
    { name: "@example/context-tools", packagePath: "services/context-tools", manifest: { bin: { "derive-context": "./scripts/derive-context.mjs" } } },
    { name: "@example/ledger", packagePath: "services/ledger", manifest: { bin: { "read-ledger": "./scripts/read-ledger.mjs" } } },
  ]),
  functions: Object.freeze([
    { pkg: "@example/context-tools", name: "deriveContextProfile", domain: ["ContextQuery"], codomain: "ContextProfile" },
    { pkg: "@example/ledger", name: "readLedger", domain: ["LedgerPath"], codomain: "Ledger" },
  ]),
  types: Object.freeze([
    { pkg: "@example/context-tools", name: "ContextProfile", kind: "interface" },
    { pkg: "@example/ledger", name: "Ledger", kind: "type" },
  ]),
});

test("context relevance is a deterministic projection over observed JSNode surfaces", () => {
  const result = projectContextRelevance(observation, { q: "derive context profile", focus: "services/context-tools", limit: 4 });
  assert.equal(result.kind, "coding-context.relevance");
  assert.deepEqual(result.keywords, ["derive", "profile"]);
  assert.equal(result.functions[0].name, "deriveContextProfile");
  assert.equal(result.functions[0].signature, "deriveContextProfile(ContextQuery): ContextProfile");
  assert.equal(result.types[0].name, "ContextProfile");
  assert.equal(result.scripts[0].bin, "derive-context");
  assert.equal("generatedAt" in result, false);
  assert.equal("interfaces" in result, false);
});

test("context relevance balances multiple query terms without duplicate carriers", () => {
  const result = projectContextRelevance(observation, { q: "profile ledger", limit: 4 });
  assert.deepEqual(new Set(result.functions.map((item) => item.name)), new Set(["deriveContextProfile", "readLedger"]));
  assert.equal(new Set(result.functions.map((item) => `${item.package}:${item.name}`)).size, result.functions.length);
  assert.deepEqual(result.keywordSurfaces.map((surface) => surface.keyword), ["profile", "ledger"]);
});

test("context relevance keeps a literal package path as focus while surfacing declared bins and exports", () => {
  const prompt = "Relocate lib/emsenn/services/context-tools through the existing directory operation";
  const result = projectContextRelevance(observation, { prompt, maxBytes: 2048 });
  assert.equal(result.prompt, prompt);
  assert.equal(result.focus, "services/context-tools");
  assert.equal(result.packages[0].package, "@example/context-tools");
  assert.deepEqual(result.packages[0].bins, [{ bin: "derive-context", target: "./scripts/derive-context.mjs" }]);
  assert.equal(result.source.functions, "observed-source-index");
  assert.equal(result.completeness.maxBytes, 2048);
});

test("context relevance states missing type evidence without forcing it", () => {
  const result = projectContextRelevance({ ...observation, functions: null, types: null }, { prompt: "derive context" });
  assert.deepEqual(result.functions, []);
  assert.equal(result.source.functions, "unavailable");
});

test("context relevance reports conditional root exports without inventing a symbol import", () => {
  const result = projectContextRelevance({ ...observation, packages: [{ name: "@example/conditional", packagePath: "services/conditional", manifest: { exports: { import: "./dist/index.mjs", types: "./dist/index.d.mts" } } }], functions: null, types: null }, { prompt: "conditional" });
  assert.deepEqual(result.packages[0].exports, ["."]);
  assert.deepEqual(result.functions, []);
});

test("context relevance refuses an irreducibly too-small output budget", () => {
  const result = projectContextRelevance(observation, { prompt: "x".repeat(2_000), maxBytes: 512 });
  assert.deepEqual(result.kind, "coding-context.relevance.refusal");
  assert.equal(result.reason, "output-budget-too-small");
  assert.ok(Buffer.byteLength(JSON.stringify(result), "utf8") <= 512);
});

test("context relevance measures its complete response at the byte boundary", () => {
  const fixture = { packages: [{ name: "@example/move", packagePath: "services/move", manifest: { description: "Move a directory.", bin: { "move-directory": "scripts/move.mjs" }, exports: "." } }], functions: null, types: null };
  const full = projectContextRelevance(fixture, { prompt: "move directory", maxBytes: 24_000 });
  const bytes = Buffer.byteLength(JSON.stringify(full), "utf8");
  const bounded = projectContextRelevance(fixture, { prompt: "move directory", maxBytes: bytes - 1 });
  assert.ok(Buffer.byteLength(JSON.stringify(bounded), "utf8") <= bytes - 1);
});


test("bounded relevance retains source coordinates instead of repeated keyword records or oversized manifests", () => {
  const source = { path: `${"services/".repeat(30)}read-markdown-features.mjs`, line: 27, column: 1, endLine: 52, kind: "source" };
  const result = projectContextRelevance({
    packages: [{ name: "@example/markdown", packagePath: "services/markdown", manifest: {
      description: "read markdown features", exports: Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`./markdown-feature-${i}`, `./src/feature-${i}.mjs`])),
    } }],
    functions: [{ pkg: "@example/markdown", name: "readMarkdownFeatures", domain: ["unknown"], source,
      imports: [{ name: "readMarkdownFeatures", specifier: "@example/markdown/read-markdown-features" }] }],
    types: [],
  }, { prompt: "readMarkdownFeatures", maxBytes: 1800 });
  assert.equal(result.kind, "coding-context.relevance");
  assert.deepEqual(result.functions[0].source, source);
  assert.equal(result.functions[0].import, "@example/markdown/read-markdown-features");
  assert.deepEqual(result.keywordSurfaces.map((surface) => surface.functions), [[0], [0], [0]]);
  assert.equal(result.completeness.omitted.packages, 1);
  assert.ok(Buffer.byteLength(JSON.stringify(result)) <= 1800);
});
