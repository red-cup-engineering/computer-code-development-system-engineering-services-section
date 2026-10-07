/**
 * @packageDocumentation
 *
 * src/monitoring/filesystem/legibility - whole-conurbation material-legibility census.
 *
 * The operator's standing measurement: every byte on disk eventually becomes
 * legible — either plate material at a known artifact tier, schema-admitted
 * material, or honestly dark. This service walks the
 * conurbation the one way monitoring/filesystem/file-census already walks it (its own
 * exported `walkFileCensus`, same prune exclusions — no second walker),
 * classifies each file's path alone through core/persistence/legibility's
 * structural law (plate tier, sidecar, carried codec form read off
 * src/core/codecs/legibility's admitted-extension reading, host tooling, or
 * dark), and reports per-class and per-tree file/byte counts, the
 * legibility ratio, and a capped, honestly-reported sample of dark paths.
 *
 * Byte counts are exhaustive, not sampled: a `stat` per file (no content
 * read) measured at ~5.7s over the whole ~147K-file conurbation on this
 * host, close to monitoring/filesystem/file-census's own ~2-3s dirent walk and well within
 * an on-demand read's budget. An earlier per-tree sampling cap (mirroring
 * file-census's content-read cap) was tried and dropped: undersampling the
 * conurbation's largest trees (`lib/emsenn/lib` at 122K files) skewed the
 * legibility ratio from a real 0.56 to a misleading 0.99, exactly the silent-
 * truncation failure mode this measurement exists to avoid. A `stat` that
 * fails (permission, broken symlink, race) is counted, never silently
 * dropped from the byte totals' denominator.
 */
import path from "node:path";

import { classifyLegibility } from "@red-cup-engineering/computer-system-engine/addressing/legibility";
import { operation } from "@red-cup-engineering/computer-system-engine/rpc/operation";
import { codecAdmissibleExtensions } from "@red-cup-engineering/computer-system-engine/addressing/codec-legibility";

import {
  legibilityReadContract as legibilityReadSchemaContract,
  legibilityReadRequestContract,

} from "./schema.mjs";
import { walkFileCensus } from "../file-census/service.mjs";

export { legibilityReadSchemaContract };

function inputRecord(input) {
  return input !== null && typeof input === "object" && !Array.isArray(input) ? input : {};
}

function optionalNonnegativeInteger(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}

const DEFAULT_DARK_SAMPLE_CAP = 50;

/** Read one conurbation's whole-tree material-legibility census. */
export function readLegibility(root, options) {
  const rootAbs = path.resolve(root);
  const darkSampleCap = options.darkSampleCap ?? DEFAULT_DARK_SAMPLE_CAP;
  const files = walkFileCensus(rootAbs, options);

  const classFiles = new Map();
  const classBytes = new Map();
  const treeFiles = new Map();
  const treeDarkFiles = new Map();
  const treeClassFiles = new Map();
  const treeBytes = new Map();
  const treeDarkBytes = new Map();
  const treeStatFailures = new Map();

  let totalBytes = 0;
  let darkBytes = 0;
  let darkTotal = 0;
  let statFailures = 0;
  const darkSample = [];

  for (const file of files) {
    const relative = path.relative(rootAbs, file.full).split(path.sep).join("/");
    const materialClass = classifyLegibility(relative, file.extension, codecAdmissibleExtensions);

    classFiles.set(materialClass, (classFiles.get(materialClass) ?? 0) + 1);
    treeFiles.set(file.tree, (treeFiles.get(file.tree) ?? 0) + 1);
    let treeClasses = treeClassFiles.get(file.tree);
    if (treeClasses === undefined) {
      treeClasses = new Map();
      treeClassFiles.set(file.tree, treeClasses);
    }
    treeClasses.set(materialClass, (treeClasses.get(materialClass) ?? 0) + 1);

    if (materialClass === "dark") {
      darkTotal += 1;
      treeDarkFiles.set(file.tree, (treeDarkFiles.get(file.tree) ?? 0) + 1);
      if (darkSample.length < darkSampleCap) darkSample.push(relative);
    }

    const stat = options.statPathOrNull(file.full);
    if (stat === null) {
      statFailures += 1;
      treeStatFailures.set(file.tree, (treeStatFailures.get(file.tree) ?? 0) + 1);
      continue;
    }
    totalBytes += stat.size;
    treeBytes.set(file.tree, (treeBytes.get(file.tree) ?? 0) + stat.size);
    classBytes.set(materialClass, (classBytes.get(materialClass) ?? 0) + stat.size);
    if (materialClass === "dark") {
      darkBytes += stat.size;
      treeDarkBytes.set(file.tree, (treeDarkBytes.get(file.tree) ?? 0) + stat.size);
    }
  }

  const classes = [...classFiles.keys()].sort().map((materialClass) => Object.freeze({
    class: materialClass,
    files: classFiles.get(materialClass) ?? 0,
    bytes: classBytes.get(materialClass) ?? 0,
  }));

  const trees = [...treeFiles.keys()].sort().map((tree) => Object.freeze({
    path: tree,
    files: treeFiles.get(tree) ?? 0,
    darkFiles: treeDarkFiles.get(tree) ?? 0,
    bytes: treeBytes.get(tree) ?? 0,
    darkBytes: treeDarkBytes.get(tree) ?? 0,
    statFailures: treeStatFailures.get(tree) ?? 0,
    classes: Object.freeze([...(treeClassFiles.get(tree)?.entries() ?? [])]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .map(([materialClass, count]) => Object.freeze({ class: materialClass, files: count }))),
  }));

  const legibilityRatio = totalBytes === 0 ? null : (totalBytes - darkBytes) / totalBytes;

  const boundary = Object.freeze({
    root: rootAbs,
    files: files.length,
    legibilityRatio,
    classes,
    trees,
    darkTotal,
    darkSampleCap,
    statFailures,
  });
  return legibilityReadSchemaContract.assert(Object.freeze({
    kind: "metroplat.legibility.read",
    operation: "read-legibility",
    root: rootAbs,
    files: files.length,
    legibilityRatio,
    classes: Object.freeze(classes),
    trees: Object.freeze(trees),
    darkTotal,
    darkSampleCap,
    darkSample: Object.freeze(darkSample),
    statFailures,
  }), "Legibility read");
}

export function legibilityOperations(binding) {
  return Object.freeze([
    operation({
      verb: "legibility",
      inputFormat: "json",
      outputFormat: "json",
      summary: "Read a filesystem root's material-legibility census.",
      description: "Domain: { root?, darkSampleCap? }. Defaults root to the service binding dataRoot.",
      codomain: legibilityReadSchemaContract,
      run: (input) => {
        const record = inputRecord(input);
        const darkSampleCap = optionalNonnegativeInteger(record["darkSampleCap"]);
        const request = legibilityReadRequestContract.assert(Object.freeze({
          kind: "metroplat.legibility.read-request",
          root: typeof record["root"] === "string" && record["root"].length > 0 ? record["root"] : binding.dataRoot,
          ...(darkSampleCap === undefined ? {} : { darkSampleCap }),
        }), "legibility input");
        return readLegibility(request.root, {
          ...binding,
          ...(request.darkSampleCap === undefined ? {} : { darkSampleCap: request.darkSampleCap }),
        });
      },
    }),
  ]);
}
