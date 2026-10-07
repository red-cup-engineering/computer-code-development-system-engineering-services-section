import assert from "node:assert/strict";
import test from "node:test";
import { readJsnodeOperationArguments } from "@red-cup-engineering/javascript-node-services-section/syntax";

const greetPersonText = `#!/usr/bin/env node
import { basename } from "node:path";

/**
 * Greets one named person.
 * @param {object} request A record with \`name\`.
 * @returns {object} A Greeting record.
 * @throws {TypeError} When name is not a string.
 */
export function greetPerson(request) {
  if (typeof request?.name !== "string") throw new TypeError("name is required");
  return { type: "Greeting", text: \`Hello, \${basename(request.name)}!\` };
}

if (import.meta.main) {
  if (process.argv.includes("--help")) {
    process.stdout.write("greetPerson — Greets one named person.\\n");
  } else {
    let text = "";
    for await (const chunk of process.stdin) text += chunk;
    for (const line of text.split("\\n")) {
      if (line.length > 0) process.stdout.write(\`\${JSON.stringify(greetPerson(JSON.parse(line)))}\\n\`);
    }
  }
}
`;

const legacyDefaultExportText = `#!/usr/bin/env node
// append-eavt-row — the effect: durably append one row.
import { appendEavt } from "../src/eavt.mjs";

export default function appendEavtRowScript(path, row) {
  return appendEavt(path, row);
}

if (import.meta.url === \`file://\${process.argv[1]}\`) {
  console.log(appendEavtRowScript(process.argv[2], JSON.parse(process.argv[3])));
}
`;

test("reads a fully-conformant script into a complete JsnodeOperationArguments record", () => {
  const record = readJsnodeOperationArguments({ text: greetPersonText, path: "scripts/greet-person.mjs" });
  assert.equal(record.type, "JsnodeOperationArguments");
  assert.equal(record.version, 1);
  assert.equal(record.exportName, "greetPerson");
  assert.equal(record.exportCount, 1);
  assert.equal(record.isAsync, false);
  assert.equal(record.description, "Greets one named person.");
  assert.deepEqual(record.params, [{ name: "request", type: "object", description: "A record with `name`." }]);
  assert.deepEqual(record.returns, { type: "object", description: "A Greeting record." });
  assert.deepEqual(record.throws, [{ type: "TypeError", description: "When name is not a string." }]);
  assert.deepEqual(record.imports, [{ source: "node:path", names: ["basename"], text: 'import { basename } from "node:path";', bindings: [{ imported: "basename", local: "basename" }], attributes: null }]);
  assert.equal(record.hasMainGuard, true);
  assert.equal(record.readsStdin, true);
  assert.equal(record.writesStdout, true);
  assert.equal(record.shebang, true);
  assert.deepEqual(record.residue, []);
  assert.match(record.bodyText, /^\/\*\*/u);
  assert.match(record.bodyText, /export function greetPerson\(request\) \{[\s\S]*\}$/u);
});

test("reads a legacy default-export script without JSDoc or a real main guard as nonconformant", () => {
  const record = readJsnodeOperationArguments({ text: legacyDefaultExportText, path: "scripts/append-eavt-row.mjs" });
  assert.equal(record.exportName, "appendEavtRowScript");
  assert.equal(record.exportCount, 1);
  assert.equal(record.isAsync, false);
  assert.equal(record.description, null);
  assert.deepEqual(record.params, []);
  assert.equal(record.returns, null);
  assert.equal(record.hasMainGuard, false);
  assert.equal(record.readsStdin, false);
  assert.equal(record.writesStdout, false);
});

test("reads an async exported function as isAsync true", () => {
  const record = readJsnodeOperationArguments({ text: "#!/usr/bin/env node\n/**\n * Waits.\n */\nexport async function waitOne() {\n  return 1;\n}\n", path: "scripts/wait-one.mjs" });
  assert.equal(record.exportName, "waitOne");
  assert.equal(record.isAsync, true);
});

test("carries only explicit schemas; JSDoc describes code but does not claim a data contract", () => {
  const absent = readJsnodeOperationArguments({ text: greetPersonText, path: "scripts/greet-person.mjs" });
  assert.equal(absent.inputSchema, null);
  assert.equal(absent.outputSchema, null);
  const inputSchema = { type: "object", required: ["name"] };
  const outputSchema = { type: "object", required: ["text"] };
  const explicit = readJsnodeOperationArguments({ text: greetPersonText, path: "src/greet-person.mjs", inputSchema, outputSchema });
  assert.equal(explicit.inputSchema, inputSchema);
  assert.equal(explicit.outputSchema, outputSchema);
});

test("refuses a request whose text is not a string", () => {
  assert.throws(() => readJsnodeOperationArguments({ text: 1, path: "scripts/x.mjs" }), /text must be a string/u);
  assert.throws(() => readJsnodeOperationArguments({ path: "scripts/x.mjs" }), /text must be a string/u);
});

test("accepts source modules and refuses paths outside an operation carrier", () => {
  assert.equal(readJsnodeOperationArguments({ text: "export function x() {}", path: "src/x.mjs" }).exportName, "x");
  assert.throws(
    () => readJsnodeOperationArguments({ text: "export function x() {}", path: "scripts/Bad-Name.mjs" }),
    /path must match/u,
  );
  assert.throws(
    () => readJsnodeOperationArguments({ text: "export function x() {}", path: "scripts/x.mts" }),
    /path must match/u,
  );
});

test("observed imports retain aliases, side effects, attributes, and source order", () => {
  const record = readJsnodeOperationArguments({ path: "scripts/x.mjs", text: `import "./z.mjs";
import { parse as decode } from "example-codec";
import data from "./data.json" with { type: "json" };
/** Decode. */
export function x(value) { return decode(value); }
` });
  assert.deepEqual(record.imports[1].names, ["decode"]);
  assert.deepEqual(record.imports[1].bindings, [{ imported: "parse", local: "decode" }]);
  assert.equal(record.imports[0].text, 'import "./z.mjs";');
  assert.equal(record.imports[2].attributes, 'with { type: "json" }');
  assert.equal(record.mainGuardText, null);
});

test("all unrepresented top-level statements and extra guards are residue", () => {
  const record = readJsnodeOperationArguments({ path: "scripts/x.mjs", text: `console.log("startup");
/** Echo. */
export function x(value) { return value; }
if (import.meta.main) { process.stdout.write("main"); } else { process.exitCode = 7; }
if (import.meta.main) { process.stdout.write("second"); }
export { x as other };
` });
  assert.equal(record.residueStatements.length, 3);
  assert.equal(record.residue.length, 3);
  assert.match(record.residueStatements[0], /console.log/u);
  assert.match(record.mainGuardText, /else.*exitCode = 7/u);
});

test("malformed source is explicitly refused instead of partially read", () => {
  assert.throws(() => readJsnodeOperationArguments({ path: "scripts/x.mjs", text: "export function x( {" }), SyntaxError);
});

test("destructuring and unnamed declarations remain visible residue", () => {
  const record = readJsnodeOperationArguments({ path: "scripts/x.mjs", text: 'const { value } = globalThis; export function x() { return value; }' });
  assert.equal(record.residue.length, 1);
  assert.equal(record.residueStatements.length, 1);
});
