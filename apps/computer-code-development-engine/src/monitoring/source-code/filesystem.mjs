/**
 * @packageDocumentation
 *
 * Admitted source-corpus adapter and module-corpus view shared by MetroPlat's source monitors.
 *
 * @metroplatSubject source-code
 */
import path from "node:path";
import { indexModuleCorpus } from "@red-cup-engineering/javascript-computer";

import { artifactId } from "@red-cup-engineering/semiotic-eavt-services-section/identity";
import { canonicalJson } from "@red-cup-engineering/json-services-section";

export const DEFAULT_SOURCE_DIRECTORIES = Object.freeze(["lib", "src", "services"]);
export const DEFAULT_SOURCE_FILE_LIMIT = 2_000;

/** One exact, location-independent admission of the source corpus both monitors consume. */

const programByCorpus = new WeakMap();
const admittedPathsByCorpus = new WeakMap();

const SOURCE_EXTENSIONS = Object.freeze([".mjs", ".cjs", ".js"]);

function normalizedPath(value) {
  return path.normalize(value);
}

function admittedPaths(corpus) {
  const cached = admittedPathsByCorpus.get(corpus);
  if (cached !== undefined) return cached;
  const indexed = new Map(corpus.files.map((file) => [normalizedPath(file.absolutePath), file.absolutePath]));
  admittedPathsByCorpus.set(corpus, indexed);
  return indexed;
}

function extensionCandidates(specifierPath) {
  const extension = path.extname(specifierPath);
  if (extension.length > 0) return Object.freeze([specifierPath]);
  return Object.freeze([...SOURCE_EXTENSIONS.map((candidate) => `${specifierPath}${candidate}`), ...SOURCE_EXTENSIONS.map((candidate) => path.join(specifierPath, `index${candidate}`))]);
}

/** Resolve only a relative specifier to bytes already admitted into this corpus.
 * This is deliberately an index lookup rather than Node's filesystem/package
 * resolver: a monitor read cannot pull an unbounded dependency graph into its
 * evidence boundary. */
export function sourceModuleResolvedPath(
  corpus,
  specifier,
  containingFile,
) {
  if (!specifier.startsWith(".")) return undefined;
  const admitted = admittedPaths(corpus);
  const base = normalizedPath(path.resolve(path.dirname(containingFile), specifier));
  for (const candidate of extensionCandidates(base)) {
    const resolved = admitted.get(normalizedPath(candidate));
    if (resolved !== undefined) return resolved;
  }
  return undefined;
}

/** The stable coordinate for a relative edge. Existing admitted bytes win;
 * absent relative imports retain their NodeNext source-coordinate spelling so
 * policy can report them as unresolved instead of silently erasing them. */
export function sourceModuleSpecifierPath(
  corpus,
  specifier,
  containingFile,
) {
  const resolved = sourceModuleResolvedPath(corpus, specifier, containingFile);
  if (resolved !== undefined) return resolved;
  const base = normalizedPath(path.resolve(path.dirname(containingFile), specifier));
  return extensionCandidates(base)[0] ?? base;
}

/** One module-corpus view over the exact bytes admitted by a source corpus.
 * Repeated analyses of the same corpus share its immutable syntax trees, and
 * only specifiers resolving into the corpus are followed. */
export function sourceModuleProgram(corpus) {
  const cached = programByCorpus.get(corpus);
  if (cached !== undefined) return cached;
  const program = indexModuleCorpus({
    files: corpus.files,
    resolve: (specifier, containingFile) => sourceModuleResolvedPath(corpus, specifier, containingFile),
  });
  programByCorpus.set(corpus, program);
  return program;
}

/** Recover one admitted module (`{ fileName, text, program }`, its ESTree
 * program) from its corpus view without reparsing it. */
export function sourceModuleSyntax(program, material) {
  const source = program.modules.get(material.absolutePath);
  if (source === undefined) throw new TypeError(`admitted source module is absent from its corpus view: ${material.path}`);
  return source;
}

function sourceModuleManifest(corpus)

 {
  return Object.freeze({
    kind: "metroplat.monitoring.source-code.corpus",
    sourceDirs: corpus.sourceDirs,
    truncated: corpus.truncated,
    files: Object.freeze(corpus.files.map((file) => Object.freeze({ path: file.path, content: file.identity }))),
  });
}

/** Discover source modules once under one explicit filesystem policy. */
export function sourceModuleFiles(root, sourceDirectories, options) {
  const files = [];
  for (const sourceDirectory of sourceDirectories) {
    const start = path.join(root, sourceDirectory);
    if (!options.pathExists(start)) continue;
    files.push(...options.walkFiles(start, {
      skipSymbolicLinks: true,
      pruneDirectory: (name, full) =>
        name === "node_modules"
        || name === "dist"
        || name === ".tmp"
        || name === ".git"
        || path.resolve(full) === path.resolve(root, "lib", "legacy"),
      includeFile: (_name, full) =>
        /\.[cm]?js$/u.test(full)
        && !full.includes(`${path.sep}test${path.sep}`),
    }));
  }
  return Object.freeze(files.sort((left, right) => left.localeCompare(right)));
}

export function sourceModuleRelativePath(root, full) {
  return path.relative(path.resolve(root), full).split(path.sep).join("/");
}

/** Discover and read source files once, content-addressing the exact admitted corpus. */
export function readSourceModuleCorpus(
  root,
  sourceDirectories,
  maxFiles,
  options,
) {
  const rootAbsolute = path.resolve(root);
  const discovered = sourceModuleFiles(rootAbsolute, sourceDirectories, options);
  const truncated = discovered.length > maxFiles;
  const selected = truncated ? discovered.slice(0, maxFiles) : discovered;
  const files = [];
  for (const absolutePath of selected) {
    try {
      const content = options.readFileUtf8(absolutePath);
      files.push(Object.freeze({
        path: sourceModuleRelativePath(rootAbsolute, absolutePath),
        absolutePath,
        content,
        identity: artifactId(content),
      }));
    } catch {
      // Unreadable material is not falsely included in the admitted corpus.
    }
  }
  const sourceDirs = Object.freeze([...new Set(sourceDirectories)].sort());
  const frozenFiles = Object.freeze(files);
  const source = artifactId(sourceModuleManifest({ sourceDirs, truncated, files: frozenFiles }));
  return Object.freeze({
    kind: "metroplat.monitoring.source-code.corpus",
    root: rootAbsolute,
    sourceDirs,
    truncated,
    files: frozenFiles,
    source,
  });
}

/** Exact canonical source-string artifacts already admitted by this corpus read. */
export function sourceModuleArtifacts(corpus) {
  const byIdentity = new Map();
  byIdentity.set(corpus.source, Object.freeze({
    ref: corpus.source,
    canonicalText: canonicalJson(sourceModuleManifest(corpus)),
  }));
  for (const file of corpus.files) {
    if (!byIdentity.has(file.identity)) {
      byIdentity.set(file.identity, Object.freeze({
        ref: file.identity,
        canonicalText: canonicalJson(file.content),
      }));
    }
  }
  return Object.freeze([...byIdentity.values()].sort((left, right) => left.ref.localeCompare(right.ref)));
}

export function sourceModuleConfinedPath(root, relative) {
  const rootAbsolute = path.resolve(root);
  const full = path.resolve(rootAbsolute, relative);
  if (full !== rootAbsolute && !full.startsWith(rootAbsolute + path.sep)) {
    throw new TypeError("source module path escapes the monitored package root");
  }
  return full;
}
