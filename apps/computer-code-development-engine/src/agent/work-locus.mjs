/**
 * work-locus — sessions claiming the workspace paths they work in: claims and releases, the
 * active claims, their overlaps, and the governance reading of the claims as jural relations.
 * A claim is a capability view over `workspace:<paths>` held by `<harness>:<session>`.
 */
import { assertNonemptyString as nonempty } from "@red-cup-engineering/json-services-section/assert-nonempty-string";
import { schemaFrom } from "@red-cup-engineering/json-schema-services-section/contracts";
import { readJuralRelations } from "@red-cup-engineering/socializing/jural";
import { governanceSchema } from "@red-cup-engineering/organizing/work/schema";
import { readingAs } from "@red-cup-engineering/computer-data-engineering-services-section/four";
import { capabilityView, capabilityViewSchema } from "@red-cup-engineering/computer-networking-engineering-services-section/object-capability";

export const workLocusClaimSchema = {
  $id: "metroplat/codecs/text/json/capability/work-locus/claim",
  title: "WorkLocusClaim",
  description: "An OCap workspace locus claim: session, paths, TTL, action, and capability view.",
  type: "object",
  required: ["kind", "action", "claimId", "session", "harness", "paths", "at", "capability"],
  properties: {
    kind: { const: "capability.work-locus.claim" },
    action: { enum: ["claim", "release"] },
    claimId: { type: "string", minLength: 1 },
    session: { type: "string", minLength: 1 },
    harness: { type: "string", minLength: 1 },
    paths: { type: "array", items: { type: "string", minLength: 1 }, minItems: 1 },
    reason: { type: "string", minLength: 1 },
    at: { type: "string", minLength: 1 },
    expiresAt: { type: "string", minLength: 1 },
    capability: capabilityViewSchema,
  },
  additionalProperties: false,
};

export const workLocusConflictSchema = {
  $id: "metroplat/codecs/text/json/capability/work-locus/conflict",
  title: "WorkLocusConflict",
  description: "An overlap between active work-locus capability claims.",
  type: "object",
  required: ["kind", "path", "left", "right", "severity"],
  properties: {
    kind: { const: "capability.work-locus.conflict" },
    path: { type: "string", minLength: 1 },
    left: workLocusClaimSchema,
    right: workLocusClaimSchema,
    severity: { enum: ["shared", "overlap"] },
  },
  additionalProperties: false,
};

export const workLocusGovernanceReadingSchema = {
  $id: "metroplat/codecs/text/json/capability/work-locus/governance",
  title: "WorkLocusGovernanceReading",
  description: "A compact governance reading over active work-locus claims and overlap conflicts, plus the real Hohfeldian/Hodge-backed governance discipline reading over the same claims read as jural relations.",
  type: "object",
  required: ["kind", "activeClaims", "conflicts", "summary", "claim", "governance"],
  properties: {
    kind: { const: "capability.work-locus.governance-reading" },
    activeClaims: { type: "array", items: workLocusClaimSchema },
    conflicts: { type: "array", items: workLocusConflictSchema },
    summary: {
      type: "object",
      required: ["monotone", "coordination", "contested", "assignments"],
      properties: {
        monotone: { type: "boolean" },
        coordination: { enum: ["coordination-free", "consensus-required"] },
        contested: { type: "number" },
        assignments: { type: "number" },
      },
      additionalProperties: false,
    },
    claim: { type: "string", minLength: 1 },
    governance: governanceSchema,
  },
  additionalProperties: false,
};

export const workLocusClaimContract = schemaFrom(workLocusClaimSchema);

export const workLocusConflictContract = schemaFrom(workLocusConflictSchema);

export const workLocusGovernanceReadingContract = schemaFrom(workLocusGovernanceReadingSchema);

  

/** @metroplatSubject capability */

function normalizedWorkPath(path) {
  const admitted = nonempty(path, "work-locus path");
  return admitted === "." ? admitted : admitted.replace(/\/+$/u, "");
}

function pathOverlaps(left, right) {
  return left === right || left === "." || right === "." || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

function compareWorkLocusEvents(
  left,
  right,
) {
  const leftTime = Date.parse(left.claim.at);
  const rightTime = Date.parse(right.claim.at);
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) return leftTime - rightTime;
  const text = left.claim.at.localeCompare(right.claim.at);
  return text === 0 ? left.index - right.index : text;
}

function workLocusExpired(claim, at) {
  if (at === undefined || claim.expiresAt === undefined) return false;
  const expiry = Date.parse(claim.expiresAt);
  const observed = Date.parse(at);
  if (Number.isFinite(expiry) && Number.isFinite(observed)) return expiry <= observed;
  return claim.expiresAt <= at;
}

export function activeWorkLocusClaims(
  claims,
  options = {},
) {
  const active = new Map();
  const admitted = claims
    .map((claim, index) => ({
      claim: workLocusClaimContract.assert(claim, "active work-locus claim"),
      index,
    }))
    .sort(compareWorkLocusEvents);
  for (const { claim } of admitted) {
    if (claim.action === "release") {
      active.delete(claim.claimId);
      continue;
    }
    if (workLocusExpired(claim, options.at)) {
      active.delete(claim.claimId);
      continue;
    }
    active.set(claim.claimId, claim);
  }
  return Object.freeze([...active.values()]);
}

export function workLocusCapability(claim) {
  const paths = unique(claim.paths.map(normalizedWorkPath), "work-locus path");
  return capabilityView({
    id: `urn:work-locus:${encodeURIComponent(nonempty(claim.claimId, "work-locus claim id"))}`,
    holder: `${nonempty(claim.harness, "work-locus harness")}:${nonempty(claim.session, "work-locus session")}`,
    grants: `workspace:${paths.join("|")}`,
  });
}

export function workLocusClaim(input

) {
  const base = {
    kind: "capability.work-locus.claim",
    action: input.action ?? "claim",
    claimId: nonempty(input.claimId, "work-locus claim id"),
    session: nonempty(input.session, "work-locus session"),
    harness: nonempty(input.harness, "work-locus harness"),
    paths: unique(input.paths.map(normalizedWorkPath), "work-locus path"),
    ...(input.reason === undefined ? {} : { reason: nonempty(input.reason, "work-locus reason") }),
    at: nonempty(input.at, "work-locus claim time"),
    ...(input.expiresAt === undefined ? {} : { expiresAt: nonempty(input.expiresAt, "work-locus expiry") }),
  };
  return workLocusClaimContract.assert(Object.freeze({
    ...base,
    capability: workLocusCapability(base),
  }), "work-locus claim");
}

export function workLocusConflicts(
  claims,
  options = {},
) {
  const active = activeWorkLocusClaims(claims, options);
  const conflicts = [];
  for (let i = 0; i < active.length; i += 1) {
    for (let j = i + 1; j < active.length; j += 1) {
      const left = active[i];
      const right = active[j];
      if (left.session === right.session && left.harness === right.harness) continue;
      for (const leftPath of left.paths) {
        for (const rightPath of right.paths) {
          if (!pathOverlaps(leftPath, rightPath)) continue;
          conflicts.push(workLocusConflictContract.assert(Object.freeze({
            kind: "capability.work-locus.conflict",
            path: leftPath.length <= rightPath.length ? leftPath : rightPath,
            left,
            right,
            severity: leftPath === rightPath ? "shared" : "overlap",
          }), "work-locus conflict"));
        }
      }
    }
  }
  return Object.freeze(conflicts);
}

/** Read every claim/release (not just the active subset) as one `claim`-kind jural
 *  relation per (session, path): active = the claiming session, passive = the harness
 *  mediating the resource, scope = the path, standing = `held` for a claim, `denied`
 *  for a release. Never a `power`/`duty` relation — work-locus claiming is
 *  consensual resource occupancy among peer sessions, not an authority hierarchy. */
function juralRelationsOfWorkLocusClaims(claims) {
  const relations = [];
  for (const entry of claims) {
    for (const path of entry.paths) {
      relations.push(Object.freeze({
        kind: "claim",
        active: entry.session,
        passive: entry.harness,
        scope: path,
        standing: readingAs("knowledge", entry.action === "claim" ? "held" : "denied"),
      }));
    }
  }
  return Object.freeze(relations);
}

export function workLocusGovernanceReading(
  claims,
  options = {},
) {
  const activeClaims = activeWorkLocusClaims(claims, options);
  const conflicts = workLocusConflicts(activeClaims, options);
  return workLocusGovernanceReadingContract.assert(Object.freeze({
    kind: "capability.work-locus.governance-reading",
    activeClaims,
    conflicts,
    summary: Object.freeze({
      monotone: true,
      coordination: conflicts.length === 0 ? "coordination-free" : "consensus-required",
      contested: conflicts.length,
      assignments: activeClaims.length,
    }),
    claim: conflicts.length === 0
      ? "Active work-locus capabilities are disjoint for this reading."
      : "Overlapping work-locus capabilities are preserved as coordination evidence.",
    governance: readJuralRelations(juralRelationsOfWorkLocusClaims(claims)),
  }), "work-locus governance reading");
}

function unique(values, label) {
  const out = [];
  for (const value of values) {
    const normalized = nonempty(value, label);
    if (!out.includes(normalized)) out.push(normalized);
  }
  if (out.length === 0) throw new TypeError(`${label}: expected at least one value`);
  return Object.freeze(out);
}
