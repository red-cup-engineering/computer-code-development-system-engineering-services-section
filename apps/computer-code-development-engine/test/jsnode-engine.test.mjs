import { applyExactSourceEdits } from "@red-cup-engineering/computer-code-engineering-services-section/exact-source-edits";
import assert from "node:assert/strict";
import test from "node:test";
import {
  applyJsnodeSourceEditPlan,
  applyJsnodePackageCollapsePlan,
  readJsnodeModuleExports,
  readJsnodeModuleRequests,
  readJsnodeRuntimeModuleRequests,
  readJsnodeSourceRecord,
  readJsnodeSyntax,
  readJsnodeTokens,
  planJsnodeModuleSpecifierRewrite,
  planJsnodePackageCollapse,
  visitJsnodeSyntax,
} from "../src/index.mjs";

test("the parser provides typed syntax and diagnostics without a private runtime", () => {
  const parsed = readJsnodeSyntax("export const View = <main>{name}</main>;", "view.tsx");
  assert.equal(parsed.language, "tsx");
  assert.equal(parsed.diagnostics.length, 0);
  assert.equal(parsed.tree.kind, "SourceFile");
  const malformed = readJsnodeSyntax("export const = ;", "broken.mjs");
  assert.equal(malformed.diagnostics.length > 0, true);
  assert.equal(malformed.diagnostics[0].line, 1);
});

test("reads complete import forms and explicit export limits", () => {
  const source = [
    'import "a";', 'export { b } from "b";', 'const c = import("c");', 'const d = require("d");', "const e = import(dynamic);",
  ].join("\n");
  assert.deepEqual(readJsnodeModuleRequests(source, "module.mjs").map(({ kind, specifier }) => ({ kind, specifier })), [
    { kind: "static-import", specifier: "a" }, { kind: "static-import", specifier: "b" },
    { kind: "dynamic-import", specifier: "c" }, { kind: "commonjs-require", specifier: "d" },
    { kind: "dynamic-import", specifier: null },
  ]);
  assert.deepEqual(readJsnodeModuleExports("export default 1; export { x as y } from 'x'; export * from 'z';"), { names: ["default", "y"], hasStarExport: true });
  assert.throws(() => readJsnodeModuleRequests("export const = ;", "broken.mjs"), SyntaxError);
});

test("keeps traversal and guarded runtime imports inside the engine", () => {
  const visited = [];
  visitJsnodeSyntax("export function decide(input) { return input; }", "strategy.mjs", (node, _parent, typescript) => visited.push(typescript.SyntaxKind[node.kind]));
  assert.equal(visited.includes("FunctionDeclaration"), true);
  assert.deepEqual(readJsnodeRuntimeModuleRequests('try { require("optional") } catch {}\nfunction later() { require("required") }', "runtime.cjs"), [
    { kind: "require", specifier: "optional", guarded: true },
    { kind: "require", specifier: "required", guarded: false },
  ]);
});

test("edits only approved spans", () => {
  assert.equal(applyExactSourceEdits("a = 'old'; // unchanged\n", [{ start: 4, end: 9, text: "'new'" }]), "a = 'new'; // unchanged\n");
  assert.throws(() => applyExactSourceEdits("abc", [{ start: 0, end: 2, text: "x" }, { start: 1, end: 3, text: "y" }]), /overlap/);
});

test("builds portable source data and token data for JS, JSX, and TypeScript", () => {
  const source = "export const View = <main>{name as string}</main>;\n";
  const record = readJsnodeSourceRecord(source, "view.tsx");
  assert.equal(record.kind, "jsnode.source-record");
  assert.match(record.digest, /^sha256:[0-9a-f]{64}$/u);
  const tokens = readJsnodeTokens(source, "view.tsx");
  assert.equal(tokens.source.digest, record.digest);
  assert.equal(tokens.tokens.some((token) => token.text === "main"), true);
  assert.equal(tokens.tokens.every((token) => Number.isSafeInteger(token.start) && token.end >= token.start), true);
});

test("admits a module codemod plan and refuses stale source", () => {
  const source = 'import old from "old-package";\nconst later = import("old-package");\nconst prose = "old-package";\n';
  const plan = planJsnodeModuleSpecifierRewrite(source, "consumer.mjs", "old-package", "new-package");
  assert.equal(plan.edits.length, 2);
  const receipt = applyJsnodeSourceEditPlan(source, "consumer.mjs", plan);
  assert.equal(receipt.editCount, 2);
  assert.match(receipt.text, /from "new-package"/u);
  assert.match(receipt.text, /"old-package";\n$/u);
  assert.throws(() => applyJsnodeSourceEditPlan(`${source}// changed\n`, "consumer.mjs", plan), /changed after/u);
});

test("collapses selected package modules into app modules through parser-admitted requests", () => {
  const source = [
    'import core from "@zelo/identity";',
    'export { identity } from "@zelo/identity";',
    'const later = import("@zelo/identity");',
    'const legacy = require("@zelo/identity");',
    'import { helper } from "./helper.mjs";',
    'const asset = new URL("../assets/card.json", import.meta.url);',
    'const prose = "@zelo/identity";',
  ].join("\n");
  const mapping = { files: [
    { from: "packages/identity/src/index.mts", to: "apps/zelo/modules/identity.mjs" },
    { from: "packages/identity/src/helper.mts", to: "apps/zelo/modules/helper.mjs" },
    { from: "packages/identity/src/helper.mjs", to: "apps/zelo/modules/helper.mjs" },
    { from: "packages/identity/assets/card.json", to: "apps/zelo/assets/card.json" },
  ], packageExports: [{ specifier: "@zelo/identity", to: "apps/zelo/modules/identity.mjs" }] };
  const plan = planJsnodePackageCollapse(source, "packages/identity/src/index.mts", mapping);
  const receipt = applyJsnodePackageCollapsePlan(source, "packages/identity/src/index.mts", plan);
  assert.equal(receipt.outputPath, "apps/zelo/modules/identity.mjs");
  assert.match(receipt.text, /from "\.\/identity\.mjs"/u);
  assert.match(receipt.text, /import\("\.\/identity\.mjs"\)/u);
  assert.match(receipt.text, /require\("\.\/identity\.mjs"\)/u);
  assert.match(receipt.text, /from "\.\/helper\.mjs"/u);
  assert.match(receipt.text, /new URL\("\.\.\/assets\/card\.json", import\.meta\.url\)/u);
  assert.match(receipt.text, /const prose = "@zelo\/identity";/u);
});

test("rebases moved tests and erases selected TypeScript into ESM", () => {
  const mapping = { files: [
    { from: "packages/identity/test/identity.test.mts", to: "apps/zelo/test/identity.test.mjs" },
    { from: "packages/identity/src/helper.mts", to: "apps/zelo/modules/helper.mjs" },
    { from: "packages/identity/src/helper.mjs", to: "apps/zelo/modules/helper.mjs" },
    { from: "packages/identity/src/types.mts", to: "apps/zelo/modules/types.mjs" },
  ], packageExports: [] };
  const source = 'import type { Identity } from "../src/types.mjs";\nimport { helper } from "../src/helper.mjs";\nconst ids = new Set<string>();\nexport const value: Identity = helper();\n';
  const plan = planJsnodePackageCollapse(source, "packages/identity/test/identity.test.mts", mapping, { eraseTypeScript: true });
  const receipt = applyJsnodePackageCollapsePlan(source, "packages/identity/test/identity.test.mts", plan);
  assert.equal(receipt.outputPath, "apps/zelo/test/identity.test.mjs");
  assert.match(receipt.text, /from "\.\.\/modules\/helper\.mjs"/u);
  assert.doesNotMatch(receipt.text, /Identity|import type|: Identity/u);
  assert.match(receipt.text, /new Set\(\)/u);
  assert.match(receipt.text, /export const value = helper\(\);/u);
  assert.throws(() => planJsnodePackageCollapse("@sealed class Identity {}", "packages/identity/src/identity.mts", { files: [], packageExports: [] }, { eraseTypeScript: true }), /decorators/u);
  assert.throws(() => planJsnodePackageCollapse("export const View = <main/>;", "packages/identity/src/view.tsx", { files: [], packageExports: [] }, { eraseTypeScript: true }), /TypeScript erasure/u);
});
