#!/usr/bin/env node
// Moves imported names from one module specifier to the modules that now own them, across every
// source file under the given roots, and makes each touched package's manifest declare the house
// packages its sources now import. Plain Node: static `import`/`export ... from` declarations are
// read lexically (their clauses never contain string literals), so no compiler is needed.
//
// A plan is JSON: { "rewrites": [ { "from": "<specifier>", "names": { "<name>": "<specifier>" },
// "rest": "<specifier>" } ] }. A declaration whose names all go to one target keeps its text and
// only its specifier changes; one whose names split is replaced by one declaration per target.
// A namespace, default, star, side-effect or dynamic import can move only when the rewrite has a
// `rest` target and no `names`; otherwise it is reported, never guessed.
//
// `--sync-manifest <package.json>` (repeatable) also syncs a manifest whose sources moved in by hand.
//
//   node rewrite-imported-names.mjs --plan <plan.json> [--root lib] [--write] [--sync-manifest <package.json>]
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import process from "node:process";

const SKIP = new Set(["node_modules", ".git", "dist", "legacy", ".tmp", ".cache", "coverage", ".wrangler"]);
const SOURCE = /\.(mjs|cjs|js)$/u;
const HOUSE = /^(@(?:red-cup-engineering|lenticule-science|561-group|emsenn|causeway-services|coesite-operations)\/[^/]+)/u;
const DECLARATION = /(^|[\n;])([ \t]*)(import|export)\s+([^;"'`]*?)\s*from\s*(["'])([^"'\n]+)\5([ \t]*with[ \t]*\{[^}]*\})?[ \t]*;?/gu;
const BARE = /(\bimport\s*\(\s*|(?:^|[\n;])[ \t]*import\s*|(?:^|[\n;])[ \t]*export\s*\*\s*from\s*)(["'])([^"'\n]+)\2/gu;

function* sources(directory) {
  let entries;
  try { entries = readdirSync(directory, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (entry.isSymbolicLink() || SKIP.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* sources(path);
    else if (SOURCE.test(entry.name)) yield path;
  }
}

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//gu, " ").replace(/\/\/[^\n]*/gu, " ");
}

/** `{ a, b as c }` → [{ imported: "a", local: "a" }, { imported: "b", local: "c" }] */
function namedBindings(inner) {
  return stripComments(inner).split(",").map((part) => part.trim()).filter(Boolean).map((part) => {
    const [imported, local] = part.split(/\s+as\s+/u).map((name) => name.trim());
    return { imported, local: local ?? imported, text: part };
  });
}

function readClause(clause) {
  const text = stripComments(clause).trim();
  const brace = text.indexOf("{");
  if (brace < 0) return { named: null, head: text };
  const head = text.slice(0, brace).replace(/,\s*$/u, "").trim();
  return { named: namedBindings(text.slice(brace + 1, text.lastIndexOf("}"))), head };
}

function rewriteText(text, rewrites, file, problems) {
  let changed = false;
  let output = text.replace(DECLARATION, (whole, lead, indent, keyword, clause, quote, specifier, attributes = "") => {
    const rule = rewrites.get(specifier);
    if (rule === undefined) return whole;
    const { named, head } = readClause(clause);
    const onlyRest = Object.keys(rule.names).length === 0 && rule.rest !== undefined;
    if (named === null || head !== "") {
      if (onlyRest) { changed = true; return whole.replace(`${quote}${specifier}${quote}`, `${quote}${rule.rest}${quote}`); }
      problems.push(`${file}: ${keyword} ${clause.trim()} from ${specifier} is not a named-only declaration`);
      return whole;
    }
    const groups = new Map();
    for (const binding of named) {
      const target = rule.names[binding.imported] ?? rule.rest;
      if (target === undefined) { problems.push(`${file}: no owner for ${binding.imported} from ${specifier}`); return whole; }
      if (!groups.has(target)) groups.set(target, []);
      groups.get(target).push(binding.text);
    }
    changed = true;
    if (groups.size === 1) {
      const [target] = groups.keys();
      return whole.replace(`${quote}${specifier}${quote}`, `${quote}${target}${quote}`);
    }
    const statements = [...groups].map(([target, parts]) => `${indent}${keyword} { ${parts.join(", ")} } from ${quote}${target}${quote}${attributes};`);
    return `${lead}${statements.join("\n")}`;
  });
  output = output.replace(BARE, (whole, prefix, quote, specifier) => {
    const rule = rewrites.get(specifier);
    if (rule === undefined) return whole;
    if (Object.keys(rule.names).length === 0 && rule.rest !== undefined) { changed = true; return `${prefix}${quote}${rule.rest}${quote}`; }
    problems.push(`${file}: bare, star or dynamic import of ${specifier} cannot be split by name`);
    return whole;
  });
  return changed ? output : null;
}

function owningManifest(file, root) {
  for (let directory = dirname(file); directory.startsWith(root); directory = dirname(directory)) {
    const manifest = join(directory, "package.json");
    if (existsSync(manifest)) return manifest;
  }
  return null;
}

function housePackages(root) {
  const packages = new Map();
  const walk = (directory) => {
    let entries;
    try { entries = readdirSync(directory, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.isSymbolicLink() || SKIP.has(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name === "package.json") {
        try {
          const manifest = JSON.parse(readFileSync(path, "utf8"));
          if (typeof manifest.name === "string" && HOUSE.test(manifest.name) && !packages.has(manifest.name)) packages.set(manifest.name, manifest.version ?? "0.0.0");
        } catch { /* an unreadable manifest names nothing */ }
      }
    }
  };
  walk(root);
  return packages;
}

/** The house packages a package's own sources import (nested packages excluded). */
function importedHousePackages(manifestPath, root) {
  const packageDirectory = dirname(manifestPath);
  const names = new Set();
  const walk = (directory) => {
    let entries;
    try { entries = readdirSync(directory, { withFileTypes: true }); } catch { return; }
    if (directory !== packageDirectory && entries.some((entry) => entry.name === "package.json")) return;
    for (const entry of entries) {
      if (entry.isSymbolicLink() || SKIP.has(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (SOURCE.test(entry.name)) {
        const text = readFileSync(path, "utf8");
        for (const match of text.matchAll(/["'](@[a-z0-9-]+\/[a-z0-9._-]+)(?:\/[^"'\n]*)?["']/gu)) {
          const name = HOUSE.exec(match[1])?.[1];
          if (name) names.add(name);
        }
      }
    }
  };
  walk(packageDirectory);
  return names;
}

function syncManifest(manifestPath, root, packages, retired) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const imported = importedHousePackages(manifestPath, root);
  const dependencies = { ...(manifest.dependencies ?? {}) };
  let changed = false;
  for (const name of imported) {
    if (name === manifest.name || !packages.has(name) || name in dependencies) continue;
    if (manifest.devDependencies && name in manifest.devDependencies) continue;
    dependencies[name] = packages.get(name); changed = true;
  }
  for (const name of retired) {
    if (name in dependencies && !imported.has(name)) { delete dependencies[name]; changed = true; }
  }
  if (!changed) return false;
  manifest.dependencies = Object.fromEntries(Object.entries(dependencies).sort(([left], [right]) => left.localeCompare(right)));
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return true;
}

const args = process.argv.slice(2);
const option = (flag) => { const index = args.indexOf(flag); return index < 0 ? undefined : args[index + 1]; };
const planPath = option("--plan");
if (planPath === undefined) {
  process.stderr.write("usage: rewrite-imported-names --plan <plan.json> [--root lib] [--write]\n");
  process.exit(2);
}
const plan = JSON.parse(readFileSync(planPath, "utf8"));
const root = resolve(option("--root") ?? "lib");
const write = args.includes("--write");
const rewrites = new Map(plan.rewrites.map((rule) => [rule.from, { names: rule.names ?? {}, rest: rule.rest }]));
const retired = new Set(plan.rewrites.map((rule) => HOUSE.exec(rule.from)?.[1]).filter(Boolean));
const problems = [];
const touched = [];
const manifests = new Set();
for (const file of sources(root)) {
  const text = readFileSync(file, "utf8");
  if (![...rewrites.keys()].some((specifier) => text.includes(specifier))) continue;
  const output = rewriteText(text, rewrites, relative(process.cwd(), file), problems);
  if (output === null) continue;
  touched.push(relative(process.cwd(), file));
  if (write) writeFileSync(file, output);
  const manifest = owningManifest(file, root);
  if (manifest) manifests.add(manifest);
}
args.forEach((flag, index) => { if (flag === "--sync-manifest") manifests.add(resolve(args[index + 1])); });
const updatedManifests = [];
if (write) {
  const packages = housePackages(root);
  for (const manifest of manifests) if (syncManifest(manifest, root, packages, retired)) updatedManifests.push(relative(process.cwd(), manifest));
}
process.stdout.write(`${JSON.stringify({ touched: touched.length, manifests: updatedManifests.length, problems, files: touched }, null, 2)}\n`);
