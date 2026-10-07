import assert from "node:assert/strict";
import test from "node:test";
import {
  admitArtifactFabricationRealizationPlan,
  admitArtifactFabricationRealizationReceipt,
  admitArtifactFabricationSpecification,
} from "../src/artifact-fabrication.mjs";

const digest = "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const span = (startLine, endLine = startLine) => ({ type: "ArtifactFabricationSourceSpan", startLine, endLine });

function candidate() {
  return {
    type: "ArtifactFabricationSpecificationCandidate",
    version: 1,
    source: {
      type: "ArtifactFabricationSource", version: 1,
      identity: { type: "ArtifactFabricationSourceIdentity", id: "greeting-markdown" },
      provenance: { type: "ArtifactFabricationSourceProvenance", locator: "specifications/greet-person.md", digest, sourceSpan: span(1, 18) },
    },
    artifact: { type: "FabricatedArtifactIdentity", version: 1, id: "greet-person", kind: "jsnode-operation-package" },
    requirements: [{ type: "ArtifactFabricationRequirement", version: 1, id: "returns-greeting", statement: "Returns a greeting for a named person.", sourceSpan: span(4) }],
    prohibitions: [{ type: "ArtifactFabricationProhibition", version: 1, id: "no-network", statement: "Does not use the network.", sourceSpan: span(5) }],
    openQuestions: [{ type: "ArtifactFabricationOpenQuestion", version: 1, id: "locale-policy", question: "Which locales should later greetings support?", blocking: false, sourceSpan: span(6) }],
    constraints: [
      { type: "ArtifactFabricationConstraint", version: 1, id: "determinism", kind: "law", authority: "Fabrication science", revision: "2026-08-28", locator: "fabrication-science/fabrication", applicability: "All projections", statement: "Equal input yields equal output.", sourceSpan: span(8) },
      { type: "ArtifactFabricationConstraint", version: 1, id: "node-esm", kind: "standard", authority: "Node.js", revision: "24.2.0", locator: "nodejs.org/api/esm.html", applicability: "JSNode projection", statement: "The package is an ES module.", sourceSpan: span(9) },
    ],
    projections: [{ type: "ArtifactFabricationProjection", version: 1, id: "jsnode-package", target: "jsnode-operation-package", configuration: { packageName: "@red-cup-engineering/greet-person-service" }, sourceSpan: span(11) }],
    acceptanceObligations: [{ type: "ArtifactFabricationAcceptanceObligation", version: 1, id: "behavior-test", kind: "test", statement: "Tests prove the stated greeting behavior.", sourceSpan: span(13) }],
    traceability: [
      { type: "ArtifactFabricationTrace", version: 1, requirementId: "returns-greeting", constraintIds: ["determinism", "node-esm"], projectionIds: ["jsnode-package"], acceptanceObligationIds: ["behavior-test"] },
      { type: "ArtifactFabricationTrace", version: 1, requirementId: "no-network", constraintIds: ["determinism"], projectionIds: ["jsnode-package"], acceptanceObligationIds: ["behavior-test"] },
    ],
  };
}

test("admits a complete two-handed contract deterministically and immutably", () => {
  const first = admitArtifactFabricationSpecification(candidate());
  const second = admitArtifactFabricationSpecification(candidate());
  assert.equal(first.type, "ArtifactFabricationSpecification");
  assert.equal(first.specificationDigest, second.specificationDigest);
  assert.deepEqual(first.traceability.map(({ requirementId }) => requirementId).sort(), ["no-network", "returns-greeting"]);
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.requirements));
  assert.ok(Object.isFrozen(first.requirements[0]));
});

test("refuses a blocking question, missing standard, and traceability gap", () => {
  const blocked = candidate();
  blocked.openQuestions[0].blocking = true;
  assert.equal(admitArtifactFabricationSpecification(blocked).code, "BLOCKING_OPEN_QUESTION");

  const lawOnly = candidate();
  lawOnly.constraints = lawOnly.constraints.slice(0, 1);
  assert.equal(admitArtifactFabricationSpecification(lawOnly).code, "MISSING_STANDARD");

  const untraced = candidate();
  untraced.traceability.pop();
  assert.equal(admitArtifactFabricationSpecification(untraced).code, "INCOMPLETE_TRACEABILITY");

  const unbased = candidate();
  unbased.traceability[0].constraintIds = ["not-a-constraint"];
  assert.equal(admitArtifactFabricationSpecification(unbased).code, "UNKNOWN_TRACE_REFERENCE");

  const unauditable = candidate();
  delete unauditable.constraints[0].revision;
  assert.equal(admitArtifactFabricationSpecification(unauditable).code, "UNEXPECTED_FIELDS");
});

test("admits an exhaustive evidence-free realization plan bound to the specification", () => {
  const specification = admitArtifactFabricationSpecification(candidate());
  const plan = admitArtifactFabricationRealizationPlan(specification, {
    type: "ArtifactFabricationRealizationPlanCandidate", version: 1,
    artifactId: "greet-person", specificationDigest: specification.specificationDigest,
    projectionIds: ["jsnode-package"], acceptanceObligationIds: ["behavior-test"],
  });
  assert.equal(plan.type, "ArtifactFabricationRealizationPlan");
  assert.deepEqual(plan.projectionIds, ["jsnode-package"]);
  assert.deepEqual(plan.acceptanceObligationIds, ["behavior-test"]);
  assert.ok(Object.isFrozen(plan));
  assert.ok(Object.isFrozen(plan.traceability));
});

test("refuses incomplete, unknown, and duplicate realization-plan coverage", () => {
  const specification = admitArtifactFabricationSpecification(candidate());
  const plan = () => ({
    type: "ArtifactFabricationRealizationPlanCandidate", version: 1,
    artifactId: "greet-person", specificationDigest: specification.specificationDigest,
    projectionIds: ["jsnode-package"], acceptanceObligationIds: ["behavior-test"],
  });
  const incomplete = plan(); incomplete.projectionIds = [];
  assert.equal(admitArtifactFabricationRealizationPlan(specification, incomplete).code, "INCOMPLETE_PLAN_COVERAGE");
  const unknown = plan(); unknown.projectionIds = ["unknown"];
  assert.equal(admitArtifactFabricationRealizationPlan(specification, unknown).code, "UNKNOWN_PLAN_REFERENCE");
  const duplicate = plan(); duplicate.acceptanceObligationIds = ["behavior-test", "behavior-test"];
  assert.equal(admitArtifactFabricationRealizationPlan(specification, duplicate).code, "DUPLICATE_PLAN_REFERENCE");
});

test("binds exhaustive realization and acceptance evidence to the admitted specification", () => {
  const specification = admitArtifactFabricationSpecification(candidate());
  const receipt = admitArtifactFabricationRealizationReceipt(specification, {
    type: "ArtifactFabricationRealizationReceiptCandidate", version: 1,
    artifactId: "greet-person", specificationDigest: specification.specificationDigest,
    realizations: [{ type: "ArtifactFabricationRealizationEvidence", version: 1, projectionId: "jsnode-package", evidence: { type: "ArtifactFabricationEvidence", locator: "receipts/greet-person.json", digest } }],
    acceptances: [{ type: "ArtifactFabricationRealizationEvidence", version: 1, acceptanceObligationId: "behavior-test", evidence: { type: "ArtifactFabricationEvidence", locator: "assays/greet-person.tap", digest } }],
  });
  assert.equal(receipt.type, "ArtifactFabricationRealizationReceipt");
  assert.equal(receipt.traceability.length, 2);
  assert.ok(Object.isFrozen(receipt.acceptances[0].evidence));
});

test("refuses realization evidence that is unknown or incomplete", () => {
  const specification = admitArtifactFabricationSpecification(candidate());
  const base = {
    type: "ArtifactFabricationRealizationReceiptCandidate", version: 1,
    artifactId: "greet-person", specificationDigest: specification.specificationDigest,
    realizations: [], acceptances: [],
  };
  assert.equal(admitArtifactFabricationRealizationReceipt(specification, base).code, "MISSING_RECEIPT_EVIDENCE");
  base.realizations = [{ type: "ArtifactFabricationRealizationEvidence", version: 1, projectionId: "not-a-projection", evidence: { type: "ArtifactFabricationEvidence", locator: "x", digest } }];
  assert.equal(admitArtifactFabricationRealizationReceipt(specification, base).code, "UNKNOWN_RECEIPT_REFERENCE");
});
