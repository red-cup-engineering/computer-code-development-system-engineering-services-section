import { fileURLToPath } from "node:url";
import { createSemanticRecordJournal } from "@red-cup-engineering/computer-code-engineering-services-section/semiotic-eavt/record-semantic-record";
import { runMission as defaultRunMission } from "./mission-runtime.mjs";

export const MISSION_EXECUTION_ROOT = fileURLToPath(new URL("../..", import.meta.url));
export const DEFAULT_MISSION_EXECUTION_DATA_ROOT = fileURLToPath(new URL("../../data", import.meta.url));
export const ROUTE_OBSERVATION_CATEGORY = "software-mission-execution.route-observation";

async function appendRouteObservation(record, { dataRoot }) {
  const successful = record.finalVerified || record.finalAnswered;
  const receipt = createSemanticRecordJournal({
    root: dataRoot,
    objectKind: "software-mission-execution.route-observation",
  }).record({
    category: ROUTE_OBSERVATION_CATEGORY,
    recordedAt: record.finishedAt,
    record,
    told: { for: successful, against: !successful },
    relation: { subject: record.id, predicate: "routes", object: record.continuation },
  });
  return Object.freeze({ ...receipt, documentNi: receipt.id, reference: null });
}

/**
 * Deterministically project one mission execution result into the effect that
 * control-plane consumers may observe.  Provider selection and inference stay
 * inside `runMission`; this boundary only classifies their received result.
 */
export function routeMissionEffect(mission, execution, { finishedAt } = {}) {
  if (!mission || typeof mission.id !== "string" || mission.id.length === 0) {
    throw new TypeError("mission routing requires one identified mission");
  }
  if (!execution || typeof execution !== "object" || !execution.outcome || typeof execution.outcome !== "object") {
    throw new TypeError("mission routing requires an execution outcome");
  }
  if (typeof finishedAt !== "string" || finishedAt.length === 0) {
    throw new TypeError("mission routing requires one observed finish time");
  }
  const finalVerified = execution.outcome.verified === true;
  const finalAnswered = execution.outcome.answered === true;
  const continuation = execution.processNode?.fixedPoint
    ? { state: "obstructed-fixed-point", obstruction: execution.processNode.fixedPoint }
    : finalVerified
      ? { state: "awaiting-customer-induction" }
      : finalAnswered
        ? { state: "answered" }
        : { state: "durable-demand-open", nextAct: "return-to-capability-market" };
  return Object.freeze({
    type: "SoftwareMissionExecutionEffect",
    id: mission.id,
    routePolicy: "enterprise-memory-pulse-only",
    taskClass: mission.taskClass || null,
    finishedAt,
    finalVerified,
    finalAnswered,
    phaseCount: 1,
    inferenceAttempts: Number.isSafeInteger(execution.metrics?.inferenceAttempts) ? execution.metrics.inferenceAttempts : 0,
    usefulCompletions: Number.isSafeInteger(execution.metrics?.usefulCompletions) ? execution.metrics.usefulCompletions : 0,
    directInteractiveModelCalls: Number.isSafeInteger(execution.metrics?.directInteractiveModelCalls) ? execution.metrics.directInteractiveModelCalls : 0,
    nextActCarrier: "software-trajectory-memory-service",
    continuation: Object.freeze(continuation),
  });
}

export async function runMissionPipeline(mission, {
  runMission = defaultRunMission,
  recordRouteObservation = appendRouteObservation,
  signal,
  customerActor,
  dataRoot = process.env.CODE_DEVELOPMENT_MISSION_DATA_ROOT ?? DEFAULT_MISSION_EXECUTION_DATA_ROOT,
} = {}) {
  if (mission.maxTokens != null) throw new Error("mission maxTokens is retired; provider capacity and market consideration determine admissible output");
  const current = await runMission(mission, {
    signal,
    customerActor,
    dataRoot,
  });
  const phases = [{ kind: "enterprise-knowledge-pulse", result: current }];

  const observation = routeMissionEffect(mission, current, { finishedAt: new Date().toISOString() });
  const routeRecord = await recordRouteObservation(observation, {
    dataRoot,
  });
  return { ...current, phases, route: { ...observation, networkReference: routeRecord.reference, semanticId: routeRecord.documentNi } };
}
