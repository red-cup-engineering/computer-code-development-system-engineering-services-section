import assert from "node:assert/strict";
import test from "node:test";

import { vsCodeAgentHookResponseText } from "@red-cup-engineering/computer-code-development-engine/vscode/service";
import { vsCodeAgentWorkSurface } from "@red-cup-engineering/computer-code-development-engine/vscode/work-surface";
import { readModuleTopology } from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/topology/service";

test("VS Code package assembly keeps pure work surface below its hook service", () => {
  const surface = vsCodeAgentWorkSurface({ subject: "test work surface" });
  assert.equal(surface.kind, "metroplat.vscode.agent-work-surface");
  assert.ok(surface.context.text.includes("test work surface"));
  assert.ok(surface.readouts.some((readout) => readout.format === "notebook"));

  const response = vsCodeAgentHookResponseText({
    hook_event_name: "SessionStart",
    session_id: "vscode-test-session",
    harness: "codex",
  });
  const parsed = JSON.parse(response);
  assert.equal(parsed.hookSpecificOutput.hookEventName, "SessionStart");
  assert.ok(parsed.hookSpecificOutput.additionalContext.includes("vscode-test-session"));

  const topology = readModuleTopology(process.cwd(), {
    sourceDirs: ["src/integrations/vscode"],
    maxFiles: 20,
  });
  const importsOf = (modulePath) => topology.modules.find((moduleEntry) => moduleEntry.path === modulePath)?.imports ?? [];
  assert.ok(importsOf("src/integrations/vscode/service.mts")
    .includes("src/integrations/vscode/work-surface.mts"));
  assert.equal(importsOf("src/integrations/vscode/work-surface.mts")
    .includes("src/integrations/vscode/service.mts"), false);
});
