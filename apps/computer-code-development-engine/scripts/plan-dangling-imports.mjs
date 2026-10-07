#!/usr/bin/env node
// Plans the repair of imports that name a house package which no longer exists, or a subpath a
// package no longer exports. Every exported name of every house package is indexed from the
// modules its manifest exports; each dangling import's names are then looked up there. A name
// with exactly one definer (or one whose export key matches the dangling subpath's last segment)
// is planned onto it; a name with none or several is reported, never guessed. The plan is the
// input rewrite-imported-names applies.
//
//   node plan-dangling-imports.mjs [--root lib] --out <plan.json>
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { parseJavaScript, walkJavaScript } from "@red-cup-engineering/javascript-node-services-section/javascript-parser";

const SKIP = new Set(["node_modules", ".git", "dist", "legacy", ".tmp", ".cache", "coverage", ".wrangler", ".lake"]);
const HOUSE = /^(@(?:red-cup-engineering|lenticule-science|561-group|emsenn|causeway-services|coesite-operations)\/[^/]+)(\/.*)?$/u;

function* walk(directory) {
  let entries;
  try { entries = readdirSync(directory, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (entry.isSymbolicLink() || SKIP.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}

const exportTarget = (value) => typeof value === "string" ? value
  : value && typeof value === "object" ? exportTarget(value.import ?? value.default ?? value.node) : undefined;

/** The names a module itself defines and exports. A re-export (`export … from`,
 * or exporting an imported binding) is a barrel, not a definition. */
function allExports(file) {
  let program;
  try { program = parseJavaScript(readFileSync(file, "utf8")); } catch { return []; }
  const names = [];
  for (const statement of program.body) {
    if (statement.type !== "ExportNamedDeclaration") continue;
    const declaration = statement.declaration;
    if (declaration?.id?.name) names.push(declaration.id.name);
    if (declaration?.type === "VariableDeclaration") for (const item of declaration.declarations) if (item.id.type === "Identifier") names.push(item.id.name);
    for (const specifier of statement.specifiers) names.push(specifier.exported.type === "Identifier" ? specifier.exported.name : specifier.exported.value);
  }
  return names;
}

function definedExports(file) {
  let program;
  try { program = parseJavaScript(readFileSync(file, "utf8")); } catch { return []; }
  const imported = new Set();
  for (const statement of program.body) if (statement.type === "ImportDeclaration") for (const specifier of statement.specifiers) imported.add(specifier.local.name);
  const names = [];
  for (const statement of program.body) {
    if (statement.type !== "ExportNamedDeclaration" || statement.source) continue;
    const declaration = statement.declaration;
    if (declaration?.id?.name) names.push(declaration.id.name);
    if (declaration?.type === "VariableDeclaration") for (const item of declaration.declarations) if (item.id.type === "Identifier") names.push(item.id.name);
    for (const specifier of statement.specifiers) {
      const local = specifier.local.type === "Identifier" ? specifier.local.name : specifier.local.value;
      if (!imported.has(local)) names.push(specifier.exported.type === "Identifier" ? specifier.exported.name : specifier.exported.value);
    }
  }
  return names;
}

// The architecture's owners, most canonical first: a name defined in several
// places is planned onto the earliest owner that defines it.
const OWNER_ORDER = [
  /^@red-cup-engineering\/computer-data-engineering-services-section\/signcell\//u,
  /^@red-cup-engineering\/computer-code-engineering-services-section\/(?:signchain|semiotic-expression-notation|semiotic-eavt)/u,
  /^@red-cup-engineering\/computer-networking-engineering-services-section\/signgraph\//u,
  /^@red-cup-engineering\/computer-systems-engineering-services-section\/signcraft\//u,
  /^@lenticule-science\/metrologic\//u,
  /^@red-cup-engineering\/(?:computer-content-engineering-services-section|json-services-section|jsonl-services-section|eavt|cbor-services-section|uri-services-section|json-schema-services-section|computer-data-engineering-services-section)(?:\/|$)/u,
];
const packageDirectories = new Map();
const SUBSTRATE = /\/computer-(?:data|code|networking)-engineering-services-section\//u;
// Named owners first, then any package inside the data, code or networking
// substrate sections, then everything above the substrate.
const ownerRank = (specifier) => {
  const index = OWNER_ORDER.findIndex((pattern) => pattern.test(specifier));
  if (index >= 0) return index;
  const name = HOUSE.exec(specifier)?.[1];
  return SUBSTRATE.test(packageDirectories.get(name) ?? "") ? OWNER_ORDER.length : OWNER_ORDER.length + 1;
};

const args = process.argv.slice(2);
const option = (flag) => { const index = args.indexOf(flag); return index < 0 ? undefined : args[index + 1]; };
const root = resolve(option("--root") ?? "lib");
const out = option("--out");
if (!out) { process.stderr.write("usage: plan-dangling-imports [--root lib] --out <plan.json>\n"); process.exit(2); }

// 1. Every house package and the names each exported subpath defines.
const packages = new Map();
const definers = new Map();
const reexporters = new Map();
const add = (index, name, file, specifier) => {
  if (!index.has(name)) index.set(name, new Map());
  const byFile = index.get(name);
  const stem = file.split("/").at(-1).replace(/\.[cm]?js$/u, "");
  const previous = byFile.get(file);
  // Several export keys may name one file; keep the one whose last segment is the file's stem.
  if (!previous || (specifier.split("/").at(-1) === stem && previous.split("/").at(-1) !== stem)) byFile.set(file, specifier);
};
for (const path of walk(root)) {
  if (!path.endsWith("/package.json")) continue;
  let manifest;
  try { manifest = JSON.parse(readFileSync(path, "utf8")); } catch { continue; }
  if (typeof manifest.name !== "string" || !HOUSE.test(manifest.name) || packages.has(manifest.name)) continue;
  const directory = dirname(path);
  packageDirectories.set(manifest.name, directory);
  const exports = typeof manifest.exports === "string" ? { ".": manifest.exports } : manifest.exports ?? {};
  packages.set(manifest.name, new Set(Object.keys(exports)));
  for (const [key, value] of Object.entries(exports)) {
    const target = exportTarget(value);
    if (typeof target !== "string" || key.includes("*") || !target.endsWith("js")) continue;
    const file = join(directory, target);
    if (!existsSync(file)) continue;
    const specifier = key === "." ? manifest.name : `${manifest.name}/${key.slice(2)}`;
    const defined = new Set(definedExports(file));
    for (const name of defined) add(definers, name, file, specifier);
    for (const name of allExports(file)) if (!defined.has(name)) add(reexporters, name, file, specifier);
  }
}

// 2. Dangling house specifiers and the names their importers take.
const dangling = new Map();
const isDangling = (specifier) => {
  const match = HOUSE.exec(specifier);
  if (!match) return false;
  const keys = packages.get(match[1]);
  if (!keys) return true;
  return !keys.has(match[2] ? `.${match[2]}` : ".");
};
for (const path of walk(root)) {
  if (!/\.(mjs|js|cjs)$/u.test(path)) continue;
  let program;
  try { program = parseJavaScript(readFileSync(path, "utf8")); } catch { continue; }
  walkJavaScript(program, (node) => {
    if ((node.type === "ImportDeclaration" || (node.type === "ExportNamedDeclaration" && node.source)) && isDangling(node.source.value)) {
      if (!dangling.has(node.source.value)) dangling.set(node.source.value, new Set());
      for (const specifier of node.specifiers) {
        if (specifier.type === "ImportSpecifier") dangling.get(node.source.value).add(specifier.imported.type === "Identifier" ? specifier.imported.name : specifier.imported.value);
        else if (specifier.type === "ExportSpecifier") dangling.get(node.source.value).add(specifier.local.type === "Identifier" ? specifier.local.name : specifier.local.value);
        else if (specifier.type === "ImportDefaultSpecifier") dangling.get(node.source.value).add("default");
      }
    }
  });
}

// 3. Plan each name onto its definer.
const rewrites = [];
const unresolved = [];
for (const [from, names] of [...dangling].sort()) {
  const hint = from.split("/").at(-1);
  const map = {};
  for (const name of names) {
    if (name === "default") { unresolved.push(`${from} :: default`); continue; }
    const candidates = [...(definers.get(name) ?? reexporters.get(name) ?? new Map()).values()];
    const byHint = candidates.filter((candidate) => candidate.split("/").at(-1) === hint);
    const ranked = [...candidates].sort((left, right) => ownerRank(left) - ownerRank(right));
    const bestRank = ranked.length ? ownerRank(ranked[0]) : Infinity;
    const best = ranked.filter((candidate) => ownerRank(candidate) === bestRank);
    const chosen = candidates.length === 1 ? candidates[0] : byHint.length === 1 ? byHint[0] : best.length === 1 && bestRank <= OWNER_ORDER.length ? best[0] : undefined;
    if (chosen) map[name] = chosen;
    else unresolved.push(`${from} :: ${name} (${candidates.length ? candidates.join(" | ") : "no definer"})`);
  }
  if (Object.keys(map).length) rewrites.push({ from, names: map });
}
writeFileSync(out, `${JSON.stringify({ rewrites }, null, 1)}\n`);
process.stdout.write(`${JSON.stringify({ dangling: dangling.size, planned: rewrites.length, unresolved }, null, 1)}\n`);
