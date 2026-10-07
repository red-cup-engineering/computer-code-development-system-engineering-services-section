/**
 * @packageDocumentation
 *
 * Keyed paraconsistent Monitor evidence over source-code claims.
 *
 * The Monitor (M) phase of the MAPE-K loop produces three independent signals:
 *
 *   - **policy** — FOUR-valued reading over all local-import rulings
 *   - **topology** — FOUR-valued reading per source module (via `moduleTopologyValuation`)
 *   - **build-order** — structural conformance of the module dependency graph
 *
 * A FOUR reading is a valuation of one claim, never a summary of counts from
 * unrelated claims.  This projection therefore keeps one entry per local-import
 * claim and one entry for the build-order claim.  Repeated evidence for the same
 * key joins in FOUR; distinct keys remain distinct.
 *
 * @metroplatSubject source-code
 */
import { joinReadingsKnowledge } from "../substrate/valuation.mjs";

import { artifactId } from "@red-cup-engineering/semiotic-eavt-services-section/identity";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Unified paraconsistent Monitor aggregate.
 *
 * This is the canonical Monitor output for the source-code domain: a single
 * content-addressed artifact carrying the package-level reading and per-subsystem
 * evidence, ready for consumption by the MAPE-K Analyze phase. */

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function claim(key, readings) {
  const reading = joinReadingsKnowledge(readings);
  return Object.freeze({ key, reading, evidence: Object.freeze([
    `claim:${key}`, `evidence-count:${readings.length}`, `reading:${reading}`,
    ...readings.map((value, index) => `evidence-${index}:${value}`),
  ]) });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Derive the unified paraconsistent Monitor aggregate from a completed
 * source-code policy evaluation.
 *
 * The optional topology valuation is accepted only to preserve the operation's
 * evaluation boundary; aggregate claims are derived from primary rulings, not
 * from topology counts. */
export function readSourceCodeMonitorAggregate(
  evaluation,
  topology,
  scope,
) {
  void topology;
  const readingsByKey = new Map();
  for (const ruling of evaluation.rulings) {
    const key = ruling.kind === "metroplat.monitoring.source-code.local-import-ruling"
      ? `local-import:${ruling.from}->${ruling.to}`
      : ruling.kind === "metroplat.monitoring.source-code.module-build-order-ruling"
        ? "module-build-order"
        : undefined;
    if (key === undefined) continue;
    const readings = readingsByKey.get(key) ?? [];
    readings.push(ruling.judgement);
    readingsByKey.set(key, readings);
  }
  const claims = Object.freeze([...readingsByKey.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, readings]) => claim(key, readings)));

  const semantic = Object.freeze({
    kind: "metroplat.monitoring.source-code.aggregate",
    source: evaluation.source,
    topology: evaluation.topology,
    observation: evaluation.observation,
    claims,
    ...(scope === undefined ? {} : {
      sourceDirs: Object.freeze([...scope.sourceDirs]),
      files: scope.files,
      ...(scope.truncated ? { truncated: true } : {}),
    }),
  });

  return Object.freeze({
    ...semantic,
    id: artifactId(semantic),
    evidence: Object.freeze([
      `source:${evaluation.source}`,
      `claims:${claims.length}`,
      ...(scope === undefined ? [] : [
        `files:${scope.files}`,
        `scope:${scope.truncated ? "truncated" : "complete"}`,
      ]),
      "lattice:belnap-join-only-within-claim-key",
    ]),
  });
}
