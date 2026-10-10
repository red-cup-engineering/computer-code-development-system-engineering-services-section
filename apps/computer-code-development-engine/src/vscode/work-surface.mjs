/**
 * integrations/vscode — the VS Code agent work surface.
 *
 * This module does not create a VS Code extension host or a parallel cockpit
 * service. It composes the MetroPlat surfaces that already carry the old
 * cockpit's job: action/MCP/LSP readiness, Codex status cuts, hook context,
 * work-locus governance, and operator readouts.
 *
 * @packageDocumentation
 */

import {
  encodeIpynb,
  jupyterCodeCell,
  jupyterNotebook,

} from "@red-cup-engineering/computer-content-engineering-services-section/jupyter/codec";
import {
  vsCodeAgentCommandRouteContract,
  vsCodeAgentContextCapsuleContract,
  vsCodeAgentReadinessCheckContract,
  vsCodeAgentReadoutContract,
  vsCodeAgentWorkSurfaceContract,

} from "@red-cup-engineering/computer-code-development-engine/vscode/schema";

export const priorVSCodeCockpitBaseline = Object.freeze([
  "readiness-checks",
  "context-injection",
  "command-action-routes",
  "work-locus-conflict-handling",
  "statusline-handoff",
  "notebook-readouts",
]);

export const defaultVSCodeAgentCommandRoutes = Object.freeze([
  route("read-agent-readiness", "metroplat://%40emsenn%2Fmetroplat/agent-readiness", "resource", "Read the induced MCP/LSP/agent-work readiness report.", true, false, ["src/presentation/induce:agentReadinessReportOf"]),
  route("read-codex-session-status", "state:data/state/YYYY/MM/DD/*-cut-codex-session-<session>.json", "state-cut", "Read a Codex transcript as a continuation/status cut.", true, false, ["src/integrations/openai/codex/service:readCodexSessionStatusReadout"]),
  route("admit-codex-work-claims", "@red-cup-engineering/metroplat/integrations/openai/codex:admitCodexSessionWorkClaims", "service", "Admit Codex goals, obligations, and host acts into the claim-session feed.", false, true, ["src/integrations/openai/codex/service:admitCodexSessionWorkClaims"]),
  route("admit-hook-event", "@red-cup-engineering/agent-harness-computer-system-engineering-services-section/hooks/service:appendHookEventAtRoot", "service", "Admit a Codex or adjacent harness hook event into the statement log.", false, true, ["src/integrations/hooks/service:appendHookEventAtRoot"]),
  route("read-work-locus-governance", "@red-cup-engineering/computer-code-development-engine/agent/work-locus:workLocusGovernanceReading", "projection", "Read active work-locus claims, overlaps, and governance evidence.", true, false, ["src/lib/capability/index:workLocusGovernanceReading", "@red-cup-engineering/socializing/jural:readJuralRelations"]),
  route("read-mcp-program-surface", "@red-cup-engineering/metroplat/integrations/mcp", "service", "Expose generated tools, resources, prompts, and readiness through the MCP stdio service.", true, false, ["src/integrations/mcp:index", "src/presentation/induce"]),
  route("prepare-agent-handoff", "@red-cup-engineering/metroplat:agentStatusReadout", "projection", "Project continuation/readiness material into the next-session handoff and statusline cut.", true, false, ["src/coordination/claim-sessions/session:agentStatusReadout"]),
  route("read-agent-readouts", "@red-cup-engineering/computer-code-development-engine/vscode/work-surface:vsCodeAgentReadouts", "projection", "Read status, readiness, work-locus, and command-route material for a VS Code work surface.", true, false, ["src/integrations/vscode:vsCodeAgentReadouts"]),
]);

function route(
  name,
  routeName,
  source,
  summary,
  readOnly,
  writesWorkspace,
  evidence,
) {
  return vsCodeAgentCommandRouteContract.assert(Object.freeze({
    name,
    route: routeName,
    source,
    packageName: "@red-cup-engineering/metroplat",
    summary,
    readOnly,
    writesWorkspace,
    evidence: Object.freeze([...evidence]),
  }), "VS Code agent command route");
}

function uniqueCommands(commands) {
  const byName = new Map();
  for (const command of commands) byName.set(command.name, command);
  return Object.freeze([...byName.values()].sort((left, right) => left.name.localeCompare(right.name)));
}

function readout(id, title, format, content, evidence) {
  return vsCodeAgentReadoutContract.assert(Object.freeze({
    id,
    title,
    format,
    content,
    evidence: Object.freeze([...evidence]),
  }), "VS Code agent readout");
}

function asJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function markdownCell(id, source) {
  return Object.freeze({
    cell_type: "markdown",
    id,
    metadata: Object.freeze({}),
    source,
  });
}

function jsonCodeCell(id, value) {
  return jupyterCodeCell(asJson(value), {
    id,
    metadata: Object.freeze({ language: "json" }),
  });
}

export function vsCodeAgentNotebook(input) {
  const commands = uniqueCommands([...(input.commands ?? []), ...defaultVSCodeAgentCommandRoutes]);
  const cells = [
    markdownCell(
      "vscode-agent-work-surface",
      [
        "# VS Code Agent Work Surface",
        "",
        "This notebook is projected from the same MetroPlat material as the VS Code hook context: command routes, readiness, status cuts, and work-locus governance.",
      ].join("\n"),
    ),
    jsonCodeCell("command-routes", commands),
  ];
  if (input.status !== undefined) {
    cells.push(markdownCell("agent-status", input.status.text));
  }
  if (input.readiness !== undefined) {
    cells.push(jsonCodeCell("agent-readiness", input.readiness));
  }
  if (input.workLocus !== undefined) {
    cells.push(jsonCodeCell("work-locus-governance", input.workLocus));
  }
  return jupyterNotebook(cells, {
    metadata: Object.freeze({
      title: "MetroPlat VS Code agent work surface",
      kernelspec: Object.freeze({ name: "metroplat-json", display_name: "MetroPlat JSON" }),
      language_info: Object.freeze({ name: "json" }),
    }),
  });
}

export function vsCodeAgentNotebookText(input) {
  return encodeIpynb(vsCodeAgentNotebook(input));
}

export function vsCodeAgentReadouts(input) {
  const commands = uniqueCommands([...(input.commands ?? []), ...defaultVSCodeAgentCommandRoutes]);
  const out = [
    readout("command-routes", "VS Code Agent Command Routes", "json", asJson(commands), ["src/integrations/vscode:defaultVSCodeAgentCommandRoutes"]),
    readout("agent-work-surface-notebook", "VS Code Agent Work Surface Notebook", "notebook", vsCodeAgentNotebookText({ ...input, commands }), ["src/integrations/vscode:vsCodeAgentNotebook", "src/integrations/jupyter/codec:encodeIpynb"]),
  ];
  if (input.status !== undefined) {
    out.push(readout("agent-status-cut", "Agent Status Cut", "text", input.status.text, ["src/coordination/claim-sessions/session:agentStatusReadout"]));
  }
  if (input.readiness !== undefined) {
    out.push(readout("agent-readiness", "Agent Readiness", "json", asJson(input.readiness), ["src/presentation/induce:agentReadinessReportOf"]));
  }
  if (input.workLocus !== undefined) {
    out.push(readout("work-locus-governance", "Work-Locus Governance", "json", asJson(input.workLocus), ["src/lib/capability/index:workLocusGovernanceReading", "@red-cup-engineering/socializing/jural:readJuralRelations"]));
  }
  return Object.freeze(out);
}

function contextText(input, commands) {
  const subject = input.subject ?? "VS Code agent work surface";
  const lines = [
    "# MetroPlat VS Code agent work surface",
    "",
    `Subject: ${subject}`,
    ...(input.sessionId === undefined ? [] : [`Session: ${input.sessionId}`]),
    ...(input.hookEventName === undefined ? [] : [`Hook event: ${input.hookEventName}`]),
    ...(input.status === undefined ? [] : [`Status: ${input.status.statusline}`]),
    ...(input.readiness === undefined ? [] : [`Readiness: ${input.readiness.ready ? "ready" : "not ready"}`]),
    ...(input.workLocus === undefined ? [] : [`Work-locus conflicts: ${input.workLocus.conflicts.length}`]),
    `Command routes: ${commands.length}`,
    "",
    "First moves:",
    "- Operator words outrank repository doctrine; when corrected, make the corrected move next.",
    "- JS/Node placement follows ordinary industry convention, not theory-derived directory names.",
    "- Hooks are admission/readout infrastructure: keep successful admission quiet and context output bounded.",
    "- Read agent readiness before claiming the surface is usable.",
    "- Read or record the current Codex session status cut before handoff.",
    "- Read work-locus governance before mutating files.",
    "- Route tool and model calls through existing MetroPlat actions, services, and journal admission.",
  ];
  return `${lines.join("\n")}\n`;
}

export function vsCodeAgentContextCapsule(
  input,
) {
  const subject = input.subject ?? "VS Code agent work surface";
  const commands = uniqueCommands([...(input.commands ?? []), ...defaultVSCodeAgentCommandRoutes]);
  return vsCodeAgentContextCapsuleContract.assert(Object.freeze({
    kind: "metroplat.vscode.agent-context-capsule",
    subject,
    ...(input.sessionId === undefined ? {} : { sessionId: input.sessionId }),
    ...(input.hookEventName === undefined ? {} : { hookEventName: input.hookEventName }),
    text: contextText(input, commands),
    evidence: Object.freeze([
      "src/integrations/vscode:vsCodeAgentContextCapsule",
      "src/integrations/hooks/service:appendHookEventAtRoot",
      "src/coordination/claim-sessions/session:agentStatusReadout",
    ]),
  }), "VS Code agent context capsule");
}

function check(id, label, passed, evidence, missing) {
  return vsCodeAgentReadinessCheckContract.assert(Object.freeze({
    id,
    label,
    required: true,
    passed,
    evidence: Object.freeze([...evidence]),
    missing: Object.freeze([...missing]),
  }), "VS Code agent readiness check");
}

function readinessChecks(input, commands, context, readouts) {
  const readiness = input.readiness;
  const status = input.status;
  const workLocus = input.workLocus;
  const commandNames = new Set(commands.map((command) => command.name));
  const requiredRoutes = ["read-agent-readiness", "read-codex-session-status", "read-work-locus-governance", "prepare-agent-handoff"];
  return Object.freeze([
    check(
      "readiness-checks",
      "MCP/LSP/agent-work readiness is carried from the induced operation surface",
      readiness?.mcp.ready === true && readiness.lsp.ready === true && readiness.agentWork.ready === true,
      readiness === undefined ? [] : readiness.surfaces.flatMap((surface) => surface.evidence),
      readiness === undefined ? ["agent-readiness"] : readiness.missing,
    ),
    check(
      "context-injection",
      "A hook-injectable context capsule is available",
      context.text.trim().length > 0,
      context.evidence,
      context.text.trim().length > 0 ? [] : ["context.text"],
    ),
    check(
      "command-action-routes",
      "Command routes cover readiness, Codex status, work-locus governance, and handoff",
      requiredRoutes.every((name) => commandNames.has(name)),
      commands.flatMap((command) => command.evidence),
      requiredRoutes.filter((name) => !commandNames.has(name)),
    ),
    check(
      "work-locus-conflict-handling",
      "Work-locus governance preserves active claims and overlaps instead of dropping contests",
      workLocus !== undefined,
      workLocus === undefined ? [] : ["src/lib/capability/index:workLocusGovernanceReading", "@red-cup-engineering/socializing/jural:readJuralRelations", `conflicts:${workLocus.conflicts.length}`],
      workLocus === undefined ? ["work-locus-governance-reading"] : [],
    ),
    check(
      "statusline-handoff",
      "A statusline and handoff/status text are available from agent status settlement",
      status !== undefined && status.statusline.trim().length > 0 && status.text.trim().length > 0,
      status === undefined ? [] : status.evidence,
      status === undefined ? ["agent-status-settlement"] : [],
    ),
    check(
      "notebook-readouts",
      "VS Code-facing readouts are available for status, readiness, work-locus, and command routes",
      readouts.some((entry) => entry.format === "notebook" && entry.content.trim().length > 0),
      readouts.flatMap((entry) => entry.evidence),
      readouts.some((entry) => entry.format === "notebook" && entry.content.trim().length > 0) ? [] : ["agent-work-surface-notebook"],
    ),
  ]);
}

function toJsonValue(value) {
  return JSON.parse(JSON.stringify(value));
}

export function vsCodeAgentWorkSurface(input = {}) {
  const subject = input.subject ?? "VS Code agent work surface";
  const commands = uniqueCommands([...(input.commands ?? []), ...defaultVSCodeAgentCommandRoutes]);
  const context = input.context ?? vsCodeAgentContextCapsule({ ...input, commands });
  const readouts = Object.freeze([...(input.readouts ?? []), ...vsCodeAgentReadouts({ ...input, commands })]);
  const checks = readinessChecks(input, commands, context, readouts);
  const missingBaseline = Object.freeze(checks.filter((entry) => !entry.passed).map((entry) => entry.id));
  const face = {
    kind: "metroplat.vscode.agent-work-surface",
    subject,
    ...(input.sessionId === undefined ? {} : { sessionId: input.sessionId }),
    commands,
    readinessChecks: checks,
    context,
    readouts,
    ...(input.readiness === undefined ? {} : { readiness: toJsonValue(input.readiness) }),
    ...(input.status === undefined ? {} : { status: toJsonValue(input.status) }),
    ...(input.workLocus === undefined ? {} : { workLocus: toJsonValue(input.workLocus) }),
    priorBaseline: priorVSCodeCockpitBaseline,
    meetsPriorBaseline: missingBaseline.length === 0,
    missingBaseline,
    evidence: Object.freeze([
      "src/integrations/vscode:vsCodeAgentWorkSurface",
      "src/presentation/induce:agentReadinessReportOf",
      "src/integrations/openai/codex/service:readCodexSessionStatusReadout",
      "src/integrations/hooks/service:appendHookEventAtRoot",
      "src/lib/capability/index:workLocusGovernanceReading",
      "@red-cup-engineering/socializing/jural:readJuralRelations",
      ...(input.evidence ?? []),
    ]),
  };
  return vsCodeAgentWorkSurfaceContract.assert(face, "VS Code agent work surface");
}
