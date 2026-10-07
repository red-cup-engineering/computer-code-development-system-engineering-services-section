/**
 * @packageDocumentation
 *
 * Pure temporal projection of already-admitted module-cohesion outcomes.
 * Journal traversal belongs to the application adapter in monitoring/operations.
 *
 * @metroplatSubject source-code
 */
import {
  moduleCohesionHistoryContract,

} from "./schema.mjs";
import { recordHistoryOfStages } from "../../substrate/history.mjs";

/** Fold distinct consecutive cohesion observations from at most 31 explicit dates. */
export function moduleCohesionHistoryOfStages(
  dates,
  source,
  options = {},
) {
  const history = recordHistoryOfStages(dates, source.stages, (stage) => stage.valuation.record, options);
  return moduleCohesionHistoryContract.assert(Object.freeze({
    kind: "metroplat.monitoring.source-code.module-cohesion-history",
    dates: history.dates,
    rows: source.rows,
    malformed: source.malformed,
    observations: history.observations,
    stages: history.stages,
    transitions: history.transitions,
  }), "module cohesion history");
}
