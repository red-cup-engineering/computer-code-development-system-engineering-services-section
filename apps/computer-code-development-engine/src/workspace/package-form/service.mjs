/**
 * @packageDocumentation
 *
 * integrations/filesystem/services/package-form/service - normalize JS/Node
 * package-form carriers.
 *
 * This is the host boundary for turning a measured package-form rehome into
 * filesystem carrier changes. The operation is intentionally not a blind move:
 * it reads package/module carriers, plans carrier movement plus import/export
 * reference rewrites, and reports the transaction as JSNode information.
 */
import { existsSync, readdirSync, readFileSync, renameSync, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";

import { ensureDirectory } from "@red-cup-engineering/computer-system-engine/filesystem";
import { writeFileAtomic } from "@red-cup-engineering/computer-system-engine/filesystem";
import {
  packageFormNormalizationContract,

} from "./schema.mjs";

const TEXT_FILE_RE = /\.(?:mts|cts|ts|tsx|mjs|cjs|js|jsx|json|md|markdown|yaml|yml|toml)$/u;
const SOURCE_FILE_RE = /\.(?:mts|cts|ts|tsx|mjs|cjs|js|jsx)$/u;
const PRUNE_DIRS = new Set([".git", ".tmp", "coverage", "data", "dist", "node_modules"]);

function normalizeRootRelative(value) {
  return value.replace(/\\/gu, "/").replace(/^\/+/u, "").replace(/\/+$/u, "");
}

function confinedPath(root, relative) {
  const rootAbs = path.resolve(root);
  const full = path.resolve(rootAbs, relative);
  const rel = path.relative(rootAbs, full);
  if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error(`package-form normalization path escapes root: ${relative}`);
  return full;
}

function slashPath(value) {
  return value.split(path.sep).join("/");
}

function isWithin(parent, candidate) {
  const rel = path.relative(parent, candidate);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function movedPath(candidate, fromAbs, toAbs) {
  return isWithin(fromAbs, candidate)
    ? path.join(toAbs, path.relative(fromAbs, candidate))
    : candidate;
}

async function walkTextFiles(root) {
  const files = [];
  async function walk(current) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (PRUNE_DIRS.has(entry.name)) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (TEXT_FILE_RE.test(entry.name)) files.push(full);
    }
  }
  await walk(root);
  return Object.freeze(files.sort());
}

function countFiles(root) {
  let count = 0;
  const visit = (current) => {
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (PRUNE_DIRS.has(entry.name)) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) visit(full);
      else count += 1;
    }
  };
  visit(root);
  return count;
}

function replaceAllCount(text, search, replacement) {
  if (search.length === 0) return { text, count: 0 };
  const count = text.split(search).length - 1;
  return { text: count === 0 ? text : text.split(search).join(replacement), count };
}

function sourcePathForSpecifier(file, specifier) {
  const resolved = path.resolve(path.dirname(file), specifier);
  if (specifier.endsWith(".mjs")) return resolved.slice(0, -".mjs".length) + ".mts";
  if (specifier.endsWith(".js")) return resolved.slice(0, -".js".length) + ".ts";
  return resolved;
}

function specifierForSourceTarget(file, targetSource, original) {
  const wanted = original.endsWith(".mjs")
    ? targetSource.slice(0, -".mts".length) + ".mjs"
    : original.endsWith(".js")
      ? targetSource.slice(0, -".ts".length) + ".js"
      : targetSource;
  let rel = slashPath(path.relative(path.dirname(file), wanted));
  if (!rel.startsWith(".")) rel = `./${rel}`;
  return rel;
}

function rewriteRelativeSpecifiers(text, sourceFile, fromAbs, toAbs) {
  let count = 0;
  const destinationFile = movedPath(sourceFile, fromAbs, toAbs);
  const sourceFileMoves = isWithin(fromAbs, sourceFile);
  const rewritten = text.replace(/((?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?|import\s*\(\s*)(["'])([^"']+)\2/gu, (match, prefix, quote, specifier) => {
    if (!specifier.startsWith(".")) return match;
    const sourceTarget = sourcePathForSpecifier(sourceFile, specifier);
    if (!sourceFileMoves && !isWithin(fromAbs, sourceTarget)) return match;
    const destinationTarget = movedPath(sourceTarget, fromAbs, toAbs);
    const next = specifierForSourceTarget(destinationFile, destinationTarget, specifier);
    if (next === specifier) return match;
    count += 1;
    return `${prefix}${quote}${next}${quote}`;
  });
  return Object.freeze({ text: rewritten, count });
}

async function plannedTextRewrites(
  root,
  fromRel,
  toRel,
  preservePublicSpecifier,
) {
  const fromAbs = confinedPath(root, fromRel);
  const toAbs = confinedPath(root, toRel);
  const fromPublic = fromRel.startsWith("src/") ? `@red-cup-engineering/metroplat/${fromRel.slice("src/".length)}` : undefined;
  const toPublic = toRel.startsWith("src/") ? `@red-cup-engineering/metroplat/${toRel.slice("src/".length)}` : undefined;
  const fromExportKey = fromRel.startsWith("src/") ? `./${fromRel.slice("src/".length)}` : undefined;
  const toExportKey = toRel.startsWith("src/") ? `./${toRel.slice("src/".length)}` : undefined;
  const edits = [];
  for (const file of await walkTextFiles(root)) {
    const sourcePath = slashPath(path.relative(root, file));
    const destinationPath = slashPath(path.relative(root, movedPath(file, fromAbs, toAbs)));
    let after = readFileSync(file, "utf8");
    const before = after;
    const reasons = new Set();

    if (SOURCE_FILE_RE.test(sourcePath)) {
      const result = rewriteRelativeSpecifiers(after, file, fromAbs, toAbs);
      after = result.text;
      if (result.count > 0) reasons.add("relative module specifier");
    }

    const directRewrites = [
      [`dist/${fromRel}`, `dist/${toRel}`, "emitted artifact target"],
      [fromRel, toRel, "root-relative carrier path"],
      ...(preservePublicSpecifier || fromPublic === undefined || toPublic === undefined
        ? []
        : [[fromPublic, toPublic, "package export specifier"]]),
      ...(preservePublicSpecifier || path.basename(file) !== "package.json" || fromExportKey === undefined || toExportKey === undefined
        ? []
        : [[fromExportKey, toExportKey, "package export key"]]),
    ];
    for (const [search, replacement, reason] of directRewrites) {
      const result = replaceAllCount(after, search, replacement);
      after = result.text;
      if (result.count > 0) reasons.add(reason);
    }

    if (after !== before) edits.push(Object.freeze({
      sourcePath,
      destinationPath,
      before,
      after,
      reasons: Object.freeze([...reasons].sort()),
    }));
  }
  return Object.freeze(edits);
}

function carrierMoveOf(root, fromRel, toRel, applied) {
  const fromAbs = confinedPath(root, fromRel);
  const toAbs = confinedPath(root, toRel);
  const sourceExists = existsSync(fromAbs);
  const targetExists = existsSync(toAbs);
  if (sourceExists && targetExists) {
    throw new Error(`package-form normalization found competing source and target carriers: ${fromRel} and ${toRel}`);
  }
  if (sourceExists) {
    return Object.freeze({
      from: fromRel,
      to: toRel,
      status: applied ? "applied" : "planned",
      files: statSync(fromAbs).isDirectory() ? countFiles(fromAbs) : 1,
    });
  }
  if (targetExists) {
    return Object.freeze({
      from: fromRel,
      to: toRel,
      status: "already-moved",
      files: statSync(toAbs).isDirectory() ? countFiles(toAbs) : 1,
    });
  }
  return Object.freeze({ from: fromRel, to: toRel, status: "missing-source", files: 0 });
}

export async function normalizePackageForm(input) {
  const root = path.resolve(input.root);
  const fromRel = normalizeRootRelative(input.from);
  const toRel = normalizeRootRelative(input.to);
  const apply = input.apply === true;
  const fromAbs = confinedPath(root, fromRel);
  const toAbs = confinedPath(root, toRel);
  if (fromRel === "" || toRel === "") throw new Error("package-form normalization requires non-root carrier paths");
  if (fromAbs === toAbs) throw new Error("package-form normalization source and target must differ");

  const carrierMove = carrierMoveOf(root, fromRel, toRel, apply);
  if (apply && carrierMove.status === "missing-source") {
    throw new Error(`package-form normalization source and target are both missing: ${fromRel} and ${toRel}`);
  }
  const edits = carrierMove.status === "missing-source"
    ? Object.freeze([])
    : await plannedTextRewrites(root, fromRel, toRel, input.preservePublicSpecifier === true);

  if (apply && carrierMove.status === "applied") {
    ensureDirectory(path.dirname(toAbs));
    renameSync(fromAbs, toAbs);
  }
  if (apply) {
    for (const edit of edits) writeFileAtomic(confinedPath(root, edit.destinationPath), edit.after);
  }

  const rewrites = edits.map((edit) => Object.freeze({
    path: edit.destinationPath,
    replacements: edit.before === edit.after ? 0 : 1,
    reasons: edit.reasons,
  }));

  return packageFormNormalizationContract.assert(Object.freeze({
    kind: "metroplat.jsnode.package-form.normalization",
    root,
    from: fromRel,
    to: toRel,
    applied: apply,
    carrierMove,
    rewrites: Object.freeze(rewrites),
    evidence: Object.freeze([
      "package form read as JSNode carrier region",
      "all text rewrites planned before carrier mutation",
      "relative imports resolved from original carriers and rendered between effective destination carriers",
      input.preservePublicSpecifier === true
        ? "public package specifiers preserved while physical source and emitted targets were relocated"
        : "package export specifiers and emitted dist targets included as package membrane carriers",
      "append-only data excluded from package-form rewriting",
    ]),
  }), "package form normalization");
}
