/** The code-development agent domain: an agent developing this codebase under FeltOS's agent
 * kernel. It pages in root orientation, the source-code and proof-health monitor aggregates,
 * the work dispatch, skill proposals, recalled prior context, the MetroPlat action surface and
 * the session's token window; it plans doctrine orientation, governed work selection, learning
 * review, focused verification and monitor responses; and it actuates monitor responses by
 * re-running the monitor aggregates. */

import { agentDomain } from "@red-cup-engineering/feltos/agents/domain";
import {
  contextPage,
  generalPageFault,
  priorContextPages,
  skillProposalsPage,
  workDispatchPage,
  writebackDuty,
} from "@red-cup-engineering/feltos/agents/context-image";
import {
  dispatchMoves,
  monitorReadingMoves,
  numberOf,
  proposalMoves,
  record,
  strategyGate as gate,
  strategyMove as move,
  strategyStateForDispatch,
  strategyStateForSkillProposals,
} from "@red-cup-engineering/feltos/agents/strategy";

export const CODE_DEVELOPMENT_ACTOR = "agent:codex";
export const CODE_DEVELOPMENT_GOAL = "continue governed metroplat development";

/** Monitor-response moves and the monitor aggregate operation each one re-runs. */
export const CODE_DEVELOPMENT_MOVE_OPERATIONS = Object.freeze({
  "verify:codebase-monitor": "source-code-monitor-aggregate",
  "verify:proof-health-monitor": "proof-health-monitor-aggregate",
});

function records(value) {
  return Array.isArray(value)
    ? Object.freeze(value.map(record).filter((entry) => entry !== undefined))
    : Object.freeze([]);
}

function monitoringClaimsOf(monitoring) {
  const m = record(monitoring);
  return Array.isArray(m?.["claims"]) ? m["claims"] : Object.freeze([]);
}

function aggregateReadingOf(monitoring) {
  const m = record(monitoring);
  const reading = m?.["reading"];
  return typeof reading === "string" ? reading : "unknown";
}

function toolSurfaceActionCount(toolSurface) {
  const surface = record(toolSurface);
  const actions = records(surface?.["actions"]);
  const tools = records(surface?.["tools"]);
  return Math.max(actions.length, tools.length);
}

function tokenWindowEvidence(tokenUsage) {
  const usage = record(tokenUsage);
  const total = record(usage?.["total"]);
  const attributes = record(usage?.["genAiAttributes"]);
  const modelContextWindow = usage?.["modelContextWindow"];
  const pressure = usage?.["contextWindowPressure"];
  return Object.freeze([
    ...(typeof modelContextWindow === "number" ? [`model-context-window:${modelContextWindow}`] : ["model-context-window:unknown"]),
    ...(typeof total?.["totalTokens"] === "number" ? [`used-tokens:${total["totalTokens"]}`] : ["used-tokens:unknown"]),
    ...(typeof pressure === "number" ? [`context-window-pressure:${pressure}`] : []),
    ...(typeof attributes?.["gen_ai.usage.cache_read.input_tokens"] === "number" ? [`cache-read-tokens:${attributes["gen_ai.usage.cache_read.input_tokens"]}`] : []),
    ...(typeof attributes?.["gen_ai.usage.reasoning.output_tokens"] === "number" ? [`reasoning-output-tokens:${attributes["gen_ai.usage.reasoning.output_tokens"]}`] : []),
  ]);
}

function pages(input) {
  return [
    contextPage({
      id: "page:orientation",
      layer: "orientation",
      state: input.orientation === undefined ? "required" : "resident",
      priority: 95,
      source: "agent-orientation",
      summary: input.orientation === undefined ? "root and package orientation must be paged before dispatch" : "orientation settlement resident",
      ...(input.orientation === undefined ? {} : { material: input.orientation }),
      evidence: Object.freeze([input.orientation === undefined ? "orientation:page-fault" : "orientation:resident"]),
    }),
    contextPage({
      id: "page:monitoring",
      layer: "monitoring",
      state: input.monitoring === undefined ? "evicted" : "resident",
      priority: 88,
      source: "source-code-monitor-aggregate",
      summary: input.monitoring === undefined
        ? "codebase monitor aggregate not supplied"
        : `codebase monitor claims resident; claims:${monitoringClaimsOf(input.monitoring).length}`,
      ...(input.monitoring === undefined ? {} : { material: input.monitoring }),
      evidence: Object.freeze([
        input.monitoring === undefined ? "monitoring:not-observed" : `monitoring-claims:${monitoringClaimsOf(input.monitoring).length}`,
      ]),
    }),
    contextPage({
      id: "page:proof-health",
      layer: "monitoring",
      state: input.proofHealth === undefined ? "evicted" : "resident",
      priority: 87,
      source: "proof-health-monitor-aggregate",
      summary: input.proofHealth === undefined
        ? "proof-health monitor aggregate not supplied"
        : `proof-health monitor aggregate resident; reading:${aggregateReadingOf(input.proofHealth)}`,
      ...(input.proofHealth === undefined ? {} : { material: input.proofHealth }),
      evidence: Object.freeze([
        input.proofHealth === undefined ? "proof-health:not-observed" : `proof-health-reading:${aggregateReadingOf(input.proofHealth)}`,
      ]),
    }),
    workDispatchPage(input.workDispatch),
    skillProposalsPage(input.skillProposals),
    ...priorContextPages(input.priorContext),
    contextPage({
      id: "page:tool-surface",
      layer: "tool-surface",
      state: input.toolSurface === undefined ? "required" : "resident",
      priority: 83,
      source: "metroplat-action-surface",
      summary: input.toolSurface === undefined ? "MetroPlat action/tool surface missing" : `MetroPlat actions:${toolSurfaceActionCount(input.toolSurface)}`,
      ...(input.toolSurface === undefined ? {} : { material: input.toolSurface }),
      evidence: Object.freeze([input.toolSurface === undefined ? "tool-surface:page-fault" : `tool-surface-actions:${toolSurfaceActionCount(input.toolSurface)}`]),
    }),
    contextPage({
      id: "page:token-window",
      layer: "token-window",
      state: input.tokenUsage === undefined ? "required" : "resident",
      priority: 75,
      source: "agent-session-token-usage",
      summary: input.tokenUsage === undefined ? "token window/accounting unavailable" : "token window/accounting resident",
      ...(input.tokenUsage === undefined ? {} : { material: input.tokenUsage }),
      evidence: tokenWindowEvidence(input.tokenUsage),
    }),
    contextPage({
      id: "page:writeback-duties",
      layer: "writeback",
      state: "resident",
      priority: 70,
      source: "agent-context-image",
      summary: "effect report, context delta, token usage, and learning candidates must be written back",
      evidence: Object.freeze(["writeback:effect-report", "writeback:context-delta", "writeback:learning-candidate"]),
    }),
  ];
}

function pageFault(candidate) {
  if (candidate.layer === "orientation") return { reason: "orientation page is not resident", requiredBefore: "dispatch" };
  if (candidate.layer === "token-window") return { reason: "token window accounting is not resident", requiredBefore: "tool-call" };
  if (candidate.layer === "tool-surface") return { reason: `${candidate.source} is not resident`, requiredBefore: "tool-call" };
  return generalPageFault(candidate);
}

function writeback(input) {
  return Object.freeze([
    writebackDuty("writeback:effect-report", "required", "data/journals/work-ledger", Object.freeze(["effects must be recorded before publication"])),
    writebackDuty("writeback:context-delta", "required", "agent-session/continuation", Object.freeze(["newly learned context must be carried forward"])),
    writebackDuty(
      "writeback:token-usage",
      input.tokenUsage === undefined ? "required" : "satisfied",
      "agent-session/token-usage",
      Object.freeze([input.tokenUsage === undefined ? "token-usage:missing" : "token-usage:resident"]),
    ),
    writebackDuty("writeback:learning-candidate", "required", "skill-or-memory-review", Object.freeze(["learning is reviewable, not self-installed"])),
  ]);
}

/** What the two monitors read: source-code claims keyed by claim (no package-level reading),
 * and the proof-health aggregate's reading. */
function diagnose(observation) {
  const monitoringPage = observation.pages.find((candidate) => candidate.id === "page:monitoring");
  const proofHealthPage = observation.pages.find((candidate) => candidate.id === "page:proof-health");
  const monitoringClaims = monitoringPage?.state === "resident"
    ? monitoringClaimsOf(monitoringPage.material)
    : Object.freeze([]);
  const proofHealthReading = proofHealthPage?.state === "resident"
    ? (aggregateReadingOf(proofHealthPage.material))
    : "unknown";
  return {
    fields: { monitoringClaims, proofHealthReading },
    rules: [
      "monitoring-claims-sourced-from-source-code-monitor-aggregate",
      "proof-health-reading-sourced-from-proof-health-monitor-aggregate",
    ],
    evidence: [
      `monitoring-claims:${monitoringClaims.length}`,
      `proof-health-reading:${proofHealthReading}`,
    ],
  };
}

function monitoringStrategyMoves(monitoringClaims, diagnosisId) {
  const claim = monitoringClaims.map(record).find((candidate) =>
    candidate?.["reading"] === "denied" || candidate?.["reading"] === "contested");
  if (claim === undefined) return Object.freeze([]);
  return monitorReadingMoves({
    reading: claim["reading"],
    diagnosisId,
    moveId: "verify:codebase-monitor",
    source: "source-code-monitor-aggregate",
    subject: "codebase",
    readingTag: `monitoring-claim:${String(claim["key"] ?? "unknown")}`,
  });
}

function proofHealthStrategyMoves(proofHealthReading, diagnosisId) {
  return monitorReadingMoves({
    reading: proofHealthReading,
    diagnosisId,
    moveId: "verify:proof-health-monitor",
    source: "proof-health-monitor-aggregate",
    subject: "proof-health corpus",
    readingTag: "proof-health-reading",
  });
}

/** Plan: orient on doctrine and prior art, select governed ready work, review reviewable
 * learning, verify the touched contract, and respond to non-held monitor readings. */
function strategize(input) {
  const orientation = record(input.orientation);
  const { diagnosis, diagnosisId } = input;
  const monitoringClaims = Array.isArray(diagnosis?.["monitoringClaims"])
    ? diagnosis["monitoringClaims"] : Object.freeze([]);
  // Read the proof-health reading surfaced by diagnoseAgentContext from the proof-health Monitor aggregate.
  const proofHealthReading = typeof diagnosis?.["proofHealthReading"] === "string"
    ? diagnosis["proofHealthReading"]
    : "unknown";
  const dispatch = record(input.dispatch);
  const skillProposals = record(input.skillProposals);
  const workMoves = dispatchMoves(dispatch, CODE_DEVELOPMENT_ACTOR);
  const learningMoves = proposalMoves(skillProposals);
  const monitorMoves = monitoringStrategyMoves(monitoringClaims, diagnosisId);
  const proofHealthMoves = proofHealthStrategyMoves(proofHealthReading, diagnosisId);
  const orientationReady = orientation !== undefined;
  const dispatchState = strategyStateForDispatch(dispatch, workMoves);
  const skillProposalState = strategyStateForSkillProposals(skillProposals);
  // Monitoring strategy state: waiting when no data, waiting when held, ready when action needed.
  const monitorState = monitorMoves.length > 0 ? "ready" : "waiting";
  const proofHealthState = proofHealthMoves.length > 0 ? "ready" : "waiting";
  const gates = Object.freeze([
    gate("analyze-context", diagnosisId === undefined ? "required" : "satisfied", "agent-context-diagnosis", Object.freeze([
      diagnosisId === undefined ? "diagnosis:missing" : `diagnosis:${diagnosisId}`,
    ])),
    gate("read-root-orientation", orientationReady ? "satisfied" : "required", "agent-orientation", Object.freeze([
      orientationReady ? "orientation:present" : "orientation:missing",
    ])),
    gate("refresh-external-comparator", "required", "operator-session-protocol", Object.freeze(["not inferable from local service action"])),
    gate("read-live-code", dispatch === undefined ? "required" : "satisfied", "agent-work-dispatch", Object.freeze([
      dispatch === undefined ? "dispatch:missing" : `dispatch:${String(dispatch["kind"] ?? "present")}`,
    ])),
    gate("read-prior-research", "required", "operator-session-protocol", Object.freeze(["not inferable from local service action"])),
    gate("select-governed-work", dispatchState === "blocked" ? "blocked" : workMoves.length > 0 ? "satisfied" : "required", "agent-work-dispatch", Object.freeze([
      `dispatch-state:${dispatchState}`,
      `ready-moves:${workMoves.length}`,
    ])),
    gate("review-skill-proposals", skillProposalState === "ready" ? "satisfied" : "required", "skill-proposals", Object.freeze([
      `skill-proposals:${skillProposalState}`,
      `reviewable:${numberOf(skillProposals?.["reviewable"])}`,
    ])),
    gate("human-skill-approval", numberOf(skillProposals?.["reviewable"]) > 0 ? "required" : "satisfied", "skill-proposals", Object.freeze([
      "promotion requires explicit human approval",
    ])),
    gate("focused-verification", "required", "operator-session-protocol", Object.freeze(["verify touched public contract"])),
    gate(
      "monitor-codebase-health",
      monitorMoves.length > 0 ? "required" : "satisfied",
      "source-code-monitor-aggregate",
      Object.freeze([`monitoring-claims:${monitoringClaims.length}`, `monitor-moves:${monitorMoves.length}`]),
    ),
    gate(
      "monitor-proof-health",
      // Satisfied when held (clean) or unknown (no data yet); required when denied/contested (action needed).
      proofHealthReading === "denied" || proofHealthReading === "contested" ? "required" : "satisfied",
      "proof-health-monitor-aggregate",
      Object.freeze([`proof-health-reading:${proofHealthReading}`, `proof-health-moves:${proofHealthMoves.length}`]),
    ),
  ]);
  const orientMove = move(
    "orient:doctrine-and-prior-art",
    "agent-orientation",
    "orient-before-action",
    orientationReady ? "ready" : "waiting",
    {
      priority: 1,
      reasons: Object.freeze(["root orientation", "prior research", "external comparator"]),
      evidence: Object.freeze([
        orientationReady ? "orientation:present" : "orientation:missing",
      ]),
    },
  );
  const verifyMove = move(
    "verify:focused-contract",
    "operator-session-protocol",
    "verify-governed-work",
    "ready",
    {
      priority: 8,
      reasons: Object.freeze(["focused verification"]),
      evidence: Object.freeze(["verification:required"]),
    },
  );
  const strategies = Object.freeze([
    Object.freeze({
      kind: "metroplat.agent.strategy",
      id: "doctrine-oriented-workflow",
      state: orientationReady ? "ready" : "waiting",
      gates: Object.freeze(["read-root-orientation", "refresh-external-comparator", "read-prior-research"]),
      moves: Object.freeze([orientMove]),
      evidence: Object.freeze([
        "source:agent-orientation",
        orientationReady ? "state:ready" : "state:waiting",
      ]),
    }),
    Object.freeze({
      kind: "metroplat.agent.strategy",
      id: "governed-work-selection",
      state: dispatchState,
      gates: Object.freeze(["read-live-code", "select-governed-work"]),
      moves: workMoves,
      evidence: Object.freeze([
        "source:agent-work-dispatch",
        `state:${dispatchState}`,
        `moves:${workMoves.length}`,
      ]),
    }),
    Object.freeze({
      kind: "metroplat.agent.strategy",
      id: "continuous-learning-review",
      state: skillProposalState,
      gates: Object.freeze(["review-skill-proposals", "human-skill-approval"]),
      moves: learningMoves,
      evidence: Object.freeze([
        "source:skill-proposals",
        `state:${skillProposalState}`,
        `moves:${learningMoves.length}`,
      ]),
    }),
    Object.freeze({
      kind: "metroplat.agent.strategy",
      id: "focused-verification",
      state: "ready",
      gates: Object.freeze(["focused-verification"]),
      moves: Object.freeze([verifyMove]),
      evidence: Object.freeze(["source:operator-session-protocol", "state:ready"]),
    }),
    Object.freeze({
      kind: "metroplat.agent.strategy",
      id: "codebase-monitor-response",
      state: monitorState,
      gates: Object.freeze(["monitor-codebase-health"]),
      moves: monitorMoves,
      evidence: Object.freeze([
        "source:source-code-monitor-aggregate",
        `monitoring-claims:${monitoringClaims.length}`,
        `state:${monitorState}`,
        `moves:${monitorMoves.length}`,
      ]),
    }),
    Object.freeze({
      kind: "metroplat.agent.strategy",
      id: "proof-health-monitor-response",
      state: proofHealthState,
      gates: Object.freeze(["monitor-proof-health"]),
      moves: proofHealthMoves,
      evidence: Object.freeze([
        "source:proof-health-monitor-aggregate",
        `proof-health-reading:${proofHealthReading}`,
        `state:${proofHealthState}`,
        `moves:${proofHealthMoves.length}`,
      ]),
    }),
  ]);
  return {
    view: [
      ...(orientation === undefined ? [] : ["agent-orientation"]),
      ...(dispatch === undefined ? [] : ["agent-work-dispatch"]),
      ...(skillProposals === undefined ? [] : ["skill-proposals"]),
      ...(diagnosisId === undefined ? [] : ["agent-context-diagnosis"]),
    ],
    gates,
    strategies,
    moves: [orientMove, ...workMoves, ...learningMoves, verifyMove, ...monitorMoves, ...proofHealthMoves],
    evidence: [
      `monitoring-claims:${monitoringClaims.length}`,
      `proof-health-reading:${proofHealthReading}`,
    ],
  };
}

export const codeDevelopmentAgentDomain = agentDomain({
  id: "code-development",
  actor: CODE_DEVELOPMENT_ACTOR,
  goal: CODE_DEVELOPMENT_GOAL,
  pages,
  pageFault,
  writeback,
  diagnose,
  strategize,
  operations: CODE_DEVELOPMENT_MOVE_OPERATIONS,
});
