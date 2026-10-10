import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, symlink, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { encode } from "@red-cup-engineering/eavt-services-section";
import { readBoundPackageOperations, inspectPackageResource } from "../src/operations.mjs";
import { readJsnodeOperationArguments } from "@red-cup-engineering/javascript-node-services-section/syntax";

async function fixture(t, { topLevel = "", body = "return input * 2;", async = false, params = "@param {number} input One input.", arguments: args = "input" } = {}) {
  const root = await mkdtemp(join(tmpdir(), "jsnode-package-operation-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const packageRoot = join(root, "node_modules", "@fixture", "operation");
  await mkdir(join(packageRoot, "scripts"), { recursive: true });
  const path = "scripts/compute.mjs";
  const text = `${topLevel}\n/**\n * ${params}\n * @returns {number} The result.\n */\nexport ${async ? "async " : ""}function compute(${args}) { ${body} }`;
  await writeFile(join(packageRoot, "package.json"), JSON.stringify({ name: "@fixture/operation", version: "1.0.0", type: "module", exports: "./index.mjs" }));
  await writeFile(join(packageRoot, "index.mjs"), "export {};\n");
  await writeFile(join(packageRoot, path), text);
  const inputSchema = args.includes(",")
    ? { type: "object", required: ["left", "right"], properties: { left: { type: "number" }, right: { type: "number" } }, additionalProperties: false }
    : { type: "number" };
  const read = readJsnodeOperationArguments({ text, path, inputSchema, outputSchema: { type: "number" } });
  const contract = Object.fromEntries(["path", "exportName", "isAsync", "description", "params", "returns", "inputSchema", "outputSchema", "throws"].map(key => [key, read[key]]));
  const rows = [{ e: "package:fixture", a: "constituted", v: { name: "@fixture/operation", version: "1.0.0" }, t: 0 }, { e: "package:fixture", a: "has-operation", v: contract, t: 1 }];
  const fernPath = join(root, "packages.eavt");
  const writeRows = () => writeFile(fernPath, rows.map(encode).join("\n") + "\n");
  await writeRows();
  return { root, packageRoot, path, rows, fernPath, writeRows, bind: () => readBoundPackageOperations({ fernPath, operationsRoot: root }) };
}

test("installed JSNode calls keep sync and async behavior while enforcing both Hoare predicates", async t => {
  for (const async of [false, true]) {
    const f = await fixture(t, { async });
    const [bound] = await f.bind();
    assert.equal(bound.identity, "operation/package:fixture/scripts/compute.mjs/compute");
    assert.equal(bound.operation.body.kind, "capability-effect");
    const result = bound.run(4);
    assert.equal(result instanceof Promise, async);
    assert.equal(await result, 8);
    assert.throws(() => bound.run("4"), error => error.code === "InvalidInput");
  }
  const invalid = await fixture(t, { body: 'return "wrong";' });
  const [operation] = await invalid.bind();
  assert.throws(() => operation.run(4), error => error.code === "InvalidOutput");
});

test("multiple JSNode arguments retain the admitted named-object carrier", async t => {
  const f = await fixture(t, { params: "@param {number} left Left.\n * @param {number} right Right.", arguments: "left, right", body: "return left + right;" });
  const [operation] = await f.bind();
  assert.equal(operation.run({ left: 2, right: 5 }), 7);
  assert.throws(() => operation.run({ left: 2 }), error => error.code === "OPERATION_INPUT_PARAMETERS_ABSENT");
});

test("package version, changed contracts, and escaped script paths refuse before importing code", async t => {
  for (const [kind, expected] of [["version", "OPERATION_PACKAGE_IDENTITY_MISMATCH"], ["contract", "OPERATION_CONTRACT_MISMATCH"], ["path", "OPERATION_PATH_OUTSIDE_PACKAGE"]]) {
    const f = await fixture(t, { body: 'throw new Error("must not execute");' });
    if (kind === "version") f.rows[0].v.version = "2.0.0";
    if (kind === "contract") f.rows[1].v.description = "changed contract";
    if (kind === "path") f.rows[1].v.path = "../outside.mjs";
    await f.writeRows();
    await assert.rejects(f.bind, error => error.refusal?.reason === expected);
  }
  const f = await fixture(t);
  await writeFile(join(f.root, "outside.mjs"), "export function compute(input) { return input; }");
  await rm(join(f.packageRoot, f.path));
  await symlink(join(f.root, "outside.mjs"), join(f.packageRoot, f.path));
  await assert.rejects(f.bind, error => error.refusal?.reason === "OPERATION_PATH_OUTSIDE_PACKAGE");
});

test("resource inspection reads admitted contracts without importing installed code", async t => {
  const f = await fixture(t, { body: 'throw new Error("inspection must not execute");' });
  const before = await readFile(f.fernPath, "utf8");
  const result = await inspectPackageResource({ fernPath: f.fernPath, resource: { path: "note.md", content: "data" } });
  assert.equal(result.operations.length, 1);
  assert.equal(result.operations[0].matched, false);
  assert.equal(await readFile(f.fernPath, "utf8"), before);
});
test("a later refused candidate prevents earlier module initialization", async t => {
  const f = await fixture(t, { topLevel: 'throw new Error("must not import the first candidate");' });
  f.rows.push({ ...f.rows[1], t: 2, v: { ...f.rows[1].v, path: "scripts/later.mjs" } });
  await writeFile(join(f.packageRoot, "scripts/later.mjs"), "export function changed(input) { return input; }");
  await f.writeRows();
  await assert.rejects(f.bind, error => error.refusal?.reason === "OPERATION_EXPORT_MISMATCH");
});
