/**
 * @packageDocumentation
 *
 * Pure temporal projection of already-admitted module-topology-valuation outcomes.
 * Journal traversal belongs to the application adapter in monitoring/operations.
 *
 * Each admitted `module-topology-valuation` outcome contributes one stage.
 * Consecutive distinct observations are related in both the Belnap knowledge
 * order and the truth order:
 *
 * - **knowledge ascending** — more evidence observed (pos ↑ or neg ↑)
 * - **truth ascending** — conformance improving (pos ↑ and neg ↓)
 *
 * where pos = held modules (conformant), neg = denied + contested modules
 * (non-conformant or contradicting evidence).
 *
 * @metroplatSubject source-code
 */

import { schemaFrom } from "@red-cup-engineering/json-schema-services-section/contracts";
import { recordHistoryOfStages } from "../../substrate/history.mjs";

/** One admitted module-topology-valuation observation extracted from the RPC journal. */

// ---------------------------------------------------------------------------
// History contract schema
// ---------------------------------------------------------------------------

const moduleTopologyValuationHistorySchema = {
  $id: "metroplat/monitoring/source-code/module-topology-valuation-history",
  type: "object",
  required: ["kind", "dates", "rows", "malformed", "observations", "stages", "transitions"],
  additionalProperties: false,
  properties: {
    kind: { const: "metroplat.monitoring.source-code.module-topology-valuation-history" },
    dates: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 31 },
    rows: { type: "integer", minimum: 0 },
    malformed: { type: "integer", minimum: 0 },
    observations: { type: "integer", minimum: 0 },
    stages: {
      type: "array",
      items: {
        type: "object",
        required: ["source", "observation", "at", "invocation", "receipt", "causes", "summary"],
        additionalProperties: false,
        properties: {
          source: { type: "string" },
          observation: { type: "string" },
          at: { type: "string" },
          invocation: { type: "string" },
          receipt: { type: "string" },
          causes: { type: "array", items: { type: "string" } },
          summary: {
            type: "object",
            required: ["held", "denied", "contested", "unknown"],
            additionalProperties: false,
            properties: {
              held: { type: "integer", minimum: 0 },
              denied: { type: "integer", minimum: 0 },
              contested: { type: "integer", minimum: 0 },
              unknown: { type: "integer", minimum: 0 },
            },
          },
        },
      },
    },
    transitions: {
      type: "array",
      items: {
        type: "object",
        required: ["from", "to", "knowledge", "truth"],
        additionalProperties: false,
        properties: {
          from: { type: "string" },
          to: { type: "string" },
          knowledge: { enum: ["equal", "ascending", "descending", "incomparable"] },
          truth: { enum: ["equal", "ascending", "descending", "incomparable"] },
        },
      },
    },
  },
};

export const moduleTopologyValuationHistoryContract = schemaFrom(moduleTopologyValuationHistorySchema);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Fold distinct consecutive topology-valuation observations into a bounded history.
 *
 * Transitions relate consecutive observations in both the knowledge order
 * (total evidence observed) and the truth order (conformance direction):
 *
 *   evidence record: `pos = summary.held`, `neg = summary.denied + summary.contested`
 *
 * A truth-ascending transition means the codebase moved toward conformance
 * (more held, fewer denied/contested modules).  A truth-descending one
 * signals regression. Incomparable means both dimensions moved in opposite
 * directions simultaneously — the paraconsistent Monitor captures this
 * without collapsing to either verdict. */
export function moduleTopologyValuationHistoryOfStages(
  dates,
  source,
  options = {},
) {
  const history = recordHistoryOfStages(
    dates,
    source.stages,
    (stage) => Object.freeze({
      kind: "evidence.record",
      // Positive mass: conformant (held) modules — evidence for correctness.
      pos: stage.summary.held,
      // Negative mass: non-conformant (denied) and paraconsistent (contested) modules.
      neg: stage.summary.denied + stage.summary.contested,
    }),
    options,
  );
  return moduleTopologyValuationHistoryContract.assert(Object.freeze({
    kind: "metroplat.monitoring.source-code.module-topology-valuation-history",
    dates: history.dates,
    rows: source.rows,
    malformed: source.malformed,
    observations: history.observations,
    stages: history.stages,
    transitions: history.transitions,
  }), "module topology valuation history");
}
