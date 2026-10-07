import assert from "node:assert/strict";
import test from "node:test";
import { refuseTemporalFailureMarks, scanTemporalFailureMarks } from "../scripts/scan-temporal-failure-marks.mjs";

test("projects every temporal failure mark as an addressable normalization demand", () => {
  const forbidden = ["set", "Timeout"].join("");
  const field = ["timeout", "Ms"].join("");
  const boundary = ["dead", "line"].join("");
  const credentialState = ["ex", "pired"].join("");
  const receipt = scanTemporalFailureMarks({ resources: [
    { path: "src/runner.mjs", content: `${forbidden}(run, 1); const ${field} = 1; throw new Error('${boundary} ${credentialState}');` },
    { path: "src/healthy.mjs", content: "export const state = 'running';" },
  ] });
  assert.equal(receipt.type, "TemporalFailureTerritoryScanReceipt");
  assert.equal(receipt.conforms, false);
  assert.deepEqual([...new Set(receipt.obligations.map(({ mark }) => mark.kind))], ["timer", "temporal-limit-field", "temporal-boundary", "temporal-credential-state"]);
  assert.throws(() => refuseTemporalFailureMarks({ resources: [{ path: "src/runner.mjs", content: `${["AbortSignal", ".", "time", "out"].join("")}(1)` }] }), /normalization remains demanded/u);
});

test("the same admitted territory has a stable clean receipt independent of resource order", () => {
  const left = scanTemporalFailureMarks({ resources: [{ path: "b.mjs", content: "export {}" }, { path: "a.mjs", content: "export {}" }] });
  const right = scanTemporalFailureMarks({ resources: [{ path: "a.mjs", content: "export {}" }, { path: "b.mjs", content: "export {}" }] });
  assert.equal(left.conforms, true);
  assert.equal(left.id, right.id);
  assert.equal(refuseTemporalFailureMarks({ resources: [{ path: "healthy.mjs", content: "export const status = 'running';" }] }).conforms, true);
});

test("marks a non-200 public service only under its exact expected-status contract", () => {
  const observation = { type: "RepositoryMaterialObservation", projection: { observations: [{ url: "https://gui.561.group", status: 503 }] } };
  const contracted = JSON.stringify({ expectation: { requirement: "urn:sha256:f626f8a2bf391ff58304d5c277882f5ad1b3b889f6fa82352c38ba2078bd27ed", url: "https://gui.561.group", acceptedStatuses: [200] }, observation });
  const uncontracted = JSON.stringify({ observation });
  const failed = scanTemporalFailureMarks({ resources: [{ path: "gui-observation.json", content: contracted }] });
  assert.equal(failed.conforms, false);
  assert.equal(failed.obligations[0].mark.kind, "expected-public-service-status");
  assert.equal(scanTemporalFailureMarks({ resources: [{ path: "gui-observation.json", content: uncontracted }] }).conforms, true);
});

test("an admitted heartbeat turns each non-closed circulation axis into a repair obligation", () => {
  const axes = Object.fromEntries(["authority", "carrier", "demandWorkIdentity", "resourceGrant", "executionResult", "chainSettlement", "nextObservation"].map((axis) => [axis, { state: axis === "demandWorkIdentity" ? "closed" : "open", evidence: `urn:test:${axis}` }]));
  const receipt = scanTemporalFailureMarks({ resources: [{ path: "heartbeat.json", content: JSON.stringify({ type: "SemioticWebHeartbeatClosureObservation", version: 1, axes }) }] });
  assert.equal(receipt.conforms, false);
  assert.equal(receipt.obligations.filter(({ mark }) => mark.kind === "heartbeat-closure-axis").length, 6);
  assert.match(receipt.obligations[0].mark.mark, /heartbeat axis authority is open/u);
});
