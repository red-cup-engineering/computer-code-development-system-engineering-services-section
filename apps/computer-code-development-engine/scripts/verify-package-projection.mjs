#!/usr/bin/env node
/** Verify that a package's packable projection can load every concrete public entrypoint:
 *  node verify-package-projection.mjs [package-root] (default: the working directory). */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const packageRoot = resolve(process.argv[2] ?? process.cwd());
const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
const missing = [];

const projectionTargets = [];
for (const [entrypoint, target] of Object.entries(manifest.exports)) {
  if (entrypoint.includes("*") || typeof target !== "object" || target === null) continue;
  for (const field of ["import"]) {
    const value = target[field];
    if (typeof value !== "string" || !existsSync(join(packageRoot, value))) {
      missing.push(`${entrypoint} ${field} -> ${String(value)}`);
    } else {
      projectionTargets.push(`${entrypoint} ${field} -> ${value}`);
    }
  }
}
for (const [name, target] of Object.entries(manifest.bin ?? {})) {
  if (typeof target !== "string" || !existsSync(join(packageRoot, target))) missing.push(`bin ${name} -> ${String(target)}`);
  else projectionTargets.push(`bin ${name} -> ${target}`);
}
if (missing.length > 0) throw new Error(`missing package projection target(s): ${missing.join(", ")}`);

const packed = JSON.parse(execFileSync("npm", ["pack", "--json", "--ignore-scripts", "--loglevel=error"], {
  cwd: packageRoot,
  encoding: "utf8",
}));
const tarball = join(packageRoot, packed[0].filename);
const packedPaths = new Set(execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" })
  .split("\n")
  .filter((path) => path.startsWith("package/"))
  .map((path) => path.slice("package/".length)));
const unpackedTargets = projectionTargets.filter((target) => {
  const path = target.slice(target.indexOf(" -> ") + " -> ".length).replace(/^\.\//u, "");
  return !packedPaths.has(path);
});
if (unpackedTargets.length > 0) throw new Error(`packed package omits projection target(s): ${unpackedTargets.join(", ")}`);
const consumerRoot = mkdtempSync("/tmp/package-projection-");
writeFileSync(join(consumerRoot, "package.json"), `${JSON.stringify({ name: "package-projection-consumer", private: true, type: "module" })}\n`);
execFileSync("npm", [
  "install", "--ignore-scripts", "--no-package-lock", "--no-audit", "--no-fund",
  "--registry=https://registry.561.group",
  "--@red-cup-engineering:registry=https://registry.561.group",
  tarball,
], {
  cwd: consumerRoot,
  stdio: "inherit",
});

const specifiers = [];
for (const entrypoint of Object.keys(manifest.exports)) {
  if (entrypoint.includes("*")) continue;
  specifiers.push(entrypoint === "." ? manifest.name : `${manifest.name}/${entrypoint.slice(2)}`);
}
execFileSync("node", [
  "--input-type=module",
  "--eval",
  "for (const specifier of JSON.parse(process.argv[1])) await import(specifier);",
  JSON.stringify(specifiers),
], { cwd: consumerRoot, stdio: "inherit" });
console.log(`verified ${specifiers.length} concrete public imports from ${packed[0].filename}`);
