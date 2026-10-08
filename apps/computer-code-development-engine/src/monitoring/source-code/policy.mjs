/**
 * Source-code policy evaluation by composition of MetroPlat's existing
 * predication, finite FOUR-valued closure-rule, and claim-session machinery.
 *
 * Topology remains the owner of admitted source facts. This module only
 * projects those facts into predication cells and applies named bundles of
 * `ClosureRule`s. Independent rules retain their own policy source when their
 * consequences are glued, so opposing consequences settle to `stable` and
 * continue into the existing coordination/contextuality readings.
 *
 * @packageDocumentation
 * @metroplatSubject source-code
 */

import { artifactId } from "@red-cup-engineering/semiotic-eavt-services-section/identity";
import { canonicalJson } from "@red-cup-engineering/json-services-section";
import { cell, predicateOfClaim, predicationSite, presentPredicationSite } from "@red-cup-engineering/signcell/predication";
import {
  antecedentHolds,
  closureRule,
  closureRuleReceipt,
  closureRuleSystem,
  valuation,

  } from "@red-cup-engineering/metrologic/articulation/predicating/positing/settling/analysis/closure-rule-system";
import { graphFirstBettiNumberOfEdgeList } from "@red-cup-engineering/metrologic/articulation/predicating/positing/settling/analysis/laplacian";
import {
  causalHeightStrata,

  } from "@red-cup-engineering/metrologic/articulation/predicating/positing/settling/analysis/causal";
import { readValuationFiber } from "@red-cup-engineering/metrologic/articulation/predicating/positing/valuation-fiber-algebra";
import { claim,
  mark,
  token } from "@red-cup-engineering/signcell/utterance";
import { glueClaimSessions } from "@red-cup-engineering/relating/running/session";
import { claimSessionRegimeSchema } from "@red-cup-engineering/relating/running/session-schema";
import {
  evidenceRecordOfFourCensus,
  evidenceRecordTopMass,

  readingOfEvidenceRecord,
} from "@red-cup-engineering/metrologic/articulation/predicating/positing/evidence-record";

import { schemaFrom } from "@red-cup-engineering/json-schema-services-section/contracts";
import {
  nodePackageLayoutConventionNames,

} from "./topology/schema.mjs";
import {
  moduleTopologyNormalizationCutSchema,
  normalizationConventionOfPolicies,
  normalizationCutsForModule,

} from "./normalization.mjs";
import { recordHistoryOfStages } from "../substrate/history.mjs";
import { census, readingFamilies } from "@red-cup-engineering/computer-data-services-section/four";

export {
  moduleTopologyNormalizationCutSchema,

} from "./normalization.mjs";

const nonemptyStringSequenceSchema = { type: "array", items: { type: "string", minLength: 1 } };

const fourCensusSchema = {
  type: "object",
  required: ["potential", "active", "stable", "absurd"],
  additionalProperties: false,
  properties: {
    potential: { type: "integer", minimum: 0 },
    active: { type: "integer", minimum: 0 },
    stable: { type: "integer", minimum: 0 },
    absurd: { type: "integer", minimum: 0 },
  },
};
const evidenceRecordSchema = {
  type: "object",
  required: ["kind", "pos", "neg"],
  additionalProperties: false,
  properties: {
    kind: { const: "evidence.record" },
    pos: { type: "integer", minimum: 0 },
    neg: { type: "integer", minimum: 0 },
  },
};
const sourceCodePolicyReferenceSchema = {
  type: "object",
  required: ["name", "identity"],
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1 },
    identity: { type: "string", minLength: 1 },
    layoutConvention: { enum: nodePackageLayoutConventionNames },
  },
};

const causalLinkSchema = {
  type: "object",
  required: ["from", "to"],
  additionalProperties: false,
  properties: {
    from: { type: "string", minLength: 1 },
    to: { type: "string", minLength: 1 },
  },
};
const moduleBuildOrderSchema = {
  anyOf: [{
    type: "object",
    required: ["kind", "tiers"],
    additionalProperties: false,
    properties: {
      kind: { const: "metroplat.monitoring.source-code.module-build-order" },
      tiers: { type: "array", items: nonemptyStringSequenceSchema },
    },
  }, {
    type: "object",
    required: ["kind", "reason", "cycle"],
    additionalProperties: false,
    properties: {
      kind: { const: "metroplat.monitoring.source-code.module-build-order-obstruction" },
      reason: { enum: ["duplicate-event", "absurd-event", "closed-timelike-curve"] },
      offending: causalLinkSchema,
      cycle: nonemptyStringSequenceSchema,
    },
  }],
};
const recordOrderRelationSchema = { enum: ["equal", "ascending", "descending", "incomparable"] };

export const sourceCodePolicyReadRequestSchema = {
  $id: "metroplat/monitoring/source-code/policy-read-request",
  type: "object",
  required: ["kind", "root"],
  additionalProperties: false,
  properties: {
    kind: { const: "metroplat.monitoring.source-code.policy-read-request" },
    root: { type: "string", minLength: 1 },
    sourceDirs: nonemptyStringSequenceSchema,
    maxFiles: { type: "integer", minimum: 1 },
    offset: { type: "integer", minimum: 0 },
    limit: { type: "integer", minimum: 1, maximum: 50 },
  },
};

export const sourceCodePolicyReadRequestContract = schemaFrom(sourceCodePolicyReadRequestSchema);

const policyContributionSchema = {
  type: "object",
  required: ["policy", "policyName", "rule", "reading"],
  additionalProperties: false,
  properties: {
    policy: { type: "string", minLength: 1 },
    policyName: { type: "string", minLength: 1 },
    rule: { type: "string", minLength: 1 },
    reading: { enum: readingFamilies.knowledge },
  },
};
const localImportPolicyRulingSchema = {
  type: "object",
  required: ["kind", "from", "to", "targetPresent", "judgement", "fired"],
  additionalProperties: false,
  properties: {
    kind: { const: "metroplat.monitoring.source-code.local-import-ruling" },
    from: { type: "string", minLength: 1 },
    to: { type: "string", minLength: 1 },
    targetPresent: { type: "boolean" },
    judgement: { enum: readingFamilies.knowledge },
    fired: { type: "array", items: policyContributionSchema },
  },
};
const importStratificationPolicyRulingSchema = {
  type: "object",
  required: ["kind", "from", "to", "importerStratum", "targetStratum", "judgement", "fired"],
  additionalProperties: false,
  properties: {
    kind: { const: "metroplat.monitoring.source-code.import-stratification-ruling" },
    from: { type: "string", minLength: 1 },
    to: { type: "string", minLength: 1 },
    importerStratum: { type: "string", minLength: 1 },
    targetStratum: { type: "string", minLength: 1 },
    judgement: { enum: readingFamilies.knowledge },
    fired: { type: "array", items: policyContributionSchema },
  },
};
const moduleBuildOrderPolicyRulingSchema = {
  type: "object",
  required: ["kind", "acyclic", "buildOrder", "judgement", "fired"],
  additionalProperties: false,
  properties: {
    kind: { const: "metroplat.monitoring.source-code.module-build-order-ruling" },
    acyclic: { type: "boolean" },
    buildOrder: moduleBuildOrderSchema,
    judgement: { enum: readingFamilies.knowledge },
    fired: { type: "array", items: policyContributionSchema },
  },
};
const normalizationCutPolicyRulingSchema = {
  type: "object",
  required: ["kind", "cut", "actionability", "judgement", "fired"],
  additionalProperties: false,
  properties: {
    kind: { const: "metroplat.monitoring.source-code.normalization-cut-ruling" },
    cut: moduleTopologyNormalizationCutSchema,
    actionability: { const: "potential" },
    judgement: { enum: readingFamilies.knowledge },
    fired: { type: "array", items: policyContributionSchema },
  },
};
const policyRulingSchema = {
  anyOf: [
    localImportPolicyRulingSchema,
    importStratificationPolicyRulingSchema,
    moduleBuildOrderPolicyRulingSchema,
    normalizationCutPolicyRulingSchema,
  ],
};

export const sourceCodePolicyPageSchema = {
  $id: "metroplat/monitoring/source-code/policy-page",
  type: "object",
  required: ["kind", "operation", "source", "topology", "observation", "policies", "relation", "summary", "reconciliation", "totalRulings", "offset", "limit", "returned", "rulings"],
  additionalProperties: false,
  properties: {
    kind: { const: "metroplat.monitoring.source-code.policy" },
    operation: { const: "source-code-policy" },
    source: { type: "string", minLength: 1 },
    topology: { type: "string", minLength: 1 },
    observation: { type: "string", minLength: 1 },
    policies: { type: "array", items: sourceCodePolicyReferenceSchema },
    relation: {
      type: "object",
      required: ["entities", "cells", "h0", "h1", "buildOrder"],
      additionalProperties: false,
      properties: {
        entities: { type: "integer", minimum: 0 },
        cells: { type: "integer", minimum: 0 },
        h0: { type: "integer", minimum: 0 },
        h1: { type: "integer", minimum: 0 },
        buildOrder: moduleBuildOrderSchema,
      },
    },
    summary: fourCensusSchema,
    reconciliation: {
      type: "object",
      required: ["regime", "conflicts", "coordinationRank", "coordinationVanishing", "adjudication"],
      additionalProperties: false,
      properties: {
        regime: claimSessionRegimeSchema,
        conflicts: { type: "integer", minimum: 0 },
        coordinationRank: { type: "integer", minimum: 0 },
        coordinationVanishing: { enum: ["witness", "obstruction"] },
        adjudication: { enum: ["flat", "noncontextual", "logically-contextual", "strongly-contextual"] },
      },
    },
    totalRulings: { type: "integer", minimum: 0 },
    offset: { type: "integer", minimum: 0 },
    limit: { type: "integer", minimum: 1, maximum: 50 },
    returned: { type: "integer", minimum: 0, maximum: 50 },
    nextOffset: { type: "integer", minimum: 0 },
    rulings: { type: "array", items: policyRulingSchema },
  },
};

export const sourceCodePolicyPageContract = schemaFrom(sourceCodePolicyPageSchema);

export const sourceCodePolicyHistorySchema = {
  $id: "metroplat/monitoring/source-code/policy-history",
  type: "object",
  required: ["kind", "dates", "rows", "malformed", "observations", "stages", "transitions"],
  additionalProperties: false,
  properties: {
    kind: { const: "metroplat.monitoring.source-code.policy-history" },
    dates: nonemptyStringSequenceSchema,
    rows: { type: "integer", minimum: 0 },
    malformed: { type: "integer", minimum: 0 },
    observations: { type: "integer", minimum: 0 },
    stages: {
      type: "array",
      maxItems: 100,
      items: {
        type: "object",
        required: ["source", "topology", "observation", "policies", "at", "invocation", "receipt", "causes", "summary", "record", "standing", "topMass"],
        additionalProperties: false,
        properties: {
          source: { type: "string", minLength: 1 },
          topology: { type: "string", minLength: 1 },
          observation: { type: "string", minLength: 1 },
          policies: { type: "array", items: sourceCodePolicyReferenceSchema },
          at: { type: "string", minLength: 1 },
          invocation: { type: "string", minLength: 1 },
          receipt: { type: "string", minLength: 1 },
          causes: nonemptyStringSequenceSchema,
          summary: fourCensusSchema,
          record: evidenceRecordSchema,
          standing: { enum: readingFamilies.knowledge },
          topMass: { type: "integer", minimum: 0 },
        },
      },
    },
    transitions: {
      type: "array",
      maxItems: 99,
      items: {
        type: "object",
        required: ["from", "to", "knowledge", "truth"],
        additionalProperties: false,
        properties: {
          from: { type: "string", minLength: 1 },
          to: { type: "string", minLength: 1 },
          knowledge: recordOrderRelationSchema,
          truth: recordOrderRelationSchema,
        },
      },
    },
  },
};

export const sourceCodePolicyHistoryContract = schemaFrom(sourceCodePolicyHistorySchema);

export const sourceCodePolicyAdmissionSchema = {
  $id: "metroplat/monitoring/source-code/policy-obligation-admission",
  type: "object",
  required: ["kind", "source", "observation", "opened", "discharged", "appended", "statements"],
  additionalProperties: false,
  properties: {
    kind: { const: "metroplat.monitoring.source-code.policy-obligation-admission" },
    source: { type: "string", minLength: 1 },
    observation: { type: "string", minLength: 1 },
    opened: { type: "integer", minimum: 0 },
    discharged: { type: "integer", minimum: 0 },
    appended: { type: "integer", minimum: 0 },
    statements: nonemptyStringSequenceSchema,
  },
};

export const sourceCodePolicyAdmissionContract = schemaFrom(sourceCodePolicyAdmissionSchema);

export const LOCAL_IMPORT_TARGET_PRESENT_CELL = "local-import:target-present";
export const LOCAL_IMPORT_CONFORMS_CELL = "local-import:conforms";
export const IMPORT_STRATIFICATION_SCRIPTS_TO_APPS_CELL = "import-stratification:scripts-to-apps";
export const IMPORT_STRATIFICATION_CONFORMS_CELL = "import-stratification:conforms";
export const MODULE_BUILD_ORDER_ACYCLIC_CELL = "module-build-order:acyclic";
export const MODULE_BUILD_ORDER_CONFORMS_CELL = "module-build-order:conforms";
export const NORMALIZATION_CUT_ACTIONABLE_CELL = "normalization-cut:actionable";
export const NORMALIZATION_CUT_CONFORMS_CELL = "normalization-cut:conforms";
const LOCAL_IMPORT_POLICY_CELLS = Object.freeze([
  LOCAL_IMPORT_TARGET_PRESENT_CELL,
  LOCAL_IMPORT_CONFORMS_CELL,
]);
const IMPORT_STRATIFICATION_POLICY_CELLS = Object.freeze([
  IMPORT_STRATIFICATION_SCRIPTS_TO_APPS_CELL,
  IMPORT_STRATIFICATION_CONFORMS_CELL,
]);
const MODULE_BUILD_ORDER_POLICY_CELLS = Object.freeze([
  MODULE_BUILD_ORDER_ACYCLIC_CELL,
  MODULE_BUILD_ORDER_CONFORMS_CELL,
]);
const NORMALIZATION_CUT_POLICY_CELLS = Object.freeze([
  NORMALIZATION_CUT_ACTIONABLE_CELL,
  NORMALIZATION_CUT_CONFORMS_CELL,
]);
const SOURCE_CODE_POLICY_CONCLUSIONS = new Set([
  LOCAL_IMPORT_CONFORMS_CELL,
  IMPORT_STRATIFICATION_CONFORMS_CELL,
  MODULE_BUILD_ORDER_CONFORMS_CELL,
  NORMALIZATION_CUT_CONFORMS_CELL,
]);

/** A policy is only a named source of the closure rules MetroPlat already evaluates. */

function sourceCodePolicyMaterial(policy) {
  return Object.freeze({
    kind: policy.kind,
    version: policy.version,
    name: policy.name,
    rules: policy.rules,
    ...(policy.layoutConvention === undefined ? {} : { layoutConvention: policy.layoutConvention }),
  });
}

function verifiedSourceCodePolicyMaterial(policy) {
  const material = sourceCodePolicyMaterial(policy);
  if (artifactId(material) !== policy.identity) {
    throw new TypeError(`source-code policy identity does not address its declaration: ${policy.name}`);
  }
  return material;
}

export function sourceCodePolicy(
  name,
  rules,
  options = {},
) {
  if (name.trim().length === 0) throw new TypeError("sourceCodePolicy: name must be nonempty");
  if (
    options.layoutConvention !== undefined
    && !(nodePackageLayoutConventionNames).includes(options.layoutConvention)
  ) {
    throw new TypeError(`sourceCodePolicy: absurd package layout convention ${JSON.stringify(options.layoutConvention)}`);
  }
  for (const rule of rules) {
    if (!SOURCE_CODE_POLICY_CONCLUSIONS.has(rule.consequent.cell)) {
      throw new TypeError(`sourceCodePolicy: ${rule.name} must rule on a source-code conformance cell`);
    }
  }
  // Validate each concern as its own finite observation fiber. A rule may not
  // silently couple unrelated facts merely because both happen to monitor
  // source code; composition happens through explicit policy reconciliation.
  closureRuleSystem(
    LOCAL_IMPORT_POLICY_CELLS,
    rules.filter((rule) => rule.consequent.cell === LOCAL_IMPORT_CONFORMS_CELL),
  );
  closureRuleSystem(
    IMPORT_STRATIFICATION_POLICY_CELLS,
    rules.filter((rule) => rule.consequent.cell === IMPORT_STRATIFICATION_CONFORMS_CELL),
  );
  closureRuleSystem(
    MODULE_BUILD_ORDER_POLICY_CELLS,
    rules.filter((rule) => rule.consequent.cell === MODULE_BUILD_ORDER_CONFORMS_CELL),
  );
  closureRuleSystem(
    NORMALIZATION_CUT_POLICY_CELLS,
    rules.filter((rule) => rule.consequent.cell === NORMALIZATION_CUT_CONFORMS_CELL),
  );
  const material = Object.freeze({
    kind: "metroplat.monitoring.source-code.policy",
    version: 1,
    name,
    rules: Object.freeze([...rules]),
    ...(options.layoutConvention === undefined ? {} : { layoutConvention: options.layoutConvention }),
  });
  return Object.freeze({ ...material, identity: artifactId(material) });
}

export function sourceCodePolicyArtifacts(policies) {
  const artifacts = new Map();
  for (const policy of policies) {
    const material = verifiedSourceCodePolicyMaterial(policy);
    artifacts.set(policy.identity, Object.freeze({
      ref: policy.identity,
      canonicalText: canonicalJson(material),
    }));
  }
  return Object.freeze([...artifacts.values()].sort((left, right) => left.ref.localeCompare(right.ref)));
}

const SOURCE_MODULE_LAYOUT_STRATA = Object.freeze(["apps", "scripts", "src", "lib", "test"]);

/**
 * The owner-stated scripts/apps/src import-stratification law addresses a
 * module by its outermost package layout directory, with one leading `src/`
 * segment transparent — so a package that nests every layer under `src/`
 * (this package's own layout) reads the same stratum as one that does not.
 *
 * @param packageRelativePath - a package-relative, forward-slash-separated module path
 * @returns the outermost recognized layout stratum, or `undefined` when the path names none of them
 */
export function sourceModuleStratum(
  packageRelativePath,
) {
  const segments = packageRelativePath.split("/").filter((segment) => segment.length > 0);
  const [first, second] = segments;
  const strataNames = SOURCE_MODULE_LAYOUT_STRATA;
  if (first === "src") {
    return second !== undefined && strataNames.includes(second)
      ? (second)
      : "src";
  }
  return first !== undefined && strataNames.includes(first)
    ? (first)
    : undefined;
}

/** Default: an admitted local target supports conformance; an absent target opposes it. */
export const localImportTargetPolicy = sourceCodePolicy("default:local-import-target-present", [
  closureRule(
    "local-import-target-present",
    [{ cell: LOCAL_IMPORT_TARGET_PRESENT_CELL, atLeast: "potential" }],
    { cell: LOCAL_IMPORT_CONFORMS_CELL, reading: "potential" },
  ),
  closureRule(
    "local-import-target-absent",
    [{ cell: LOCAL_IMPORT_TARGET_PRESENT_CELL, atLeast: "active" }],
    { cell: LOCAL_IMPORT_CONFORMS_CELL, reading: "active" },
  ),
]);

/** Default: a directed causal build order supports conformance; a cycle opposes it. */
export const moduleBuildOrderPolicy = sourceCodePolicy("default:module-build-order-acyclic", [
  closureRule(
    "module-build-order-acyclic",
    [{ cell: MODULE_BUILD_ORDER_ACYCLIC_CELL, atLeast: "potential" }],
    { cell: MODULE_BUILD_ORDER_CONFORMS_CELL, reading: "potential" },
  ),
  closureRule(
    "module-build-order-cyclic",
    [{ cell: MODULE_BUILD_ORDER_ACYCLIC_CELL, atLeast: "active" }],
    { cell: MODULE_BUILD_ORDER_CONFORMS_CELL, reading: "active" },
  ),
]);

/** Default: every emitted topology cut is an executable carrier
 * nonconformance. Unresolved placement remains topology evidence and never
 * enters this rule system as a pseudo-cut. */
export const normalizationCutPolicy = sourceCodePolicy("default:normalization-cut-actionability", [
  closureRule(
    "actionable-normalization-cut-opposes-current-carrier",
    [{ cell: NORMALIZATION_CUT_ACTIONABLE_CELL, atLeast: "potential" }],
    { cell: NORMALIZATION_CUT_CONFORMS_CELL, reading: "active" },
  ),
], { layoutConvention: "context-directory-layer-filename" });

/**
 * The owner-stated import-stratification law (scripts may import scripts
 * and src; scripts may not import apps; apps may import apps, scripts, and
 * src): encoded as its one active edge. Every other edge shape — including
 * an edge with an unresolved stratum — carries no rule and so stays at the
 * knowledge-least `absurd` value; this policy never invents law for them.
 */
export const importStratificationPolicy = sourceCodePolicy("default:import-stratification", [
  closureRule(
    "scripts-may-not-import-apps",
    [{ cell: IMPORT_STRATIFICATION_SCRIPTS_TO_APPS_CELL, atLeast: "potential" }],
    { cell: IMPORT_STRATIFICATION_CONFORMS_CELL, reading: "active" },
  ),
  closureRule(
    "import-stratification-lawful",
    [{ cell: IMPORT_STRATIFICATION_SCRIPTS_TO_APPS_CELL, atLeast: "active" }],
    { cell: IMPORT_STRATIFICATION_CONFORMS_CELL, reading: "potential" },
  ),
]);

export const DEFAULT_SOURCE_CODE_POLICIES = Object.freeze([
  localImportTargetPolicy,
  moduleBuildOrderPolicy,
  normalizationCutPolicy,
  importStratificationPolicy,
]);

  

const isCausalBuildObstruction = (
  value,
) => !Array.isArray(value);

const sourceModuleTerm = (identity) => token(mark(Object.freeze({ kind: "source-code.module", identity })));
const sourcePathTerm = (path) => token(mark(Object.freeze({ kind: "source-code.path", path })));
const sourcePredicate = (name) => predicateOfClaim(claim(mark(name)));

/** Project the admitted module/import facts into MetroPlat's canonical predication relation. */
export function moduleTopologyRelation(topology) {
  const moduleTerms = new Map(topology.modules.map((moduleEntry) => [moduleEntry.path, sourceModuleTerm(moduleEntry.identity)]));
  const locatedAtPredicate = sourcePredicate("source-code:located-at");
  const importsPredicate = sourcePredicate("source-code:imports");
  const cells = topology.modules.flatMap((moduleEntry) => {
    const subject = moduleTerms.get(moduleEntry.path);
    return [
      cell(subject, locatedAtPredicate, sourcePathTerm(moduleEntry.path)),
      ...moduleEntry.imports.map((target) =>
        cell(subject, importsPredicate, moduleTerms.get(target) ?? sourcePathTerm(target))),
    ];
  });
  const predication = presentPredicationSite(predicationSite(cells));
  const entityNames = [...new Set(topology.modules.flatMap((moduleEntry) => [moduleEntry.path, ...moduleEntry.imports]))];
  const entityIndex = new Map(entityNames.map((name, index) => [name, index]));
  const edges = topology.modules.flatMap((moduleEntry) => moduleEntry.imports.map((target) =>
    Object.freeze([entityIndex.get(moduleEntry.path), entityIndex.get(target)])));
  const nonReflexiveEdges = edges.filter(([left, right]) => left !== right);
  const h1 = graphFirstBettiNumberOfEdgeList(entityNames.length, nonReflexiveEdges);
  const h0 = h1 - nonReflexiveEdges.length + entityNames.length;
  const modulePathSet = new Set(topology.modules.map((moduleEntry) => moduleEntry.path));
  const causal = causalHeightStrata(Object.freeze({
    kind: "lorentzian.causalSet",
    events: Object.freeze(topology.modules.map((moduleEntry) => moduleEntry.path)),
    // Dependency precedes dependent. Missing targets remain policy evidence,
    // but are not invented as events in the admitted module causal set.
    links: Object.freeze(topology.modules.flatMap((moduleEntry) => moduleEntry.imports
      .filter((target) => modulePathSet.has(target))
      .map((target) => Object.freeze({ from: target, to: moduleEntry.path })))),
  }));
  const buildOrder = isCausalBuildObstruction(causal)
    ? Object.freeze({
      kind: "metroplat.monitoring.source-code.module-build-order-obstruction",
      reason: causal.reason,
      ...(causal.offending === undefined ? {} : { offending: causal.offending }),
      cycle: causal.cycle,
    })
    : Object.freeze({
      kind: "metroplat.monitoring.source-code.module-build-order",
      tiers: causal,
    });
  return Object.freeze({
    kind: "metroplat.monitoring.source-code.module-relation",
    source: topology.source,
    observation: topology.observation,
    predication,
    measurement: Object.freeze({
      entities: entityNames.length,
      cells: nonReflexiveEdges.length,
      h0,
      h1,
      buildOrder,
    }),
  });
}

/** Import stratification is its own finite observation fiber (never merged
 * with local-import target presence), so a genuine layering violation can
 * settle to `active` instead of being masked into `stable` by an
 * unrelated concern's evidence. Emitted once per local-import edge whose
 * both strata resolve; an edge with an unresolved stratum raises no ruling. */

function policyBundles(
  topology,
  policies,
  rulings,
) {
  return Object.freeze(policies.map((policy) => {
    let item = 0;
    const observations = [];
    for (const ruling of rulings) {
      for (const contribution of ruling.fired.filter((entry) => entry.policy === policy.identity)) {
        item += 1;
        const role = sourceCodePolicyRulingRole(ruling);
        observations.push(Object.freeze({
          sessionId: policy.identity,
          transport: "claim-session",
          claim: Object.freeze({ cell: role, reading: contribution.reading }),
          session: Object.freeze({ claims: Object.freeze([]), closed: false }),
          judgement: Object.freeze({}),
          at: Object.freeze({ source: topology.observation, item }),
          boundary: Object.freeze({ role, text: "conforms", source: policy.identity, policyName: policy.name }),
        }));
      }
    }
    return Object.freeze({
      kind: "metroplat.claim-session.observation-bundle",
      source: policy.identity,
      observations: Object.freeze(observations),
      evidence: Object.freeze([topology.observation]),
    });
  }));
}

const localImportRulingRole = (from, to) => `local-import:${from}->${to}`;
export const localImportRulingCell = (from, to) => `${localImportRulingRole(from, to)}:conforms`;
const importStratificationRulingRole = (from, to) => `import-stratification:${from}->${to}`;
export const importStratificationRulingCell = (from, to) =>
  `${importStratificationRulingRole(from, to)}:conforms`;
export const MODULE_BUILD_ORDER_RULING_CELL = "module-build-order:conforms";
export const normalizationCutRulingCell = (identity) => `normalization-cut:${identity}:conforms`;

const sourceCodePolicyRulingRole = (ruling) => {
  if (ruling.kind === "metroplat.monitoring.source-code.local-import-ruling") {
    return localImportRulingRole(ruling.from, ruling.to);
  }
  if (ruling.kind === "metroplat.monitoring.source-code.import-stratification-ruling") {
    return importStratificationRulingRole(ruling.from, ruling.to);
  }
  return ruling.kind === "metroplat.monitoring.source-code.normalization-cut-ruling"
    ? `normalization-cut:${ruling.cut.identity}`
    : "module-build-order";
};

export const sourceCodePolicyRulingCell = (ruling) => {
  if (ruling.kind === "metroplat.monitoring.source-code.local-import-ruling") {
    return localImportRulingCell(ruling.from, ruling.to);
  }
  if (ruling.kind === "metroplat.monitoring.source-code.import-stratification-ruling") {
    return importStratificationRulingCell(ruling.from, ruling.to);
  }
  return ruling.kind === "metroplat.monitoring.source-code.normalization-cut-ruling"
    ? normalizationCutRulingCell(ruling.cut.identity)
    : MODULE_BUILD_ORDER_RULING_CELL;
};

function sourceCodePolicyRulingMaterial(ruling) {
  if (ruling.kind === "metroplat.monitoring.source-code.local-import-ruling") {
    const { kind, from, to, targetPresent, judgement, fired } = ruling;
    return Object.freeze({ kind, from, to, targetPresent, judgement, fired });
  }
  if (ruling.kind === "metroplat.monitoring.source-code.import-stratification-ruling") {
    const { kind, from, to, importerStratum, targetStratum, judgement, fired } = ruling;
    return Object.freeze({ kind, from, to, importerStratum, targetStratum, judgement, fired });
  }
  if (ruling.kind === "metroplat.monitoring.source-code.normalization-cut-ruling") {
    const { kind, cut, actionability, judgement, fired } = ruling;
    return Object.freeze({ kind, cut, actionability, judgement, fired });
  }
  const { kind, acyclic, buildOrder, judgement, fired } = ruling;
  return Object.freeze({ kind, acyclic, buildOrder, judgement, fired });
}

/** Bounded content-addressed fold over a potentially package-scale ruling set.
 * The final reference commits to order and multiplicity without requiring the
 * canonical identity layer to admit one unbounded aggregate JSON value. */
function sourceCodePolicyRulingCommitment(rulings) {
  let commitment = artifactId(Object.freeze({
    kind: "metroplat.monitoring.source-code.policy-rulings",
    version: 1,
    count: 0,
  }));
  rulings.forEach((ruling, index) => {
    commitment = artifactId(Object.freeze({
      kind: "metroplat.monitoring.source-code.policy-rulings-step",
      version: 1,
      previous: commitment,
      index,
      ruling: sourceCodePolicyRulingMaterial(ruling),
    }));
  });
  return commitment;
}

function policyContributions(
  policies,
  receipt,
  conclusion,
) {
  return Object.freeze(policies.flatMap((policy) => policy.rules
    .filter((rule) => rule.consequent.cell === conclusion && antecedentHolds(rule, receipt.closed))
    .map((rule) => Object.freeze({
      policy: policy.identity,
      policyName: policy.name,
      rule: rule.name,
      reading: rule.consequent.reading,
    }))));
}

/**
 * Judge every observed local import with a proven two-cell least fixed point,
 * then glue independent policy contributions through the existing
 * contradiction, coordination, and contextual adjudication path.
 */
export function evaluateSourceCodePolicies(
  topology,
  policies = DEFAULT_SOURCE_CODE_POLICIES,
) {
  for (const policy of policies) verifiedSourceCodePolicyMaterial(policy);
  if (new Set(policies.map((policy) => policy.name)).size !== policies.length) {
    throw new TypeError("evaluateSourceCodePolicies: policy names must be unique sources");
  }
  if (new Set(policies.map((policy) => policy.identity)).size !== policies.length) {
    throw new TypeError("evaluateSourceCodePolicies: policy identities must be unique sources");
  }
  const rules = policies.flatMap((policy) => policy.rules);
  const localImportSystem = closureRuleSystem(
    LOCAL_IMPORT_POLICY_CELLS,
    rules.filter((rule) => rule.consequent.cell === LOCAL_IMPORT_CONFORMS_CELL),
  );
  const importStratificationSystem = closureRuleSystem(
    IMPORT_STRATIFICATION_POLICY_CELLS,
    rules.filter((rule) => rule.consequent.cell === IMPORT_STRATIFICATION_CONFORMS_CELL),
  );
  const moduleBuildOrderSystem = closureRuleSystem(
    MODULE_BUILD_ORDER_POLICY_CELLS,
    rules.filter((rule) => rule.consequent.cell === MODULE_BUILD_ORDER_CONFORMS_CELL),
  );
  const normalizationCutSystem = closureRuleSystem(
    NORMALIZATION_CUT_POLICY_CELLS,
    rules.filter((rule) => rule.consequent.cell === NORMALIZATION_CUT_CONFORMS_CELL),
  );
  const modulePaths = new Set(topology.modules.map((moduleEntry) => moduleEntry.path));
  // Every edge has one of only two seeds. Prove each least fixed point once,
  // then reuse its immutable receipt for every edge with that observation.
  const presentReceipt = closureRuleReceipt(localImportSystem, valuation(localImportSystem.cells, {
    [LOCAL_IMPORT_TARGET_PRESENT_CELL]: "potential",
  }));
  const absentReceipt = closureRuleReceipt(localImportSystem, valuation(localImportSystem.cells, {
    [LOCAL_IMPORT_TARGET_PRESENT_CELL]: "active",
  }));
  // Import stratification is a wholly separate finite observation fiber
  // (see sourceCodePolicy's own per-concern validation above): its own two
  // seeds, proven once, reused for every edge whose strata resolve.
  const scriptsToAppsReceipt = closureRuleReceipt(importStratificationSystem, valuation(importStratificationSystem.cells, {
    [IMPORT_STRATIFICATION_SCRIPTS_TO_APPS_CELL]: "potential",
  }));
  const lawfulShapeReceipt = closureRuleReceipt(importStratificationSystem, valuation(importStratificationSystem.cells, {
    [IMPORT_STRATIFICATION_SCRIPTS_TO_APPS_CELL]: "active",
  }));
  const relation = moduleTopologyRelation(topology);
  const acyclic = relation.measurement.buildOrder.kind === "metroplat.monitoring.source-code.module-build-order";
  const buildOrderReceipt = closureRuleReceipt(moduleBuildOrderSystem, valuation(moduleBuildOrderSystem.cells, {
    [MODULE_BUILD_ORDER_ACYCLIC_CELL]: acyclic ? "potential" : "active",
  }));
  const actionableCutReceipt = closureRuleReceipt(normalizationCutSystem, valuation(normalizationCutSystem.cells, {
    [NORMALIZATION_CUT_ACTIONABLE_CELL]: "potential",
  }));
  const normalizationConvention = normalizationConventionOfPolicies(policies);
  const rulings = [Object.freeze({
    kind: "metroplat.monitoring.source-code.module-build-order-ruling",
    acyclic,
    buildOrder: relation.measurement.buildOrder,
    judgement: (readValuationFiber(buildOrderReceipt.closed, MODULE_BUILD_ORDER_CONFORMS_CELL)),
    fired: policyContributions(policies, buildOrderReceipt, MODULE_BUILD_ORDER_CONFORMS_CELL),
    receipt: buildOrderReceipt,
  })];
  for (const moduleEntry of topology.modules) {
    for (const target of moduleEntry.imports) {
      const targetPresent = modulePaths.has(target);
      const receipt = targetPresent ? presentReceipt : absentReceipt;
      rulings.push(Object.freeze({
        kind: "metroplat.monitoring.source-code.local-import-ruling",
        from: moduleEntry.path,
        to: target,
        targetPresent,
        judgement: (readValuationFiber(receipt.closed, LOCAL_IMPORT_CONFORMS_CELL)),
        fired: policyContributions(policies, receipt, LOCAL_IMPORT_CONFORMS_CELL),
        receipt,
      }));
      const importerStratum = sourceModuleStratum(moduleEntry.path);
      const targetStratum = sourceModuleStratum(target);
      if (importerStratum !== undefined && targetStratum !== undefined) {
        const scriptsToApps = importerStratum === "scripts" && targetStratum === "apps";
        const stratificationReceipt = scriptsToApps ? scriptsToAppsReceipt : lawfulShapeReceipt;
        rulings.push(Object.freeze({
          kind: "metroplat.monitoring.source-code.import-stratification-ruling",
          from: moduleEntry.path,
          to: target,
          importerStratum,
          targetStratum,
          judgement: (readValuationFiber(stratificationReceipt.closed, IMPORT_STRATIFICATION_CONFORMS_CELL)),
          fired: policyContributions(policies, stratificationReceipt, IMPORT_STRATIFICATION_CONFORMS_CELL),
          receipt: stratificationReceipt,
        }));
      }
    }
    for (const cut of normalizationCutsForModule(moduleEntry, normalizationConvention)) {
      const actionability = "potential";
      const receipt = actionableCutReceipt;
      rulings.push(Object.freeze({
        kind: "metroplat.monitoring.source-code.normalization-cut-ruling",
        cut,
        actionability,
        judgement: (readValuationFiber(receipt.closed, NORMALIZATION_CUT_CONFORMS_CELL)),
        fired: policyContributions(policies, receipt, NORMALIZATION_CUT_CONFORMS_CELL),
        receipt,
      }));
    }
  }
  const frozenRulings = Object.freeze(rulings);
  const summary = census(rulings.map((ruling) => ruling.judgement));
  const reconciliation = glueClaimSessions(policyBundles(topology, policies, frozenRulings));
  const policyReferences = Object.freeze(policies.map((policy) => Object.freeze({
    name: policy.name,
    identity: policy.identity,
    ...(policy.layoutConvention === undefined ? {} : { layoutConvention: policy.layoutConvention }),
  })));
  const observation = artifactId(Object.freeze({
    topology: topology.observation,
    policies: policyReferences,
    rulings: Object.freeze({
      count: rulings.length,
      commitment: sourceCodePolicyRulingCommitment(rulings),
    }),
  }));
  return Object.freeze({
    kind: "metroplat.monitoring.source-code.policy-evaluation",
    source: topology.source,
    topology: topology.observation,
    observation,
    relation,
    policies: policyReferences,
    rulings: frozenRulings,
    summary,
    reconciliation,
  });
}

/** Project an evaluation into a deterministic RPC-sized page, retaining the
 * complete aggregate and reconciliation readings while omitting internal
 * closure receipts and predication material from the wire boundary. */
export function sourceCodePolicyPage(
  evaluation,
  options = {},
) {
  const offset = options.offset ?? 0;
  const limit = options.limit ?? 25;
  if (!Number.isInteger(offset) || offset < 0) throw new TypeError("source-code policy offset must be a nonnegative integer");
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new TypeError("source-code policy limit must be an integer from 1 through 50");
  const selected = evaluation.rulings.slice(offset, offset + limit).map(sourceCodePolicyRulingMaterial);
  const nextOffset = offset + selected.length < evaluation.rulings.length ? offset + selected.length : undefined;
  return sourceCodePolicyPageContract.assert(Object.freeze({
    kind: "metroplat.monitoring.source-code.policy",
    operation: "source-code-policy",
    source: evaluation.source,
    topology: evaluation.topology,
    observation: evaluation.observation,
    policies: evaluation.policies,
    relation: evaluation.relation.measurement,
    summary: evaluation.summary,
    reconciliation: Object.freeze({
      regime: evaluation.reconciliation.regime,
      conflicts: evaluation.reconciliation.conflicts.length,
      coordinationRank: evaluation.reconciliation.coordination.rank,
      coordinationVanishing: evaluation.reconciliation.coordination.vanishing,
      adjudication: evaluation.reconciliation.adjudication.classification,
    }),
    totalRulings: evaluation.rulings.length,
    offset,
    limit,
    returned: selected.length,
    ...(nextOffset === undefined ? {} : { nextOffset }),
    rulings: Object.freeze(selected),
  }), "Source-code policy page");
}

/** The faithful multiplicity-bearing Record shadow of a policy census. */
export const sourceCodePolicyEvidenceRecord = (summary) =>
  evidenceRecordOfFourCensus(summary);

/** Fold already-admitted policy outcomes through the shared Record history. */
export function sourceCodePolicyHistoryOfStages(
  dates,
  source,
  options = {},
) {
  const history = recordHistoryOfStages(dates, source.stages, (stage) => stage.record, options);
  return sourceCodePolicyHistoryContract.assert(Object.freeze({
    kind: "metroplat.monitoring.source-code.policy-history",
    dates: history.dates,
    rows: source.rows,
    malformed: source.malformed,
    observations: history.observations,
    stages: history.stages,
    transitions: history.transitions,
  }), "source-code policy history");
}

/** Construct the Record-valued temporal face of one governed policy page. */
export function sourceCodePolicyStage(input) {
  const record = sourceCodePolicyEvidenceRecord(input.summary);
  return Object.freeze({
    ...input,
    record,
    standing: readingOfEvidenceRecord(record),
    topMass: evidenceRecordTopMass(record),
  });
}
