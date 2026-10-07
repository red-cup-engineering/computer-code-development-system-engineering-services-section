/**
 * @packageDocumentation
 *
 * Per-module FOUR-valued (Belnap) reading assignment over the source-code topology.
 *
 * This completes the paraconsistent Monitor (M) phase of the MAPE-K loop.
 * `moduleTopologyValuation` accepts an evaluated source-code policy and derives
 * a `ModuleTopologyValuation`: a record that assigns every observed source module
 * a reading from its keyed local-import claims. Evidence is joined only when it
 * concerns the same import edge. A held ruling for one edge and a denied ruling
 * for another establish a denied module-conformance claim; they are not opposing
 * evidence about one claim and must not become a FOUR contradiction.
 *
 * Without this step, the topology is an **unvalued structural precursor** — the
 * import graph, cohomology, and build order are computed, but no module receives
 * a paraconsistent truth value.  After this step, the Monitor surface is complete:
 * each module is `held` (all imports conform), `denied` (at least one import
 * violates policy), `contested` (conformant and violating imports co-exist), or
 * `unknown` (no import rulings observed — a leaf or otherwise uncheckable module).
 *
 * The join primitive (`joinReadingsKnowledge`) and census helper (`fourCensusOf`)
 * live in `src/monitoring/substrate/valuation.mts` and are domain-neutral:
 * any monitoring domain with a graph of evidence-bearing nodes can use them.
 *
 * @metroplatSubject source-code
 */
import { artifactId } from "@red-cup-engineering/semiotic-eavt-services-section/identity";

import { joinReadingsKnowledge, fourCensusOf } from "../../substrate/valuation.mjs";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** The paraconsistent reading for one source module derived from its observed
 *  local-import rulings. */

/** Complete paraconsistent valuation of the source-code topology.
 *
 * This is the artifact that makes `monitoring/source-code` a proper Monitor:
 * it assigns every observed source module a FOUR-valued reading derived from
 * the policy evaluation rather than leaving it as an unvalued structural node. */

  

  

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Derive the FOUR-valued paraconsistent reading for each source module from
 * a completed source-code policy evaluation.
 *
 * Only modules that appear as the `from` party in at least one
 * `local-import-ruling` receive an explicit reading entry.  Modules with no
 * observed import rulings — leaf modules or modules outside the scanned
 * corpus — have no entry; their reading is implicitly `unknown`.
 *
 * `module-build-order` and `normalization-cut` rulings are structural: they
 * apply to the whole topology rather than individual modules, so they do not
 * contribute to per-module readings here.
 *
 * The reading join uses `joinReadingsKnowledge` from the monitoring substrate —
 * the same Belnap knowledge-lattice join available to any monitoring domain.
 */
export function moduleTopologyValuation(
  evaluation,
) {
  // First join evidence only under its actual claim key: one directed import.
  const readingsByModule = new Map();

  for (const ruling of evaluation.rulings) {
    if (ruling.kind !== "metroplat.monitoring.source-code.local-import-ruling") continue;
    const moduleClaims = readingsByModule.get(ruling.from) ?? new Map();
    const readings = moduleClaims.get(ruling.to) ?? [];
    readings.push(ruling.judgement);
    moduleClaims.set(ruling.to, readings);
    readingsByModule.set(ruling.from, moduleClaims);
  }

  // Derive per-module entries, sorted deterministically by path.
  const modules = Object.freeze(
    [...readingsByModule.entries()]
      .sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath))
      .map(([path, claims]) => {
        const edgeReadings = [...claims.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([, readings]) => joinReadingsKnowledge(readings));
        // Module conformance is the Belnap knowledge-lattice join of its
        // import-conformance claims — the same `joinReadingsKnowledge` used
        // within an edge is used across edges, so the source-code domain has
        // exactly one reading-combination rule rather than a second,
        // hand-rolled conjunction that disagreed with it on mixed evidence.
        const reading = joinReadingsKnowledge(edgeReadings);
        const rulingCount = [...claims.values()].reduce((total, readings) => total + readings.length, 0);
        return Object.freeze({
          path,
          reading,
          rulingCount,
          evidence: Object.freeze([
            `rulings:${rulingCount}`,
            `import-claims:${edgeReadings.length}`,
            `reading:${reading}`,
            ...edgeReadings.slice(0, 4).map((value, index) => `import-claim-${index}:${value}`),
          ]),
        });
      }),
  );

  const summary = fourCensusOf(modules);

  // Content-address over the semantic payload only (not id/evidence).
  const semantic = Object.freeze({
    kind: "metroplat.monitoring.source-code.module-topology-valuation",
    source: evaluation.source,
    topology: evaluation.topology,
    observation: evaluation.observation,
    modules,
    summary,
  });

  return Object.freeze({
    ...semantic,
    id: artifactId(semantic),
    evidence: Object.freeze([
      `source:${evaluation.source}`,
      `modules-valued:${modules.length}`,
      `held:${summary.held}`,
      `denied:${summary.denied}`,
      `contested:${summary.contested}`,
      `unknown:${summary.unknown}`,
      "lattice:belnap-knowledge-join-of-local-import-rulings",
      "policy:local-import-rulings-only",
    ]),
  });
}
