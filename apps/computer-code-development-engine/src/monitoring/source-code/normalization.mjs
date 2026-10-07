/**
 * @packageDocumentation
 *
 * Source carrier normalization derived from observed topology and an explicit
 * architecture policy. The existing tree is never accepted as its own target.
 *
 * @metroplatSubject source-code
 */

import path from "node:path";

import { artifactId } from "@red-cup-engineering/semiotic-eavt-services-section/identity";
import { nodeBeingLayerFilenameSuffixes, nodeBeingLayerOfFilenameSuffix } from "@red-cup-engineering/communicating/language/jsnode/taxonomy";

import {
  nodePackageLayerNames,

} from "./topology/schema.mjs";
import { nodePackageLayoutConventionOfPath } from "./topology/placement.mjs";

const nonemptyStringSequenceSchema = { type: "array", items: { type: "string", minLength: 1 } };
const artifactReferenceSequenceSchema = {
  type: "array",
  minItems: 1,
  items: { type: "string", pattern: "^ni:///sha-256;[A-Za-z0-9_-]{43}$" },
};

export const moduleTopologyNormalizationCutSchema = {
  type: "object",
  required: ["kind", "identity", "action", "from", "to", "symbols", "formulas", "layer", "packageRegion", "contextStatus", "confidence", "reasons"],
  additionalProperties: false,
  properties: {
    kind: { const: "metroplat.monitoring.source-code.normalization-cut" },
    identity: { type: "string", minLength: 1 },
    action: { const: "move-module" },
    from: { type: "string", minLength: 1 },
    to: { type: "string", minLength: 1 },
    symbols: nonemptyStringSequenceSchema,
    formulas: artifactReferenceSequenceSchema,
    layer: { enum: nodePackageLayerNames },
    packageRegion: { enum: ["source", "integration", "library", "application"] },
    contextStatus: { enum: ["anchored", "cross-cutting"] },
    context: { type: "string", minLength: 1 },
    confidence: { const: "reified" },
    reasons: nonemptyStringSequenceSchema,
  },
};

function hasPlacementWitness(symbol) {
  return symbol.placement.kind === "metroplat.monitoring.source-code.placement:witness";
}

function normalizationTarget(
  modulePath,
  placement,
  convention,
) {
  const sourceBase = path.posix.basename(modulePath).replace(/\.(?:[cm]?[jt]sx?)$/u, "");
  const sourceExtension = path.posix.extname(modulePath) || ".mts";
  const root = placement.packageRegion === "integration" ? "src/integrations" : "src";
  const context = placement.context;
  if (convention === "context-directory-layer-filename") {
    const directory = context === undefined ? root : path.posix.join(root, context);
    const suffix = nodeBeingLayerFilenameSuffixes[placement.layer];
    const observedSuffix = sourceBase.split(".").at(-1) ?? "";
    const fileBase = nodeBeingLayerOfFilenameSuffix(observedSuffix) === placement.layer
      ? sourceBase
      : `${sourceBase}.${suffix}`;
    return path.posix.join(directory, `${fileBase}${sourceExtension}`);
  }
  const axes = convention === "context-layer-directories"
    ? [context, placement.layer]
    : [placement.layer, context];
  return path.posix.join(root, ...axes.filter((axis) => axis !== undefined), `${sourceBase}${sourceExtension}`);
}

export function normalizationConventionOfPolicies(
  policies,
) {
  const candidates = [...new Set(policies.flatMap((policy) =>
    policy.layoutConvention === undefined ? [] : [policy.layoutConvention]))].sort();
  if (candidates.length === 1) {
    return Object.freeze({
      convention: candidates[0],
      reasons: Object.freeze([`target package layout convention declared by policy: ${candidates[0]}`]),
    });
  }
  return Object.freeze({
    reasons: Object.freeze(candidates.length === 0
      ? ["no source-code policy declares a target package layout convention"]
      : [`source-code policies declare incompatible target package layout conventions: ${candidates.join(", ")}`]),
  });
}

/** Derive carrier cuts from observed categorical placement and one explicitly
 * declared target convention. */
export function normalizationCutsForModule(
  moduleEntry,
  conventionReading,
) {
  const { path: modulePath, symbols = [], symbolClusters: clusters = [] } = moduleEntry;
  if (symbols.length === 0) return Object.freeze([]);
  const placedSymbols = symbols.filter(hasPlacementWitness);
  // An obstruction is a topology result, not a carrier transformation. It
  // remains available on the module and symbol readings without being copied
  // into policy as a pseudo-cut.
  if (placedSymbols.length !== symbols.length || conventionReading.convention === undefined) return Object.freeze([]);
  const keyOf = (symbol) => [
    symbol.placement.packageRegion,
    symbol.placement.context ?? `_${symbol.placement.contextStatus}`,
    symbol.placement.layer,
  ].join("|");
  const groups = new Map();
  const keyByName = new Map();
  for (const symbol of placedSymbols) {
    const key = keyOf(symbol);
    keyByName.set(symbol.name, key);
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [symbol]);
    else group.push(symbol);
  }
  const crossesPlacement = clusters.some((cluster) =>
    new Set(cluster.map((name) => keyByName.get(name)).filter((key) => key !== undefined)).size > 1);
  if (groups.size !== 1 || crossesPlacement) return Object.freeze([]);
  const group = [...groups.values()][0];
  const placement = group[0].placement;
  if (group.some((symbol) => symbol.placement.ambiguous || symbol.placement.confidence !== "reified")) return Object.freeze([]);
  const currentCarrierConvention = nodePackageLayoutConventionOfPath(".", modulePath);
  const currentOwnerMatches = group.every((symbol) =>
    symbol.placement.actualPackageRegion === symbol.placement.packageRegion
    && symbol.placement.contextMatches === true)
    && (currentCarrierConvention === undefined
      || currentCarrierConvention === conventionReading.convention);
  if (currentOwnerMatches) return Object.freeze([]);
  const to = normalizationTarget(modulePath, placement, conventionReading.convention);
  if (to === modulePath) return Object.freeze([]);
  const material = Object.freeze({
    kind: "metroplat.monitoring.source-code.normalization-cut",
    action: "move-module",
    from: modulePath,
    to,
    symbols: Object.freeze(group.map((symbol) => symbol.name).sort()),
    formulas: Object.freeze([...new Set(group.map((symbol) => symbol.being.formula.identity))].sort()),
    layer: placement.layer,
    packageRegion: placement.packageRegion,
    contextStatus: placement.contextStatus,
    ...(placement.context === undefined ? {} : { context: placement.context }),
    confidence: "reified",
    reasons: Object.freeze([
      "all declarations share one reified categorical placement",
      ...conventionReading.reasons,
      placement.packageRegionReason,
    ]),
  });
  return Object.freeze([Object.freeze({ ...material, identity: artifactId(material) })]);
}
