# read-scripts-conformance
## Requirements
- `conformance-record`: The operation returns a ScriptsConformance record for one package directory: every file under its scripts/ directory with the facts THE RULE names (export count, a main guard, stdin read, stdout write, effect imports, source extension) and a conformant verdict per file plus totals.
- `facts-not-judgment`: Every verdict is derived from named facts in the file text (import specifiers and syntactic markers), and each fact is returned beside the verdict.
## Prohibitions
- `missing-directory-refusal`: The operation must refuse a request whose packageDir is not a non-empty string.
- `no-execution`: The operation must never import or execute the scripts it reads; it reads bytes only.
## Laws
- `admitted-example-face-equivalence` | JSNode operation face-equivalence law | v1 | lib/emsenn/services/561-group/services/engineering-services-section/services/computer-engineering-services-section/services/computer-code-engineering-services-section/services/javascript-engineering-services-section/services/javascript-code-fabrication-services-section/services/javascript-node-code-fabrication-services-section/services/jsnode-package-services-section/README.md | Applies to the shared examples projected to the JSNode import and command faces. | Every admitted example has equivalent import and command outputs under the downstream JSNode face assay.
- `the-rule-for-scripts` | THE RULE for scripts/ and src/ (specified 2026-09-04) | v1 | .claude/rules/org-layering.md | Applies to every file under a package scripts/ directory. | A script is run, takes JSON in, puts JSON out, has at most one effect, and nothing in scripts/ works differently.
## Standards
- `node-esm-operation` | Node.js | v24.2.0+ | https://nodejs.org/docs/v24/api/esm.html | Applies to the .mjs operation, its import.meta.main guard, and downstream package-birth assays. | The package uses one executable ESM operation source file that is eligible for downstream staged package-birth assays.
## Open questions
none
## Package
```json
{"packageName":"@red-cup-engineering/read-scripts-conformance-service","packageVersion":"0.1.0","license":"MIT","dependencies":{},"devDependencies":{}}
```
## Operation
```mjs path=scripts/read-scripts-conformance.mjs
#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const EFFECT_SPECIFIERS = ["node:fs", "fs", "node:fs/promises", "fs/promises", "node:child_process", "child_process", "node:net", "net", "node:http", "http", "node:https", "https", "node:dgram", "node:worker_threads"];
const WRITE_CALLS = /\b(?:writeFile|writeFileSync|appendFile|appendFileSync|mkdir|mkdirSync|rm|rmSync|unlink|unlinkSync|rename|renameSync|copyFile|copyFileSync|spawn|spawnSync|exec|execSync|execFile|execFileSync|fetch|createServer|listen)\s*\(/gu;

function scriptFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const path = join(d, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.(?:mjs|mts|js|ts|cjs|sh)$/u.test(entry.name)) out.push(path);
    }
  };
  walk(dir);
  return out.sort();
}

function readFacts(path, text) {
  const exportMatches = text.match(/^export\s+(?:async\s+)?(?:function|const|let|class|default)\b/gmu) ?? [];
  const namedExportLists = text.match(/^export\s*\{[^}]*\}/gmu) ?? [];
  const importSpecifiers = [...text.matchAll(/^import\s+[^;]*?from\s+["']([^"']+)["']/gmu)].map((m) => m[1]);
  const effectImports = importSpecifiers.filter((s) => EFFECT_SPECIFIERS.includes(s));
  const writeCalls = (text.match(WRITE_CALLS) ?? []).map((c) => c.replace(/\s*\($/u, ""));
  const facts = {
    extension: path.slice(path.lastIndexOf(".")),
    lines: text.split("\n").length,
    exportCount: exportMatches.length + namedExportLists.length,
    hasMainGuard: /import\.meta\.main|import\.meta\.url\s*===|process\.argv\[1\]/u.test(text),
    readsStdin: /process\.stdin/u.test(text),
    writesStdout: /process\.stdout\.write|console\.log/u.test(text),
    effectImports,
    writeCalls: [...new Set(writeCalls)],
  };
  const reasons = [];
  if (facts.extension !== ".mjs") reasons.push(`extension ${facts.extension}: the language law is Node .mjs`);
  if (facts.exportCount !== 1) reasons.push(`exports ${facts.exportCount}: a script exports one operation`);
  if (!facts.hasMainGuard) reasons.push("no main guard: a script is run");
  if (!facts.readsStdin) reasons.push("does not read stdin: shit goes in as JSON");
  if (!facts.writesStdout) reasons.push("does not write stdout: shit comes out as JSON");
  if (facts.writeCalls.length > 1) reasons.push(`${facts.writeCalls.length} effect calls (${facts.writeCalls.join(", ")}): maybe one effect`);
  return { ...facts, conformant: reasons.length === 0, reasons };
}

/**
 * Reads every script under one package's scripts/ directory against THE RULE.
 * @param {object} request A record with packageDir.
 * @returns {object} A ScriptsConformance record.
 * @throws {TypeError} When packageDir is absent.
 */
export function readScriptsConformance(request) {
  if (typeof request?.packageDir !== "string" || request.packageDir.length === 0) throw new TypeError("packageDir is required");
  const dir = join(request.packageDir, "scripts");
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return { type: "ScriptsConformance", packageDir: request.packageDir, scripts: [], totals: { scripts: 0, conformant: 0, nonconformant: 0, lines: 0 } };
  const scripts = scriptFiles(dir).map((path) => ({ path: relative(request.packageDir, path), ...readFacts(path, readFileSync(path, "utf8")) }));
  const conformant = scripts.filter((s) => s.conformant).length;
  return { type: "ScriptsConformance", packageDir: request.packageDir, scripts, totals: { scripts: scripts.length, conformant, nonconformant: scripts.length - conformant, lines: scripts.reduce((n, s) => n + s.lines, 0) } };
}

if (import.meta.main) {
  if (process.argv.includes("--help")) {
    process.stdout.write("readScriptsConformance — Reads every script under one package's scripts/ directory against THE RULE.\n");
  } else {
    let text = "";
    for await (const chunk of process.stdin) text += chunk;
    for (const line of text.split("\n")) {
      if (line.length > 0) process.stdout.write(`${JSON.stringify(readScriptsConformance(JSON.parse(line)))}\n`);
    }
  }
}
```
## Tests
```mjs path=test/read-scripts-conformance.test.mjs
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
```
## Examples
```json name="a package without scripts has zero totals"
{"input":{"packageDir":"/nonexistent-package-for-the-example"},"output":{"type":"ScriptsConformance","packageDir":"/nonexistent-package-for-the-example","scripts":[],"totals":{"scripts":0,"conformant":0,"nonconformant":0,"lines":0}}}
```
## Traceability
- `conformance-record` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `admitted-example-face-equivalence`, `the-rule-for-scripts`, `node-esm-operation`
- `facts-not-judgment` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `the-rule-for-scripts`, `node-esm-operation`
- `missing-directory-refusal` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `admitted-example-face-equivalence`, `node-esm-operation`
- `no-execution` -> projection `jsnode-operation-package`; acceptance `jsnode-package-assays`; constraints `the-rule-for-scripts`, `node-esm-operation`
