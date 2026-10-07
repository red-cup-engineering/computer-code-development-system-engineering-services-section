/**
 * Audit package runtime entrypoints. A package is loadable by Node when public
 * entries and bins name JavaScript modules, never TypeScript source. Packages
 * may publish those modules directly from src; a generated dist directory is
 * not part of this capability.
 */
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

function exportTargets(value) {
  if (typeof value === "string") return [value];
  if (value === null || typeof value !== "object") return [];
  return Object.values(value).flatMap(exportTargets);
}

function isTypeScriptTarget(target) {
  return /\.(?:[cm]?ts|tsx)$/.test(target) && !/\.d\.[cm]?ts$/.test(target);
}

function requiresJavaScript(target) {
  return target.endsWith(".mjs") || target.endsWith(".cjs") || target.endsWith(".js");
}

/** The boundary failures of a package, as a pure function of its manifest and
 * authored runtime file list. Empty array means Node can load every public
 * runtime entry without a build step. */
export function packageBoundaryFailures({ manifest, srcFiles }) {
  const failures = [];
  for (const field of ["main", "types"]) {
    const target = manifest[field];
    if (target === undefined) continue;
    if (typeof target !== "string") {
      failures.push(`${field} must be a string when present`);
      continue;
    }
    if (isTypeScriptTarget(target)) failures.push(`${field} points to TypeScript target ${target}`);
    if (field === "main" && !requiresJavaScript(target)) failures.push(`${field} points to ${target}, expected a JavaScript module`);
  }
  const exports = manifest.exports ?? {};
  for (const [key, value] of Object.entries(exports)) {
    if (key === "./package.json" || key.startsWith("./schema/")) continue;
    for (const target of exportTargets(value)) {
      if (isTypeScriptTarget(target)) failures.push(`${key} exports TypeScript target ${target}`);
      if (!requiresJavaScript(target) && !/\.d\.[cm]?ts$/.test(target)) failures.push(`${key} exports ${target}, expected a JavaScript module`);
    }
  }
  const tsFiles = srcFiles.filter((file) => /\.(?:[cm]?ts|tsx)$/.test(file));
  if (tsFiles.length > 0) failures.push(`src contains TypeScript runtime files: ${tsFiles.join(", ")}`);
  const bin = manifest.bin;
  if (bin !== undefined && bin !== null && typeof bin === "object") {
    for (const [name, target] of Object.entries(bin)) {
      if (typeof target !== "string" || !requiresJavaScript(target)) failures.push(`bin ${name} points to ${String(target)}, expected a JavaScript module`);
    }
  }
  return failures;
}

async function listFiles(dir) {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

/** Read a package directory and audit its direct Node runtime boundary. */
export async function auditPackageBoundary(packageDir) {
  const dir = path.resolve(packageDir);
  const manifestPath = path.join(dir, "package.json");
  if (!existsSync(manifestPath)) throw new Error(`No package.json found at ${manifestPath}`);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const srcFiles = (await listFiles(path.join(dir, "src"))).map((file) => path.relative(dir, file));
  const failures = packageBoundaryFailures({ manifest, srcFiles });
  const name = typeof manifest.name === "string" ? manifest.name : dir;
  return { name, ok: failures.length === 0, failures };
}
