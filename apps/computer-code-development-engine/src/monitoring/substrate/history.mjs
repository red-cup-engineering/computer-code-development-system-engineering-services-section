/**
 * @packageDocumentation
 *
 * Domain-neutral temporal projection for any sequence of `EvidenceRecord`-valued
 * observations.
 *
 * `recordHistoryOfStages` is the single generic primitive that every monitoring
 * domain uses to turn an ordered stream of admitted observations into a bounded,
 * transition-annotated history — one that relates consecutive stages in both
 * Belnap's knowledge order (evidence accumulating) and truth order (conformance
 * direction).
 *
 * This is the substrate-level home of that primitive.  The source-code
 * monitoring domain re-exports from here for backward compatibility; any new
 * domain (infrastructure, supply-chain, knowledge-graph, …) imports directly.
 */
import { recordLeqK, recordLeqT } from "@red-cup-engineering/computer-data-engineering-services-section/four";

/** Compare two evidence records in the Belnap knowledge order.
 *
 * Knowledge ascending means more evidence was observed (pos ↑ or neg ↑ or both).
 * This is the accumulation direction — the monitor is learning more about the
 * domain regardless of whether the news is good or bad. */
export function recordKnowledgeRelation(
  left,
  right,
) {
  const forward = recordLeqK(left, right);
  const backward = recordLeqK(right, left);
  return forward && backward ? "equal" : forward ? "ascending" : backward ? "descending" : "incomparable";
}

/** Compare two evidence records in the Belnap truth order.
 *
 * Truth ascending means conformance is improving: positive support increasing
 * (pos ↑) while opposition decreases (neg ↓).  Truth descending signals
 * regression.  Incomparable means both dimensions moved simultaneously in
 * opposite directions — the paraconsistent monitor captures this without
 * collapsing to a single verdict. */
export function recordTruthRelation(
  left,
  right,
) {
  const forward = recordLeqT(left, right);
  const backward = recordLeqT(right, left);
  return forward && backward ? "equal" : forward ? "ascending" : backward ? "descending" : "incomparable";
}

/**
 * Order, consecutive-deduplicate, bound, and relate already-admitted stages.
 *
 * Generic over any `Stage` that carries `observation`, `at`, and `receipt`
 * fields.  The caller supplies `recordOf` to extract the `EvidenceRecord`
 * from each stage — this is the only domain-specific input.
 *
 * `dates` must be 1–31 `YYYY-MM-DD` strings.  `maxStages` (default 30,
 * max 100) bounds the returned window. */
export function recordHistoryOfStages(
  dates,
  stagesValue,
  recordOf,
  options = {},
)

 {
  const selectedDates = [...new Set(dates)].sort();
  if (
    selectedDates.length === 0 ||
    selectedDates.length > 31 ||
    selectedDates.some((date) => !/^\d{4}-\d{2}-\d{2}$/u.test(date))
  ) {
    throw new TypeError("source monitoring history requires 1 through 31 YYYY-MM-DD dates");
  }
  const maxStages = options.maxStages ?? 30;
  if (!Number.isInteger(maxStages) || maxStages < 1 || maxStages > 100) {
    throw new TypeError("source monitoring history maxStages must be an integer from 1 through 100");
  }
  const observed = [...stagesValue].sort(
    (left, right) => left.at.localeCompare(right.at) || left.receipt.localeCompare(right.receipt),
  );
  const distinct = observed.filter(
    (entry, index) => index === 0 || observed[index - 1]?.observation !== entry.observation,
  );
  const stages = Object.freeze(distinct.slice(-maxStages));
  const transitions = Object.freeze(
    stages.slice(1).map((current, index) => {
      const previous = stages[index];
      return Object.freeze({
        from: previous.observation,
        to: current.observation,
        knowledge: recordKnowledgeRelation(recordOf(previous), recordOf(current)),
        truth: recordTruthRelation(recordOf(previous), recordOf(current)),
      });
    }),
  );
  return Object.freeze({
    dates: Object.freeze(selectedDates),
    observations: observed.length,
    stages,
    transitions,
  });
}
