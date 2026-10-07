/**
 * @packageDocumentation
 *
 * src/monitoring/filesystem/file-census - live filesystem file/line scale census.
 *
 * This service owns filesystem traversal of one bounded root and reports how
 * much file material is actually there:
 * exhaustive file and per-extension counts bucketed by major tree, plus
 * source line counts sampled per tree within a bounded content-read budget.
 * Unlike monitoring/source-code topology (one package's own TypeScript AST), this
 * walk crosses every language generation the root holds, so it counts raw
 * lines rather than parsing a single grammar.
 */
import path from "node:path";

import { operation } from "@red-cup-engineering/computer-system-engine/rpc/operation";

import {
  fileCensusReadContract as fileCensusReadSchemaContract,
  fileCensusReadRequestContract,

} from "./schema.mjs";


function inputRecord(input) {
  return input !== null && typeof input === "object" && !Array.isArray(input) ? input : {};
}

function optionalPositiveInteger(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 ? value : undefined;
}

const PRUNE_DIRS = new Set(["node_modules", ".git", "dist", ".pnpm-store"]);
// The exhaustive dirent walk over ~146K files already costs 2-3s on this host
// (WSL2 syscall overhead dominates, not disk bandwidth); these per-tree caps
// bound the additional content-sampling cost so a live derivation reliably
// finishes within the SessionStart hook's budget rather than racing it.
const DEFAULT_MAX_CONTENT_FILES_PER_TREE = 1000;
const DEFAULT_MAX_CONTENT_BYTES_PER_TREE = 8 * 1024 * 1024;

/** The major tree a relative path belongs to: the owner/kind prefix under
 *  `core/` (e.g. `lib/emsenn/lib`, `lib/561-group/sites`), else its own
 *  top-level directory name (e.g. `data`, `dev`, `.claude`). */
function majorTreeOf(relative) {
  const segments = relative.split("/");
  if (segments.length === 1) return "(root)";
  if (segments[0] === "lib" && segments.length > 3) return segments.slice(0, 3).join("/");
  return segments[0];
}

function extensionOf(name) {
  const match = /\.([a-zA-Z0-9]+)$/u.exec(name);
  return match ? match[1].toLowerCase() : "(none)";
}

/** Visit census-classified files without retaining the whole filesystem walk.
 *  `options.visitFiles` (the same filesystem effect `defaultFilesystemBinding` bundles onto a
 *  binding) is required: this module never imports `lib/filesystem/index.mjs` itself. */
export function visitFileCensus(root, visit, options) {
  options.visitFiles(root, (full) => {
    const relative = path.relative(root, full).split(path.sep).join("/");
    visit({ full, tree: majorTreeOf(relative), extension: extensionOf(path.basename(full)) });
  }, {
    skipSymbolicLinks: true,
    pruneDirectory: (name) => PRUNE_DIRS.has(name),
  });
}

/** Walk a filesystem tree the one way monitoring/filesystem/file-census walks it (pruning
 *  node_modules/.git/dist/.pnpm-store, skipping symlinks), bucketing each file
 *  by major tree and extension. monitoring/filesystem/legibility reuses this directly
 *  rather than walking the tree a second time under a second set of rules. */
export function walkFileCensus(root, options) {
  const files = [];
  visitFileCensus(root, (file) => files.push(file), options);
  return Object.freeze(files);
}

function countLines(buffer) {
  let lines = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    if (buffer[index] === 10) lines += 1;
  }
  return lines;
}

/** Read a filesystem root's file/line scale, bucketed by major tree and extension.
 *  File and extension counts are exhaustive; line counts are sampled per tree
 *  up to `maxContentFilesPerTree`/`maxContentBytesPerTree`. */
export function readFileCensus(root, options) {
  const rootAbs = path.resolve(root);
  const maxContentFilesPerTree = options.maxContentFilesPerTree ?? DEFAULT_MAX_CONTENT_FILES_PER_TREE;
  const maxContentBytesPerTree = options.maxContentBytesPerTree ?? DEFAULT_MAX_CONTENT_BYTES_PER_TREE;
  const files = options.pathExists(rootAbs) ? walkFileCensus(rootAbs, options) : [];

  const treeFiles = new Map();
  const treeExtensionFiles = new Map();
  const treeLoc = new Map();
  const treeSampledFiles = new Map();
  const treeSampledBytes = new Map();
  const treeTruncated = new Set();

  let totalLoc = 0;

  for (const file of files) {
    treeFiles.set(file.tree, (treeFiles.get(file.tree) ?? 0) + 1);
    let extensionCounts = treeExtensionFiles.get(file.tree);
    if (extensionCounts === undefined) {
      extensionCounts = new Map();
      treeExtensionFiles.set(file.tree, extensionCounts);
    }
    extensionCounts.set(file.extension, (extensionCounts.get(file.extension) ?? 0) + 1);

    const sampledFiles = treeSampledFiles.get(file.tree) ?? 0;
    const sampledBytes = treeSampledBytes.get(file.tree) ?? 0;
    if (sampledFiles >= maxContentFilesPerTree || sampledBytes >= maxContentBytesPerTree) {
      treeTruncated.add(file.tree);
      continue;
    }
    let buffer;
    try {
      buffer = options.readFileBuffer(file.full);
    } catch {
      continue;
    }
    treeSampledFiles.set(file.tree, sampledFiles + 1);
    treeSampledBytes.set(file.tree, sampledBytes + buffer.length);
    const lines = countLines(buffer);
    totalLoc += lines;
    treeLoc.set(file.tree, (treeLoc.get(file.tree) ?? 0) + lines);
  }

  const trees = [...treeFiles.keys()].sort().map((tree) => {
    const extensions = [...(treeExtensionFiles.get(tree)?.entries() ?? [])]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .map(([extension, count]) => Object.freeze({ extension, files: count }));
    return Object.freeze({
      path: tree,
      files: treeFiles.get(tree) ?? 0,
      loc: treeLoc.get(tree) ?? 0,
      truncated: treeTruncated.has(tree),
      extensions: Object.freeze(extensions),
    });
  });

  const truncated = treeTruncated.size > 0;
  const boundary = Object.freeze({ root: rootAbs, files: files.length, loc: totalLoc, truncated, trees });
  return fileCensusReadSchemaContract.assert(Object.freeze({
    kind: "metroplat.file-census.read",
    operation: "read-file-census",
    root: rootAbs,
    files: files.length,
    loc: totalLoc,
    truncated,
    trees: Object.freeze(trees),
  }), "File census read");
}

export function fileCensusOperations(binding) {
  return Object.freeze([
    operation({
      verb: "file-census",
      inputFormat: "json",
      outputFormat: "json",
      summary: "Read a filesystem root's file and source-line scale.",
      description: "Domain: { root?, maxContentFilesPerTree?, maxContentBytesPerTree? }. Defaults root to the service binding dataRoot.",
      codomain: fileCensusReadSchemaContract,
      run: (input) => {
        const record = inputRecord(input);
        const maxContentFilesPerTree = optionalPositiveInteger(record["maxContentFilesPerTree"]);
        const maxContentBytesPerTree = optionalPositiveInteger(record["maxContentBytesPerTree"]);
        const request = fileCensusReadRequestContract.assert(Object.freeze({
          kind: "metroplat.file-census.read-request",
          root: typeof record["root"] === "string" && record["root"].length > 0 ? record["root"] : binding.dataRoot,
          ...(maxContentFilesPerTree === undefined ? {} : { maxContentFilesPerTree }),
          ...(maxContentBytesPerTree === undefined ? {} : { maxContentBytesPerTree }),
        }), "file-census input");
        return readFileCensus(request.root, {
          ...binding,
          ...(request.maxContentFilesPerTree === undefined ? {} : { maxContentFilesPerTree: request.maxContentFilesPerTree }),
          ...(request.maxContentBytesPerTree === undefined ? {} : { maxContentBytesPerTree: request.maxContentBytesPerTree }),
        });
      },
    }),
  ]);
}

export { fileCensusReadSchemaContract };
