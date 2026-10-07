#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { confinePath } from "@red-cup-engineering/computer-filepath-engineering-services-section/filepath";
import { resolve } from "node:path";
import { runJavascriptNodeOperation } from "@red-cup-engineering/javascript-node-services-section/operation";

const EFFECT_SPECIFIERS = ["node:fs", "fs", "node:fs/promises", "fs/promises", "node:child_process", "child_process", "node:net", "net", "node:http", "http", "node:https", "https", "node:dgram", "node:worker_threads"];
const WRITE_CALLS = /\b(?:writeFile|writeFileSync|appendFile|appendFileSync|mkdir|mkdirSync|rm|rmSync|unlink|unlinkSync|rename|renameSync|copyFile|copyFileSync|spawn|spawnSync|exec|execSync|execFile|execFileSync|fetch|createServer|listen)\s*\(/gu;

function usesSharedOperationRuntimeOutput(text) {
  return /import\s*\{[^}]*\brunJavascriptNodeOperation\b[^}]*\}\s*from\s*["']@red-cup-engineering\/javascript-node-services-section\/operation["']/u.test(text) && /runJavascriptNodeOperation\s*\([\s\S]*?standardOutput\s*:\s*process\.stdout/u.test(text);
}

function scriptFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const path = resolve(d, entry.name);
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
    writesStdout: /process\.stdout\.write|console\.log/u.test(text) || usesSharedOperationRuntimeOutput(text),
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
  const dir = resolve(request.packageDir, "scripts");
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return { type: "ScriptsConformance", packageDir: request.packageDir, scripts: [], totals: { scripts: 0, conformant: 0, nonconformant: 0, lines: 0 } };
  const scripts = scriptFiles(dir).map((path) => ({ path: confinePath({ root: request.packageDir, path }).relativePath, ...readFacts(path, readFileSync(path, "utf8")) }));
  const conformant = scripts.filter((s) => s.conformant).length;
  return { type: "ScriptsConformance", packageDir: request.packageDir, scripts, totals: { scripts: scripts.length, conformant, nonconformant: scripts.length - conformant, lines: scripts.reduce((n, s) => n + s.lines, 0) } };
}

if (import.meta.main) {
  const result = await runJavascriptNodeOperation({ name: "read-scripts-conformance", description: "Reads every script under one package's scripts/ directory against THE RULE.", operation: readScriptsConformance }, { arguments: process.argv.slice(2), standardInput: process.stdin, standardOutput: process.stdout });
  process.exitCode = result.exitCode;
}
