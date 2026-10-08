import { census, knowledgeJoinAll, readingAs, sidesOfReading } from "@red-cup-engineering/computer-data-services-section/four";
/**
 * @packageDocumentation
 *
 * Domain-neutral Belnap reading assignment over any network of evidence-bearing
 * nodes.
 *
 * The core primitive is `joinReadingsKnowledge`: it takes a sequence of
 * `ReadingValueName` values — each representing one independent observation about
 * a node or edge — and produces the single paraconsistent reading that summarises
 * them all, without cancellation.
 *
 * The source-code monitoring domain uses this to derive per-module readings from
 * local-import policy rulings.  Any new domain — network topology, supply-chain
 * edges, agent dependency graphs, knowledge-graph assertions — can use the same
 * primitive directly.
 *
 * ## The guarantee
 *
 * `joinReadingsKnowledge` is a join in the Belnap *knowledge* lattice:
 *
 *   ⊥_K (absurd) ≤_K potential ≤_K stable ≥_K active ≥_K ⊥_K
 *
 * It accumulates evidence independently on both the positive (for) and negative
 * (against) dimensions.  Contradictions are preserved, never cancelled.  A node
 * with both conformant and violating evidence will always be `stable`, never
 * silently resolved to either verdict.
 */

// ---------------------------------------------------------------------------
// Evidence accumulation
// ---------------------------------------------------------------------------

/** A reading's positive and negative evidence mass: which of its sides are told (SignChain's sides). */
export function readingEvidence(reading) {
  const [forTold, againstTold] = sidesOfReading(reading);
  return Object.freeze({ pos: forTold ? 1 : 0, neg: againstTold ? 1 : 0 });
}

// ---------------------------------------------------------------------------
// Knowledge-lattice join
// ---------------------------------------------------------------------------

/**
 * Join a sequence of readings (extremal names) in the knowledge order: SignChain's knowledge join.
 * Each reading is an independent observation; the join accumulates evidence on both sides without
 * cancellation — told both is `contested`, told nothing (or an empty sequence) is `unknown`.
 */
export const joinReadingsKnowledge = (readings) => knowledgeJoinAll(readings, "extremal");

// ---------------------------------------------------------------------------
// FourCensus helpers
// ---------------------------------------------------------------------------

/**
 * Count entries by their `reading` (extremal names held/denied/contested/unknown): SignChain's census.
 * Returns a `FourCensus` for `subsystemEntry` in `src/monitoring/substrate/aggregate.mjs`.
 */
export function fourCensusOf(entries) {
  const counts = census(entries.map((entry) => readingAs("knowledge", entry.reading ?? "unknown")));
  return Object.freeze({ held: counts.potential, denied: counts.active, contested: counts.stable, unknown: counts.absurd });
}
