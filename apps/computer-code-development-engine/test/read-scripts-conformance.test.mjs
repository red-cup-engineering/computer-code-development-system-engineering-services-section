import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readScriptsConformance } from "../scripts/read-scripts-conformance.mjs";
function pkg(files) {
  const dir = mkdtempSync(join(tmpdir(), "rsc-"));
  mkdirSync(join(dir, "scripts"), { recursive: true });
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, "scripts", name), text);
  return dir;
}
test("a one-export stdin-to-stdout script with a main guard conforms", () => {
  const dir = pkg({ "a.mjs": "export function a(x) { return x; }\nif (import.meta.main) { process.stdin; process.stdout.write('x'); }\n" });
  const r = readScriptsConformance({ packageDir: dir });
  assert.equal(r.totals.scripts, 1);
  assert.equal(r.scripts[0].conformant, true);
});
test("a declared shared operation runtime output boundary conforms", () => {
  const dir = pkg({ "a.mjs": 'import { runJavascriptNodeOperation } from "@red-cup-engineering/javascript-node-services-section/operation";\nexport function a(x) { return x; }\nif (import.meta.main) { await runJavascriptNodeOperation({ operation: a }, { standardInput: process.stdin, standardOutput: process.stdout }); }\n' });
  assert.equal(readScriptsConformance({ packageDir: dir }).scripts[0].conformant, true);
});
test("a .mts script with two exports and two effects is nonconformant with named reasons", () => {
  const dir = pkg({ "b.mts": "import { writeFileSync } from 'node:fs';\nexport function a() {}\nexport function b() { writeFileSync('x', 'y'); execSync('ls'); }\n" });
  const r = readScriptsConformance({ packageDir: dir });
  const s = r.scripts[0];
  assert.equal(s.conformant, false);
  assert.ok(s.reasons.some((x) => x.startsWith("extension .mts")));
  assert.ok(s.reasons.some((x) => x.startsWith("exports 2")));
  assert.deepEqual(s.effectImports, ["node:fs"]);
});
test("a package without scripts/ returns zero totals", () => {
  const dir = mkdtempSync(join(tmpdir(), "rsc-"));
  assert.deepEqual(readScriptsConformance({ packageDir: dir }).totals, { scripts: 0, conformant: 0, nonconformant: 0, lines: 0 });
});
test("refuses a missing packageDir", () => assert.throws(() => readScriptsConformance({}), /packageDir is required/u));
