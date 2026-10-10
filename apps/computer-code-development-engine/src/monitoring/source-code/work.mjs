/**
 * @packageDocumentation
 *
 * Source-code policy findings projected into MetroPlat's canonical work
 * language. Policy evaluation owns evidential rulings; this module owns the
 * boundary that turns those rulings into causally staged work.
 *
 * @metroplatSubject source-code
 */
import { artifactId } from "@red-cup-engineering/semiotic-eavt-services-section/identity";
import { slugify } from "@red-cup-engineering/computer-text-content-engineering-services-section/slugify-text";
import { claimSessionObservationBundleContract } from "@red-cup-engineering/relating/running/session-schema";

import {
  obsticulationDischargeObservations,
  obsticulationObservationsOfGlue,
  obsticulationObservationsOfObligations,

} from "@red-cup-engineering/organizing/work/obligations";

import {
  sourceCodePolicyRulingCell,

} from "./policy.mjs";
import { readingAs } from "@red-cup-engineering/computer-data-services-section/four";

function sourceCodePolicyDenialText(ruling) {
  if (ruling.kind === "metroplat.monitoring.source-code.local-import-ruling") {
    return ruling.targetPresent
      ? `local import "${ruling.from}" → "${ruling.to}" is denied by policy; the target is an admitted source module`
      : `local import "${ruling.from}" → "${ruling.to}" is denied: the target is not an admitted source module`;
  }
  if (ruling.kind === "metroplat.monitoring.source-code.import-stratification-ruling") {
    return `import-stratification law denied by rule "scripts-may-not-import-apps": `
      + `"${ruling.from}" (stratum:${ruling.importerStratum}) imports `
      + `"${ruling.to}" (stratum:${ruling.targetStratum}); scripts may not import apps`;
  }
  if (ruling.kind === "metroplat.monitoring.source-code.normalization-cut-ruling") {
    const verb = ruling.cut.action === "move-module" ? "move" : "split";
    return `source carrier "${ruling.cut.from}" is denied by its executable JSNode normalization cut: ${verb} `
      + `${ruling.cut.symbols.join(", ")} to "${ruling.cut.to}"`;
  }
  if (ruling.buildOrder.kind === "metroplat.monitoring.source-code.module-build-order-obstruction") {
    const path = ruling.buildOrder.cycle.length > 0 ? `: ${ruling.buildOrder.cycle.join(" → ")}` : "";
    return `module dependency build order is denied: the admitted source graph contains a directed cycle${path}`;
  }
  return "module dependency build order is denied by policy despite an acyclic observed source graph";
}

/** Stable enclosure for executable source-normalization work. */
export const SOURCE_CODE_NORMALIZATION_WORK = Object.freeze({
  endeavor: "endeavor:source-code-coherence",
  project: "project:source-code-policy",
  carrierPlan: "plan:normalize-jsnode-carriers",
});

function sourceCodePolicyTaskScope(cell) {
  const digest = artifactId(Object.freeze({
    kind: "metroplat.monitoring.source-code.policy-task",
    cell,
  })).split(";").at(-1).slice(0, 12);
  return `task:${(slugify(cell) || "slug")}-${digest}`;
}

function affectedCarriersOfRuling(ruling) {
  if (ruling.kind === "metroplat.monitoring.source-code.local-import-ruling") {
    return Object.freeze([ruling.from]);
  }
  if (ruling.kind === "metroplat.monitoring.source-code.import-stratification-ruling") {
    return Object.freeze([ruling.from]);
  }
  if (ruling.kind === "metroplat.monitoring.source-code.normalization-cut-ruling") {
    return Object.freeze([...new Set([ruling.cut.from, ruling.cut.to])].sort());
  }
  return Object.freeze([...new Set(ruling.buildOrder.kind === "metroplat.monitoring.source-code.module-build-order-obstruction"
    ? ruling.buildOrder.cycle
    : [])].sort());
}

function sourceCodeNormalizationEnclosure() {
  const work = SOURCE_CODE_NORMALIZATION_WORK;
  return Object.freeze([
    Object.freeze({
      cell: "source-code-coherence",
      item: work.endeavor,
      text: "Sustain source-code coherence while retaining the evidence and capability produced by every normalization attempt.",
      evidence: Object.freeze(["work-level:endeavor", "sad:5.27", "failure-open:attempts-retained"]),
    }),
    Object.freeze({
      cell: "source-code-policy",
      item: work.project,
      parent: work.endeavor,
      text: "Judge executable source transformations through the existing topology, policy, and work owners.",
      evidence: Object.freeze(["work-level:project", "owner:monitoring/source-code", "owner:work"]),
    }),
    Object.freeze({
      cell: "normalize-jsnode-carriers",
      item: work.carrierPlan,
      parent: work.project,
      text: "Apply denied carrier moves whose fully witnessed subject and species evidence authorize the existing actuator.",
      dependencies: Object.freeze([]),
      evidence: Object.freeze(["work-level:plan", "mutation:executable-cuts-only", "unknown-is-not-a-cut"]),
    }),
  ]);
}

/** Conflicts are valid only between sibling tasks in the same causal plan. */
function sourceCodePolicyFindingConflicts(
  findings,
) {
  const itemsByCarrierAndPlan = new Map();
  for (const finding of findings) {
    for (const carrier of finding.affectedCarriers) {
      const key = `${finding.parent}\u0000${carrier}`;
      const items = itemsByCarrierAndPlan.get(key) ?? new Set();
      items.add(finding.item);
      itemsByCarrierAndPlan.set(key, items);
    }
  }
  return Object.freeze(findings.map((finding) => {
    const conflicts = new Set();
    for (const carrier of finding.affectedCarriers) {
      for (const item of itemsByCarrierAndPlan.get(`${finding.parent}\u0000${carrier}`) ?? []) {
        if (item !== finding.item) conflicts.add(item);
      }
    }
    const carrierSet = artifactId(Object.freeze([...finding.affectedCarriers].sort()));
    return Object.freeze({
      ...finding,
      dependencies: Object.freeze([]),
      conflicts: Object.freeze([...conflicts].sort()),
      evidence: Object.freeze([
        ...finding.evidence,
        `affected-carriers:${carrierSet}`,
        `affected-carrier-count:${finding.affectedCarriers.length}`,
        "sequencing:not-inferred-from-import-order",
        `conflict-degree:${conflicts.size}`,
      ]),
    });
  }));
}

function sourceCodePolicyDiagnosticEvidence(ruling) {
  if (ruling.kind === "metroplat.monitoring.source-code.import-stratification-ruling") {
    return Object.freeze([
      `importer-stratum:${ruling.importerStratum}`,
      `target-stratum:${ruling.targetStratum}`,
    ]);
  }
  if (ruling.kind === "metroplat.monitoring.source-code.normalization-cut-ruling") {
    return Object.freeze([
      `normalization-cut:${ruling.cut.identity}`,
      `normalization-action:${ruling.cut.action}`,
      `normalization-from:${ruling.cut.from}`,
      `normalization-to:${ruling.cut.to}`,
      `normalization-symbols:${ruling.cut.symbols.join(",")}`,
      ...ruling.cut.formulas.map((formula) => `species-formula:${formula}`),
      `normalization-layer:${ruling.cut.layer}`,
      `normalization-region:${ruling.cut.packageRegion}`,
      ...ruling.cut.reasons.map((reason) => `normalization-reason:${reason}`),
    ]);
  }
  if (
    ruling.kind !== "metroplat.monitoring.source-code.module-build-order-ruling"
    || ruling.buildOrder.kind !== "metroplat.monitoring.source-code.module-build-order-obstruction"
  ) return Object.freeze([]);
  const cycle = ruling.buildOrder.cycle;
  return Object.freeze([
    ...cycle.map((event) => `cycle-event:${event}`),
    ...cycle.slice(1).map((event, index) => `cycle-edge:${cycle[index]}->${event}`),
  ]);
}

/** Project denied or contested policy findings into executable work. */
export function sourceCodePolicyObligations(evaluation) {
  const deniedWork = evaluation.rulings
    // Rulings carry the knowledge-family name of their reading (`active` is told against only);
    // compare the point, not one family's spelling of it.
    .filter((ruling) => readingAs("extremal", ruling.judgement) === "denied")
    .map((ruling) => {
      const cell = sourceCodePolicyRulingCell(ruling);
      return Object.freeze({
        cell,
        item: sourceCodePolicyTaskScope(cell),
        parent: SOURCE_CODE_NORMALIZATION_WORK.carrierPlan,
        affectedCarriers: affectedCarriersOfRuling(ruling),
        text: sourceCodePolicyDenialText(ruling),
        evidence: Object.freeze([
          `policy-observation:${evaluation.observation}`,
          `topology-observation:${evaluation.topology}`,
          `source-corpus:${evaluation.source}`,
          `policy-judgement:${ruling.judgement}`,
          "work-level:task",
          "work-kind:repair",
          ...ruling.fired.map((entry) => `rule:${entry.policy}:${entry.policyName}:${entry.rule}:${entry.reading}`),
          ...sourceCodePolicyDiagnosticEvidence(ruling),
        ]),
      });
    });
  const work = sourceCodePolicyFindingConflicts(deniedWork);
  const contested = obsticulationObservationsOfGlue(evaluation.reconciliation, {
    source: evaluation.observation,
    settlementToken: evaluation.observation,
    sessionId: "source-code-policy",
    parent: SOURCE_CODE_NORMALIZATION_WORK.carrierPlan,
    evidence: Object.freeze(["producer:source-code-policy"]),
  });
  const enclosure = work.length === 0 && contested.length === 0
    ? Object.freeze([])
    : obsticulationObservationsOfObligations(sourceCodeNormalizationEnclosure(), {
      source: evaluation.observation,
      settlementToken: evaluation.observation,
      sessionId: "source-code-policy",
      evidence: Object.freeze(["producer:source-code-policy"]),
    });
  const obligations = obsticulationObservationsOfObligations(work, {
    source: evaluation.observation,
    settlementToken: evaluation.observation,
    sessionId: "source-code-policy",
    evidence: Object.freeze(["producer:source-code-policy"]),
  });
  return claimSessionObservationBundleContract.assert(Object.freeze({
    kind: "metroplat.claim-session.observation-bundle",
    sessionId: "source-code-policy",
    source: evaluation.observation,
    observations: Object.freeze([...enclosure, ...obligations, ...contested]),
    evidence: Object.freeze(["producer:source-code-policy", evaluation.source, evaluation.topology, evaluation.observation]),
  }), "source-code policy obligations");
}

/** Compute the monotone delta against previously open policy obligations. */
export function sourceCodePolicyObligationDelta(
  evaluation,
  openObligations,
) {
  const current = sourceCodePolicyObligations(evaluation);
  const priorPolicy = openObligations.filter((obligation) => obligation.evidence.includes("producer:source-code-policy"));
  const openCells = new Set(priorPolicy.map((obligation) => obligation.cell));
  const currentCells = new Set(current.observations.map((observation) => observation.claim.cell));
  const openings = current.observations.filter((observation) => !openCells.has(observation.claim.cell));
  const discharges = obsticulationDischargeObservations(
    priorPolicy
      .filter((obligation) => !currentCells.has(obligation.cell))
      .map((obligation) => Object.freeze({
        cell: obligation.cell,
        text: `source-code policy finding resolved: ${obligation.text}`,
        evidence: Object.freeze([...obligation.evidence, `resolved-by:${evaluation.observation}`]),
      })),
    {
      source: evaluation.observation,
      settlementToken: evaluation.observation,
      sessionId: "source-code-policy",
      evidence: Object.freeze(["producer:source-code-policy"]),
    },
  );
  return claimSessionObservationBundleContract.assert(Object.freeze({
    kind: "metroplat.claim-session.observation-bundle",
    sessionId: "source-code-policy",
    source: evaluation.observation,
    observations: Object.freeze([...openings, ...discharges]),
    evidence: current.evidence,
  }), "source-code policy obligation delta");
}
