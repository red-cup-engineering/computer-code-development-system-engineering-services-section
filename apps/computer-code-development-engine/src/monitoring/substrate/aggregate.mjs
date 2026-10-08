/**
 * @packageDocumentation
 *
 * Domain-neutral MAPE-K Monitor aggregate.
 *
 * The aggregate primitive turns a list of named *subsystem* signals — each
 * carrying a `FourCensus` of findings — into a single content-addressed
 * `MonitorAggregate`: the canonical Monitor (M) output ready for the
 * Analyze (A) phase of the MAPE-K loop.
 *
 * The join is paraconsistency-preserving: positive and negative evidence
 * accumulate independently across subsystems; contradictions are never
 * cancelled.  This is the same guarantee `joinReadingsKnowledge` provides
 * at the node level, lifted to the subsystem level.
 *
 * ## Why this is the substrate and not the application
 *
 * Source-code monitoring (`readSourceCodeMonitorAggregate`) was the first
 * domain to need this pattern.  Proof-health monitoring (`readProofHealthMonitorAggregate`)
 * is the second.  The pattern — join N named subsystem FourCensuses into one
 * package reading — belongs to the platform, not to any single domain.  New
 * domains plug in by calling `subsystemEntry` and `readMonitorAggregate`.
 */
import {
  addEvidenceRecords,
  readingOfEvidenceRecord,
  evidenceRecord,
  evidenceRecordOfFourCensus,

} from "@red-cup-engineering/metrologic/articulation/predicating/positing/evidence-record";

/** Translate a domain `FourCensus` (`held`/`denied`/`contested`/`unknown`) into
 *  the Belnap-named shape `evidenceRecordOfFourCensus` expects
 *  (`potential`/`active`/`stable`/`absurd`) — the same correspondence
 *  `joinReadingsKnowledge` uses at the node level, lifted to a census. */
function evidenceRecordOfDomainCensus(census) {
  return evidenceRecordOfFourCensus({
    potential: census.held,
    active: census.denied,
    stable: census.contested,
    absurd: census.unknown,
  });
}

import { artifactId } from "@red-cup-engineering/semiotic-eavt-services-section/identity";
import { readingOfSides } from "@red-cup-engineering/computer-data-services-section/four";

// ---------------------------------------------------------------------------
// SubsystemReadingEntry
// ---------------------------------------------------------------------------

/**
 * Per-subsystem paraconsistent reading entry within a `MonitorAggregate`.
 *
 * One entry per named subsystem.  The `record` field is suitable for direct
 * use in `addEvidenceRecords` joins and in `recordHistoryOfStages` temporal
 * tracking. */

/**
 * Construct a `SubsystemReadingEntry` from a `FourCensus`.
 *
 * `extra` is an optional list of additional evidence strings appended after the
 * standard diagnostic fields (subsystem name, reading, census counts). */
export function subsystemEntry(
  name,
  census,
  extra = [],
) {
  const record = evidenceRecordOfDomainCensus(census);
  const reading = readingOfSides("extremal", record.pos > 0, record.neg > 0);
  return Object.freeze({
    name,
    reading,
    record,
    census,
    evidence: Object.freeze([
      `subsystem:${name}`,
      `reading:${reading}`,
      `held:${census.held}`,
      `denied:${census.denied}`,
      `contested:${census.contested}`,
      `unknown:${census.unknown}`,
      ...extra,
    ]),
  });
}

// ---------------------------------------------------------------------------
// MonitorAggregate
// ---------------------------------------------------------------------------

/**
 * The generic, content-addressed Monitor (M) output.
 *
 * Every monitoring domain — source-code, proof-health, infrastructure,
 * supply-chain, knowledge-graph — produces a `MonitorAggregate` by calling
 * `readMonitorAggregate`.  Domain-specific aggregates may embed or extend this
 * structure with domain-specific fields. */

  
  
  
  

    

/**
 * Produce a content-addressed `MonitorAggregate` from a list of subsystem
 * reading entries.
 *
 * The package-level reading is the knowledge-lattice join of all subsystem
 * evidence records: `pos` and `neg` accumulate independently (no cancellation).
 *
 * Passing an empty `subsystems` list produces `reading: "unknown"`.
 *
 * This is the canonical factory.  Domain-specific Monitor functions call this
 * and optionally wrap the result in a richer domain-specific type. */
export function readMonitorAggregate(
  name,
  subsystems,
) {
  const zero = evidenceRecord(0, 0);
  const packageRecord = subsystems.reduce(
    (acc, entry) => addEvidenceRecords(acc, entry.record),
    zero,
  );
  const packageReading = readingOfSides("extremal", packageRecord.pos > 0, packageRecord.neg > 0);

  const semantic = Object.freeze({
    kind: "metroplat.monitoring.aggregate",
    name,
    reading: packageReading,
    record: packageRecord,
    subsystems: Object.freeze([...subsystems]),
  });

  return Object.freeze({
    ...semantic,
    id: artifactId(semantic),
    evidence: Object.freeze([
      `name:${name}`,
      `reading:${packageReading}`,
      `subsystems:${subsystems.length}`,
      `pos:${packageRecord.pos}`,
      `neg:${packageRecord.neg}`,
      "lattice:belnap-knowledge-join-of-subsystem-records",
      ...subsystems.map((s) => `subsystem-${s.name}:${s.reading}`),
    ]),
  });
}
