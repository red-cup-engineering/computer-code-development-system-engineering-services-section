#!/usr/bin/env node
// Repoints relative imports that reach into a directory which has since moved. For each static
// relative specifier that resolves to no file, every `--moved <old> <new>` path fragment is tried
// in turn; when the re-rooted path is a file, the import is rewritten to the bare specifier its
// owning package exports for that file (a relative import across a package boundary is never
// written back). An edge whose file has no export is reported, not guessed.
//
// `--anchor <directory-name>` (repeatable) re-roots a dead relative import at the one directory in
// the tree carrying that name, whatever depth the import guessed.
//
//   node repoint-moved-relative-imports.mjs [--moved <old-fragment> <new-fragment>]... [--anchor <directory-name>]... [--root lib] [--write]
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import process from "node:process";

const SKIP = new Set(["node_modules", ".git", "dist", "legacy", ".tmp", ".cache", "coverage", ".wrangler"]);
const SOURCE = /\.(mjs|cjs|js)$/u;
const RELATIVE = /(\bfrom\s*|\bimport\s*\(\s*|(?:^|[\n;])[ \t]*import\s*)(["'])(\.\.?\/[^"'\n]+)\2/gu;

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

function owningPackage(file) {
  for (let directory = dirname(file); directory !== dirname(directory); directory = dirname(directory)) {
    const manifest = join(directory, "package.json");
    if (existsSync(manifest)) return { directory, manifest: JSON.parse(readFileSync(manifest, "utf8")) };
  }
  return null;
}

function exportTarget(entry) {
  if (typeof entry === "string") return entry;
  if (entry && typeof entry === "object") for (const key of ["import", "node", "default"]) if (typeof entry[key] === "string") return entry[key];
  return undefined;
}

/** The bare specifier a package exports for one of its files, if it exports that file. */
function exportedSpecifier(file) {
  const owner = owningPackage(file);
  if (!owner || typeof owner.manifest.name !== "string") return null;
  const target = `./${relative(owner.directory, file)}`;
  const exports = owner.manifest.exports;
  if (typeof exports === "string") return exports === target ? owner.manifest.name : null;
  for (const [key, entry] of Object.entries(exports ?? {})) {
    if (exportTarget(entry) !== target) continue;
    return key === "." ? owner.manifest.name : `${owner.manifest.name}/${key.slice(2)}`;
  }
  return null;
}

const args = process.argv.slice(2);
const moves = [];
args.forEach((flag, index) => { if (flag === "--moved") moves.push([args[index + 1], args[index + 2]]); });
const anchorNames = [];
args.forEach((flag, index) => { if (flag === "--anchor") anchorNames.push(args[index + 1]); });
const rootIndex = args.indexOf("--root");
const root = resolve(rootIndex < 0 ? "lib" : args[rootIndex + 1]);
const write = args.includes("--write");
if (moves.length === 0 && anchorNames.length === 0) {
  process.stderr.write("usage: repoint-moved-relative-imports [--moved <old> <new>]... [--anchor <directory-name>]... [--root lib] [--write]\n");
  process.exit(2);
}
const anchorDirectories = new Map();
if (anchorNames.length > 0) {
  const wanted = new Set(anchorNames);
  const found = new Map(anchorNames.map((name) => [name, []]));
  const walkDirectories = (directory) => {
    let entries;
    try { entries = readdirSync(directory, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || SKIP.has(entry.name)) continue;
      const path = join(directory, entry.name);
      if (wanted.has(entry.name)) found.get(entry.name).push(path);
      walkDirectories(path);
    }
  };
  walkDirectories(root);
  for (const [name, paths] of found) {
    if (paths.length === 1) anchorDirectories.set(name, paths[0]);
    else process.stderr.write(`anchor ${name}: ${paths.length} directories carry that name; skipped\n`);
  }
}
const rewritten = [];
const unexported = [];
for (const file of sources(root)) {
  const text = readFileSync(file, "utf8");
  if (!moves.some(([old]) => text.includes(old)) && ![...anchorDirectories.keys()].some((name) => text.includes(`/${name}/`))) continue;
  const fileOwner = owningPackage(file)?.directory;
  const output = text.replace(RELATIVE, (whole, prefix, quote, specifier) => {
    const target = resolve(dirname(file), specifier);
    if (existsSync(target)) return whole;
    const candidates = [];
    for (const [old, moved] of moves) if (target.includes(old)) candidates.push(target.replace(old, moved));
    for (const [name, directory] of anchorDirectories) {
      const marker = `/${name}/`;
      const at = specifier.lastIndexOf(marker);
      if (at >= 0) candidates.push(join(directory, specifier.slice(at + marker.length)));
    }
    for (const candidate of candidates) {
      if (!existsSync(candidate)) continue;
      const candidateOwner = owningPackage(candidate)?.directory;
      if (candidateOwner === fileOwner) {
        let local = relative(dirname(file), candidate);
        if (!local.startsWith(".")) local = `./${local}`;
        return `${prefix}${quote}${local}${quote}`;
      }
      const bare = exportedSpecifier(candidate);
      if (bare === null) { unexported.push(`${relative(process.cwd(), file)} -> ${relative(process.cwd(), candidate)}`); return whole; }
      return `${prefix}${quote}${bare}${quote}`;
    }
    return whole;
  });
  if (output === text) continue;
  rewritten.push(relative(process.cwd(), file));
  if (write) writeFileSync(file, output);
}
process.stdout.write(`${JSON.stringify({ rewritten: rewritten.length, unexported, files: rewritten }, null, 2)}\n`);
