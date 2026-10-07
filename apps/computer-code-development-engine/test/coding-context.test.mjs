import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { buildCodingContextPacket } from "../src/coding-context/coding-context.mjs";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "union-context-packet-test-"));
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(join(root, "AGENTS.md"), "Keep source and regression evidence together.\n");
  writeFileSync(join(root, "package.json"), '{"type":"module","scripts":{"test":"node --test"}}\n');
  writeFileSync(join(root, "src/helper.mjs"), "export const value = 1;\n");
  writeFileSync(join(root, "src/main.mjs"), 'import { value } from "./helper.mjs";\nexport const answer = value;\n');
  return root;
}

test("coding packet preloads exact focus, local law, manifest, and relative interfaces", () => {
  const territory = fixture();
  const manifest = {
    id: "urn:test:context:complete",
    taskClass: "bounded-repair",
    objective: "Change main and create its coupled regression test.",
    territory,
    focusPaths: ["src/main.mjs", "test/main.test.mjs"],
    writablePaths: ["src/main.mjs", "test/main.test.mjs"],
    readablePaths: [], constraints: ["do not alter helper"], commands: {},
    testVectors: [{ id: "addition-regression", given: ["main imports helper value 1"], when: "the coupled regression test imports main", then: ["the exported answer is 1"], forbidden: ["editing helper"] }],
    verifyCommand: "node --test",
    acceptanceCommand: "node --test test/main.test.mjs",
  };
  const packet = buildCodingContextPacket({
    manifest,
    snapshot: { files: ["AGENTS.md", "package.json", "src/helper.mjs", "src/main.mjs"], truncated: false },
    baselineVerification: { passed: true, output: "many passing tests" },
    baselineAcceptance: { passed: false, output: "Could not find test/main.test.mjs" },
    memories: [],
    actionSchema: { type: "object" },
  });

  const byPath = new Map(packet.evidenceArtifacts.map((artifact) => [artifact.path, artifact]));
  assert.equal(byPath.get("src/main.mjs").text, 'import { value } from "./helper.mjs";\nexport const answer = value;\n');
  assert.equal(byPath.get("src/main.mjs").truncated, false);
  assert.match(byPath.get("AGENTS.md").text, /source and regression/);
  assert.match(byPath.get("package.json").text, /node --test/);
  assert.match(byPath.get("src/helper.mjs").text, /value = 1/);
  assert.deepEqual(packet.targetArtifacts, [{ path: "test/main.test.mjs", status: "must-create" }]);
  assert.deepEqual(packet.packetQuality, {
    selfContainment: true,
    machineCheckableGoalConditions: true,
    executableAcceptanceExamples: true,
    laneBoundaries: true,
    resolvableCitations: true,
    outputContract: true,
  });
  assert.equal(packet.machineChecks.baselineVerification.output, "exit=0");
  assert.match(packet.machineChecks.baselineAcceptance.output, /Could not find/);
  assert.equal(packet.acceptanceTestVectors[0].id, "addition-regression");
  assert.equal(packet.acceptanceAuthority.protected, false);
});

test("coding packet refuses a focus path outside the admitted territory", () => {
  const territory = fixture();
  assert.throws(() => buildCodingContextPacket({
    manifest: { id: "urn:test:context:escape", objective: "escape", territory, focusPaths: ["../secret"], writablePaths: [], readablePaths: [], constraints: [], testVectors: [], verifyCommand: "true", acceptanceCommand: "true" },
    snapshot: { files: [], truncated: false }, baselineVerification: { passed: true }, baselineAcceptance: { passed: true }, actionSchema: { type: "object" },
  }), /escapes admitted territory/);
});

test("coding packet excludes raw unresolved trajectory bytes but projects typed residue knowledge", () => {
  const territory = fixture();
  const manifest = {
    id: "urn:test:context:memory",
    objective: "Repair main from verified local precedent.", territory,
    focusPaths: ["src/main.mjs"], writablePaths: ["src/main.mjs"], readablePaths: [], constraints: [],
    testVectors: [{ id: "answer-check", given: ["main is imported"], when: "answer is read", then: ["answer is one"], forbidden: [] }],
    verifyCommand: "node --test", acceptanceCommand: "node --test",
  };
  const unresolved = { id: "urn:unresolved", objective: "stale thrash", outcome: { verified: false, summary: "x".repeat(20000) } };
  const residue = { type: "SoftwareTrajectoryResidueKnowledge", dominantRefusal: "candidate-refused-by-schema-assay", occurrences: 2, providers: ["urn:ame:small"], schemaAssays: ["ni:///sha-256;assay"], problems: ["$/args:required:must have required property 'blocks'"], reasons: [], witnesses: ["urn:failed:1", "urn:failed:2"], strategy: "induce-deterministic-validator-or-translator", modelEscalationAllowed: false, capabilityFormationRequired: true, nextAct: "advertise-capability-formation-demand" };
  const verified = { id: "urn:verified", taskClass: "repair", objective: "known repair", finishedAt: "2026-07-19T00:00:00.000Z", outcome: { verified: true, classification: "repair", changedPaths: ["src/main.mjs"], summary: "passed", trajectoryFingerprint: "sha256:known", selectedActions: [{ action: "edit", args: { path: "src/main.mjs", blocks: [{ search: "large", replace: "payload" }] }, reason: "apply the known source repair" }] } };
  const packet = buildCodingContextPacket({
    manifest,
    snapshot: { files: ["AGENTS.md", "package.json", "src/helper.mjs", "src/main.mjs"], truncated: false },
    baselineVerification: { passed: true }, baselineAcceptance: { passed: true }, memories: [unresolved, residue, verified], actionSchema: { type: "object" },
  });

  assert.equal(packet.priorVerifiedKnowledge.length, 1);
  assert.equal(packet.priorVerifiedKnowledge[0].id, "urn:verified");
  assert.deepEqual(packet.priorVerifiedKnowledge[0].selectedMoves[0], { action: "edit", path: "src/main.mjs", reason: "apply the known source repair" });
  assert.doesNotMatch(JSON.stringify(packet.priorVerifiedKnowledge), /stale thrash|payload/);
  assert.equal(packet.priorResidueKnowledge[0].capabilityFormationRequired, true);
  assert.equal(packet.priorResidueKnowledge[0].modelEscalationAllowed, false);
  assert.equal(packet.priorResidueKnowledge[0].schemaAssays[0], "ni:///sha-256;assay");
  assert.match(packet.priorResidueKnowledge[0].problems[0], /required property 'blocks'/u);
  assert.ok(packet.resourceAccount.priorKnowledgeBytesSupplied < 3000);
});

test("whole-artifact mission context refuses an insufficient source budget", () => {
 const territory=fixture();
 assert.throws(()=>buildCodingContextPacket({manifest:{id:"budget",territory,focusPaths:["src/main.mjs"],contextBudgetBytes:1,writablePaths:[],readablePaths:[],testVectors:[],verifyCommand:"true",acceptanceCommand:"true"},snapshot:{files:[]}}),/complete focus artifact/);
});
