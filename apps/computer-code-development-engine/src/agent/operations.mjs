/** Agent operation read models. */
import { WORK_LEVELS } from "@red-cup-engineering/socializing";

const DEFAULT_ACTOR = "agent:codex";
const DEFAULT_GOAL = "continue governed metroplat development";

function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}

function records(value) {
  return Array.isArray(value)
    ? Object.freeze(value.map(record).filter((entry) => entry !== undefined))
    : Object.freeze([]);
}

function strings(value) {
  return Array.isArray(value)
    ? Object.freeze(value.filter((entry) => typeof entry === "string"))
    : Object.freeze([]);
}

function stringArrays(value) {
  return Array.isArray(value)
    ? Object.freeze(value.map(strings).filter((entry) => entry.length > 0))
    : Object.freeze([]);
}

function stringOf(value, fallback) {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function numberOf(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function numberEvidence(evidence, prefix) {
  const value = evidence.find((entry) => entry.startsWith(prefix))?.slice(prefix.length);
  const parsed = value === undefined ? NaN : Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function slug(value) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");
  return normalized.length === 0 ? "tool-study" : normalized.slice(0, 64).replace(/-$/u, "");
}

function levelOfScope(scope) {
  const separator = scope.indexOf(":");
  if (separator <= 0) return undefined;
  const level = scope.slice(0, separator);
  return (WORK_LEVELS).includes(level) ? level : undefined;
}

function workLanes(dispatch) {
  const queue = records(dispatch?.["queue"]);
  return Object.freeze(WORK_LEVELS.map((level) => {
    const items = queue.filter((item) => levelOfScope(stringOf(item["scope"], "")) === level);
    return Object.freeze({
      kind: "metroplat.agent.operations-work-lane",
      level,
      ready: items.filter((item) => item["state"] === "ready").length,
      blocked: items.filter((item) => item["state"] === "blocked").length,
      done: items.filter((item) => item["state"] === "done").length,
      scopes: Object.freeze(items.map((item) => stringOf(item["scope"], "work")).sort((left, right) => left.localeCompare(right))),
      evidence: Object.freeze([
        `level:${level}`,
        `items:${items.length}`,
      ]),
    });
  }));
}

function template(
  id,
  state,
  useWhen,
  gates,
  evidence,
) {
  return Object.freeze({
    kind: "metroplat.agent.operations-template",
    id,
    state,
    useWhen,
    gates: Object.freeze(gates),
    evidence: Object.freeze(evidence),
  });
}

function templates(dispatch, turn) {
  const ready = records(dispatch?.["queue"]).filter((item) => item["state"] === "ready").length;
  const invocations = records(turn?.["invocations"]).length;
  return Object.freeze([
    template("pipeline", invocations > 0 ? "required" : "available", "later work depends on earlier outputs", Object.freeze(["handoff-predicates", "effect-report", "verification"]), Object.freeze(["prior-art:work-unit-chain"])),
    template("fan-out", ready > 1 ? "required" : "available", "ready work can be partitioned by disjoint regions", Object.freeze(["region-partition", "non-interference", "evidence-state"]), Object.freeze(["prior-art:directory-partitioned-fan-out"])),
    template("read-audit-fix", "available", "an audit report can drive a bounded fix pass", Object.freeze(["read-only-audit", "fix-effect-report", "fixed-point-test"]), Object.freeze(["prior-art:read-audit-fix-cycle"])),
    template("incremental-closure", "available", "a monotone configuration pass should converge", Object.freeze(["monotone-generator", "convergence-metric", "idempotence"]), Object.freeze(["prior-art:incremental-config-expansion"])),
    template("human-control-dispatch", "required", "autonomous dispatch needs accountable authorization and refusal paths", Object.freeze(["authorization", "safe-envelope", "evidence-state", "certifiability"]), Object.freeze(["prior-art:meaningful-human-control"])),
  ]);
}

function controlGate(
  name,
  state,
  source,
  evidence,
) {
  return Object.freeze({
    kind: "metroplat.agent.operations-control-gate",
    name,
    state,
    source,
    evidence: Object.freeze(evidence),
  });
}

function strategyGateState(strategy, name) {
  const gate = records(strategy?.["gates"]).find((entry) => entry["name"] === name);
  const state = gate?.["state"];
  return state === "satisfied" ? "ready" : state === "blocked" ? "blocked" : state === "required" ? "required" : undefined;
}

function controlGates(input

) {
  const turnInvocations = records(input.turn?.["invocations"]);
  const missingEffectReport = turnInvocations.length > 0;
  return Object.freeze([
    controlGate("orientation", input.orientation === undefined ? "required" : "ready", "agent-orientation", Object.freeze([
      input.orientation === undefined ? "orientation:missing" : "orientation:present",
    ])),
    controlGate("prior-research", strategyGateState(input.strategy, "read-prior-research") ?? "required", "agent-strategy", Object.freeze(["archive research must be explicit before execution"])),
    controlGate("external-comparator", strategyGateState(input.strategy, "refresh-external-comparator") ?? "required", "agent-strategy", Object.freeze(["contemporary framework comparator is turn-local evidence"])),
    controlGate("live-code", strategyGateState(input.strategy, "read-live-code") ?? "required", "agent-strategy", Object.freeze(["code must be read before edits"])),
    controlGate("work-trace", input.dispatch === undefined ? "required" : "ready", "agent-work-dispatch", Object.freeze([
      input.dispatch === undefined ? "dispatch:missing" : `coordination:${stringOf(input.dispatch["coordination"], "unknown")}`,
    ])),
    controlGate("human-approval", strategyGateState(input.strategy, "human-skill-approval") ?? "ready", "skill-proposals", Object.freeze(["skill promotion and critical decisions require approval"])),
    controlGate("cost-attribution", input.inferenceCost === undefined ? "required" : "ready", "inference-cost", Object.freeze([
      input.inferenceCost === undefined ? "inference-cost:missing" : "inference-cost:present",
    ])),
    controlGate("effect-report", missingEffectReport ? "required" : "ready", "work-unit-lifecycle", Object.freeze(["each executed work unit must report created/modified/deleted effects"])),
    controlGate("evidence-state", turnInvocations.length > 0 ? "required" : "ready", "meaningful-human-control", Object.freeze(["dispatch must preserve the accountable transaction chain"])),
    controlGate("verification", strategyGateState(input.strategy, "focused-verification") ?? "required", "agent-strategy", Object.freeze(["verify touched public contract"])),
  ]);
}

function approvals(
  gates,
  skillProposals,
  dispatch,
) {
  const skillApprovals = records(skillProposals?.["proposals"])
    .filter((proposal) => proposal["state"] === "reviewable")
    .map((proposal) => Object.freeze({
      kind: "metroplat.agent.operations-approval",
      id: stringOf(proposal["id"], "skill-proposal"),
      source: "skill-proposals",
      reason: "reviewable skill proposal cannot promote itself",
      state: "required",
      evidence: Object.freeze(strings(proposal["evidence"])),
    }));
  const dispatchApproval = stringOf(dispatch?.["coordination"], "clear") === "coordination-required"
    ? [Object.freeze({
      kind: "metroplat.agent.operations-approval",
      id: "dispatch-coordination",
      source: "agent-work-dispatch",
      reason: "governance reported coordination-required",
      state: "required",
      evidence: Object.freeze(["coordination:coordination-required"]),
    })]
    : [];
  const gateApprovals = gates
    .filter((gate) => gate.state === "blocked")
    .map((gate) => Object.freeze({
      kind: "metroplat.agent.operations-approval",
      id: `gate:${gate.name}`,
      source: gate.source,
      reason: `blocked gate:${gate.name}`,
      state: "required",
      evidence: gate.evidence,
    }));
  return Object.freeze([...skillApprovals, ...dispatchApproval, ...gateApprovals]);
}

function harnessRoute(
  summary,
  state,
  rationale,
  options = {},
) {
  return Object.freeze({
    kind: "metroplat.agent.operations-harness-route",
    state,
    observedTool: summary.tool,
    observedAction: summary.action,
    calls: summary.calls,
    ...(options.route === undefined ? {} : { route: options.route }),
    ...(options.gap === undefined ? {} : { gap: options.gap }),
    rationale,
    examples: summary.examples,
    evidence: Object.freeze([
      `observed-tool:${summary.tool}`,
      `observed-action:${summary.action}`,
      `calls:${summary.calls}`,
      `state:${state}`,
      ...(options.route === undefined ? [] : [`route:${options.route}`]),
      ...(options.gap === undefined ? [] : [`gap:${options.gap}`]),
    ]),
  });
}

function harnessRouteOf(summary) {
  const action = summary.action;
  if (summary.tool === "apply_patch" || action === "apply-patch") {
    return harnessRoute(summary, "missing", "patch application needs a validated edit action with effect reporting", {
      gap: "validated-edit-action",
    });
  }
  if (summary.tool === "write_stdin" || action === "text-input") {
    return harnessRoute(summary, "missing", "ongoing process I/O needs an explicit process-session route instead of opaque terminal continuation", {
      gap: "process-session-io-route",
    });
  }
  if (action === "rg" || action === "grep") {
    return harnessRoute(summary, "available", "literal workspace search can route through the workspace-text-search service action; symbol and note searches still have specialized readouts", {
      route: "service-action:workspace-text-search",
    });
  }
  if (action === "find") {
    return harnessRoute(summary, "partial", "file discovery can route through file-census for inventory, but queryable path predicates are still a gap", {
      route: "service-action:file-census",
      gap: "queryable-file-census",
    });
  }
  if (action === "sed" || action === "nl" || action === "cat" || action === "head" || action === "tail") {
    return harnessRoute(summary, "available", "bounded source inspection can route through the workspace-file-slice service action", {
      route: "service-action:workspace-file-slice",
    });
  }
  if (action === "git") {
    return harnessRoute(summary, "available", "workspace status and bounded diff summaries can route through the workspace-change-readout service action", {
      route: "service-action:workspace-change-readout",
    });
  }
  if (action === "node" || action === "pnpm") {
    return harnessRoute(summary, "missing", "test/build/script execution needs a governed verification runner with captured outputs and effect attribution", {
      gap: "verification-runner",
    });
  }
  if (action === "curl") {
    return harnessRoute(summary, "partial", "HTTP smoke checks can target MetroPlat faces, but they need a typed smoke-readout instead of ad hoc curl", {
      route: "http-face",
      gap: "http-smoke-readout",
    });
  }
  if (action.startsWith("fields:")) {
    return harnessRoute(summary, "missing", "structured harness control calls should be represented as agent protocol state, not opaque tool arguments", {
      gap: "agent-control-service-action",
    });
  }
  return harnessRoute(summary, "missing", "no specific MetroPlat route is known for this observed tool action yet", {
    gap: "tool-specific-metroplat-route",
  });
}

function toolStudySummary(toolStudy) {
  if (toolStudy === undefined) return undefined;
  const tools = records(toolStudy["tools"]).map((tool) => Object.freeze({
    kind: "metroplat.agent.operations-tool-study-tool",
    name: stringOf(tool["name"], "tool"),
    calls: numberOf(tool["calls"]),
  })).sort((left, right) => right.calls - left.calls || left.name.localeCompare(right.name));
  const toolArgumentSummaries = records(toolStudy["toolArgumentSummaries"]).map((summary) => Object.freeze({
    kind: "metroplat.agent.operations-tool-argument-summary",
    tool: stringOf(summary["tool"], "tool"),
    action: stringOf(summary["action"], "unknown-action"),
    calls: numberOf(summary["calls"]),
    examples: strings(summary["examples"]),
  })).sort((left, right) =>
    right.calls - left.calls
    || left.tool.localeCompare(right.tool)
    || left.action.localeCompare(right.action));
  const harnessRoutes = toolArgumentSummaries.map(harnessRouteOf);
  const recurringToolSequences = records(toolStudy["recurringToolSequences"]).map((candidate) => Object.freeze({
    kind: "metroplat.agent.operations-tool-sequence",
    chain: strings(candidate["chain"]),
    support: numberOf(candidate["support"]),
    sessions: strings(candidate["sessions"]),
    argShapes: stringArrays(candidate["argShapes"]),
    excludedInvalid: numberOf(candidate["excludedInvalid"]),
  })).sort((left, right) =>
    right.support - left.support
    || right.chain.length - left.chain.length
    || left.chain.join(">").localeCompare(right.chain.join(">")));
  const sampledToolUses = records(toolStudy["studies"]).flatMap((study) => {
    const session = stringOf(study["sessionId"], stringOf(study["source"], "codex-session"));
    return records(study["calls"]).map((call) => Object.freeze({
      kind: "metroplat.agent.operations-tool-use-sample",
      session,
      tool: stringOf(call["tool"], "tool"),
      outputStatus: stringOf(call["outputStatus"], "unknown"),
      ...(typeof call["arguments"] === "string" ? { arguments: call["arguments"] } : {}),
      ...(typeof call["output"] === "string" ? { output: call["output"] } : {}),
      why: strings(call["why"]),
      surroundingChat: Object.freeze(records(call["surroundingChat"]).map((context) => Object.freeze({
        kind: "metroplat.agent.operations-tool-use-context",
        role: stringOf(context["role"], "unknown"),
        text: stringOf(context["text"], ""),
        event: stringOf(context["event"], "message"),
      }))),
      evidence: Object.freeze(strings(call["evidence"])),
    }));
  }).slice(0, 12);
  const evidence = strings(toolStudy["evidence"]);
  const sessions = numberOf(toolStudy["sessions"]);
  const toolCalls = numberOf(toolStudy["toolCalls"]);
  const missingOutputs = numberEvidence(evidence, "missing-outputs:");
  const harnessImprovements = strings(toolStudy["harnessImprovements"]);
  const harnessRouteGaps = harnessRoutes.filter((route) => route.state !== "available").length;
  return Object.freeze({
    kind: "metroplat.agent.operations-tool-study",
    state: toolCalls > 0 ? "ready" : "required",
    sessions,
    toolCalls,
    tools: Object.freeze(tools),
    toolArgumentSummaries: Object.freeze(toolArgumentSummaries),
    harnessRoutes: Object.freeze(harnessRoutes),
    recurringToolSequences: Object.freeze(recurringToolSequences),
    sampledToolUses: Object.freeze(sampledToolUses),
    missingOutputs,
    harnessImprovements,
    evidence: Object.freeze([
      `sessions:${sessions}`,
      `tool-calls:${toolCalls}`,
      `tools:${tools.length}`,
      `tool-argument-summaries:${toolArgumentSummaries.length}`,
      `harness-routes:${harnessRoutes.length}`,
      `harness-route-gaps:${harnessRouteGaps}`,
      `recurring-tool-sequences:${recurringToolSequences.length}`,
      `sampled-tool-uses:${sampledToolUses.length}`,
      `missing-outputs:${missingOutputs}`,
      `harness-improvements:${harnessImprovements.length}`,
      "source:codex-tool-study",
    ]),
  });
}

function learningLoop(skillProposals, toolStudy) {
  const proposals = records(skillProposals?.["proposals"]);
  const reviewable = proposals.filter((proposal) => proposal["state"] === "reviewable");
  const toolStudyCandidates = toolStudy?.harnessImprovements.slice(0, 12).map((candidate) => `codex-tool-study:${slug(candidate)}`) ?? [];
  const sequenceCandidates = toolStudy?.recurringToolSequences.slice(0, 12).map((sequence) => `codex-tool-sequence:${sequence.chain.map(slug).join("__")}`) ?? [];
  return Object.freeze({
    kind: "metroplat.agent.operations-learning-loop",
    state: reviewable.length > 0 || toolStudyCandidates.length > 0 || sequenceCandidates.length > 0 ? "required" : skillProposals === undefined ? "required" : "ready",
    proposals: proposals.length,
    reviewable: reviewable.length,
    candidates: Object.freeze([
      ...reviewable.slice(0, 12).map((proposal) => stringOf(proposal["id"], "skill-proposal")),
      ...sequenceCandidates,
      ...toolStudyCandidates,
    ].slice(0, 12)),
    gates: Object.freeze(["strict-input-schema", "strict-output-schema", "authorization-scopes", "effect-report", "verification", "human-approval", "supply-chain-review"]),
    evidence: Object.freeze([
      `proposals:${proposals.length}`,
      `reviewable:${reviewable.length}`,
      `tool-study-candidates:${toolStudyCandidates.length}`,
      `tool-sequence-candidates:${sequenceCandidates.length}`,
      "policy:proposal-only-human-approval-required",
    ]),
  });
}

function runtime(turn, toolStudy) {
  const contextLayers = records(turn?.["contextLayers"]);
  const invocations = records(turn?.["invocations"]);
  const observedTools = toolStudy?.tools.slice(0, 12).map((tool) => `${tool.name}:${tool.calls}`) ?? [];
  return Object.freeze({
    kind: "metroplat.agent.operations-runtime",
    state: invocations.length > 0 || (toolStudy?.toolCalls ?? 0) > 0 ? "ready" : "required",
    contextLayers: Object.freeze(contextLayers.map((layer) => `${stringOf(layer["name"], "layer")}:${stringOf(layer["state"], "unknown")}`)),
    invocations: invocations.length,
    sessionTargets: Object.freeze([...new Set(invocations.map((invocation) => stringOf(invocation["sessionTarget"], "isolated")))].sort((left, right) => left.localeCompare(right))),
    communicationChannels: Object.freeze([...new Set(invocations.map((invocation) => {
      const communication = record(invocation["communication"]);
      return stringOf(communication?.["channel"], "operator-session");
    }))].sort((left, right) => left.localeCompare(right))),
    observedToolCalls: toolStudy?.toolCalls ?? 0,
    observedTools: Object.freeze(observedTools),
    missingToolOutputs: toolStudy?.missingOutputs ?? 0,
    evidence: Object.freeze([
      `context-layers:${contextLayers.length}`,
      `invocations:${invocations.length}`,
      `observed-tool-calls:${toolStudy?.toolCalls ?? 0}`,
      `missing-tool-outputs:${toolStudy?.missingOutputs ?? 0}`,
      "execution-boundary:readout-only",
    ]),
  });
}

function budget(inferenceCost) {
  return Object.freeze({
    kind: "metroplat.agent.operations-budget",
    state: inferenceCost === undefined ? "required" : "ready",
    source: inferenceCost === undefined ? "missing" : "inference-cost",
    evidence: Object.freeze([
      inferenceCost === undefined ? "inference-cost:missing" : "inference-cost:present",
      "budget control requires validated cost rows",
    ]),
  });
}

function nextActions(
  gates,
  approvalsRead,
  learning,
  toolStudy,
) {
  const required = gates.filter((gate) => gate.state !== "ready").slice(0, 8).map((gate) => `satisfy-gate:${gate.name}`);
  const approvals = approvalsRead.slice(0, 8).map((approval) => `review-approval:${approval.id}`);
  return Object.freeze([
    ...required,
    ...approvals,
    ...(learning.reviewable > 0 ? ["review-learning-loop:skill-proposals"] : []),
    ...((toolStudy?.harnessImprovements.length ?? 0) > 0 ? ["review-codex-tool-study:harness-improvements"] : []),
    ...((toolStudy?.harnessRoutes.some((route) => route.state !== "available") ?? false) ? ["review-codex-tool-study:harness-routes"] : []),
    ...((toolStudy?.missingOutputs ?? 0) > 0 ? ["repair-codex-tool-study:missing-tool-outputs"] : []),
    "expand-prompt-into-work-unit-chain",
    "verify-effect-report-before-publication",
  ]);
}

export function agentOperationsDossier(input) {
  const orientation = record(input.orientation);
  const strategy = record(input.strategy);
  const heartbeat = record(input.heartbeat);
  const turn = record(input.turn);
  const dispatch = record(input.dispatch);
  const skillProposals = record(input.skillProposals);
  const inferenceCost = record(input.inferenceCost);
  const toolStudy = toolStudySummary(record(input.toolStudy));
  const lanes = workLanes(dispatch);
  const gates = controlGates({ orientation, strategy, turn, dispatch, inferenceCost });
  const approvalsRead = approvals(gates, skillProposals, dispatch);
  const learning = learningLoop(skillProposals, toolStudy);
  const runtimeRead = runtime(turn, toolStudy);
  const budgetRead = budget(inferenceCost);
  const failures = input.failures?.filter((entry) => entry.length > 0) ?? [];
  return Object.freeze({
    kind: "metroplat.agent.operations-dossier",
    date: input.date,
    actor: input.actor ?? stringOf(strategy?.["actor"], DEFAULT_ACTOR),
    goal: input.goal ?? stringOf(turn?.["goal"], stringOf(heartbeat?.["goal"], stringOf(strategy?.["goal"], DEFAULT_GOAL))),
    policy: "goal-ancestry-workflow-instrumentation",
    operatingModel: "work-unit-chains-with-human-control",
    workflowSpine: WORK_LEVELS,
    workLanes: lanes,
    templates: templates(dispatch, turn),
    controlGates: gates,
    approvals: approvalsRead,
    learningLoop: learning,
    runtime: runtimeRead,
    budget: budgetRead,
    ...(toolStudy === undefined ? {} : { toolStudy }),
    nextActions: nextActions(gates, approvalsRead, learning, toolStudy),
    ...(failures.length === 0 ? {} : { failures: Object.freeze(failures) }),
    evidence: Object.freeze([
      "prior-art:work-unit-lifecycle",
      "prior-art:coordination-patterns",
      "prior-art:meaningful-human-control",
      `workflow-spine:${WORK_LEVELS.join(">")}`,
      `lanes:${lanes.length}`,
      `templates:5`,
      `gates:${gates.length}`,
      `approvals:${approvalsRead.length}`,
      `runtime:${runtimeRead.state}`,
      `budget:${budgetRead.state}`,
      `tool-study:${toolStudy?.state ?? "missing"}`,
      `failures:${failures.length}`,
    ]),
  });
}
