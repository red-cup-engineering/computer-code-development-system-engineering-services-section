/**
 * @packageDocumentation
 *
 * monitoring/source-code/workspace/import-audit - declared dependencies cross-referenced against real imports.
 *
 * `workspaceDependencyGraphOf` (./index.mts) only ever reads a package's
 * declared `dependencies` field — it has no way to know whether any source
 * file actually imports what's declared, or imports something that isn't.
 * the source-code topology monitor already parses every file's imports
 * through the real TypeScript AST, one package at a time, and already records
 * bare (non-relative) specifiers as `externalImports` and relative imports as
 * root-relative paths — including ones that resolve outside the package root,
 * which show up with a leading `../`. Both facts already exist; this module
 * is the missing cross-reference between them, not a new filesystem read.
 *
 * @metroplatSubject source-code
 */
import path from "node:path";

import {
  workspaceCrossPackageRelativeImportContract,
  workspaceImportAuditContract,
  workspacePhantomImportContract,
  workspaceStaleDependencyContract,

} from "./schema.mjs";

/** The npm package name a bare import specifier resolves under: the whole
 *  first segment for an unscoped `pkg/sub/path`, or `@scope/pkg` for a scoped one. */
function packageNameOfSpecifier(specifier) {
  const segments = specifier.split("/");
  if (specifier.startsWith("@")) return segments.slice(0, 2).join("/");
  return segments[0];
}

/** Thrown when a resolved workspace root (optionally narrowed by `paths`) admits no package.json outside node_modules. */

/**
 * The refusal for an empty audited workspace: an empty root, or a `paths`
 * scope that resolves to no discovered package, is never reported as a clean
 * audit (a gate that finds nothing because it looked nowhere passes
 * vacuously).
 *
 * @param root - the resolved workspace root the audit was asked to cover
 * @returns an `Error` also carrying `{ code: "WORKSPACE_ROOT_EMPTY", root }`
 */
export function workspaceRootEmptyRefusal(root) {
  const error = new Error(
    `workspace-import-audit: resolved root admits no package.json outside node_modules: ${root}`,
  );
  return Object.assign(error, { code: "WORKSPACE_ROOT_EMPTY", root });
}

/**
 * Cross-reference the declared workspace dependency graph against each
 * package's own TypeScript-AST-derived imports: a package importing a
 * sibling workspace package's bare specifier without declaring it is a
 * phantom import (it only works today because pnpm's own linking, or a
 * hoisted install, is more permissive than the manifest claims); a declared
 * workspace dependency no source file ever imports is stale; and a relative
 * import whose resolved target falls under a *different* package's root
 * reaches a sibling by filesystem path instead of by package name, which
 * breaks the moment either package is packed or published independently.
 *
 * @throws {WorkspaceRootEmptyRefusal} when `input.graph` admits no package.
 */
export function workspaceImportAuditOf(input) {
  const { graph, topologyByPackage } = input;
  if (graph.nodes.length === 0) throw workspaceRootEmptyRefusal(graph.root);
  const internalNames = new Set(graph.nodes.map((node) => node.name));
  const declaredByConsumer = new Map(graph.nodes.map((node) => [node.name, new Set(node.dependencies)]));
  // Longest root first so a package nested inside another package's directory
  // resolves to its own, more specific root rather than its host's.
  const rootByPackage = graph.nodes
    .map((node) => ({ name: node.name, root: path.resolve(node.root) }))
    .sort((a, b) => b.root.length - a.root.length);

  const packageOfRoot = (absolute) =>
    rootByPackage.find(({ root }) => absolute === root || absolute.startsWith(root + path.sep))?.name;

  const phantomImports = [];
  const staleDependencies = [];
  const crossPackageRelativeImports = [];

  for (const [consumer, topology] of topologyByPackage) {
    const declared = declaredByConsumer.get(consumer) ?? new Set();
    const importedFromByProvider = new Map();

    for (const moduleEntry of topology.modules) {
      for (const specifier of moduleEntry.externalImports) {
        const provider = packageNameOfSpecifier(specifier);
        if (provider === consumer || !internalNames.has(provider)) continue;
        const files = importedFromByProvider.get(provider);
        if (files === undefined) importedFromByProvider.set(provider, [moduleEntry.path]);
        else files.push(moduleEntry.path);
      }
      for (const relativeImport of moduleEntry.imports) {
        if (!relativeImport.startsWith("../")) continue;
        const absoluteTarget = path.resolve(topology.root, relativeImport);
        const target = packageOfRoot(absoluteTarget);
        if (target === undefined || target === consumer) continue;
        crossPackageRelativeImports.push(workspaceCrossPackageRelativeImportContract.assert({
          consumer,
          file: moduleEntry.path,
          target: relativeImport,
          resolvesInto: target,
        }, `cross-package relative import ${consumer}:${moduleEntry.path}`));
      }
    }

    for (const [provider, files] of importedFromByProvider) {
      if (declared.has(provider)) continue;
      phantomImports.push(workspacePhantomImportContract.assert({
        consumer,
        provider,
        importedFrom: Object.freeze([...new Set(files)].sort()),
      }, `phantom import ${consumer}->${provider}`));
    }
    for (const provider of declared) {
      if (importedFromByProvider.has(provider)) continue;
      staleDependencies.push(workspaceStaleDependencyContract.assert({
        consumer,
        provider,
      }, `stale dependency ${consumer}->${provider}`));
    }
  }

  return workspaceImportAuditContract.assert({
    kind: "metroplat.workspace-graph.import-audit",
    packagesAudited: Object.freeze([...topologyByPackage.keys()].sort()),
    phantomImports: Object.freeze(
      phantomImports.sort((a, b) => a.consumer.localeCompare(b.consumer) || a.provider.localeCompare(b.provider)),
    ),
    staleDependencies: Object.freeze(
      staleDependencies.sort((a, b) => a.consumer.localeCompare(b.consumer) || a.provider.localeCompare(b.provider)),
    ),
    crossPackageRelativeImports: Object.freeze(
      crossPackageRelativeImports.sort((a, b) => a.consumer.localeCompare(b.consumer) || a.file.localeCompare(b.file)),
    ),
  }, "workspace import audit");
}
