import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decode } from "@red-cup-engineering/eavt";
import { admitFabricationReceipt, readBoundPackageOperations } from "../src/operations.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { admitArtifactFabricationRealizationReceipt, admitArtifactFabricationSpecification } from "@red-cup-engineering/computer-data-services-section/artifact-fabrication";
import { canonicalJson } from "@red-cup-engineering/json-services-section/canonical-json";
import { foldFabricationReceiptIntoWorldRows } from "../src/receipts.mjs";

const digest = "sha256:" + "a".repeat(64);

function creationDigest(creation) {
  return `sha256:${createHash("sha256").update(canonicalJson(creation), "utf8").digest("hex")}`;
}

function creationReceipt(overrides = {}) {
  return {
    type: "JsnodeOperationPackageCreationReceipt", version: 1,
    packageName: "@red-cup-engineering/greet-person-service", packageVersion: "0.1.0",
    destination: "/tmp/greet-person-service", filesDigest: digest,
    files: [{ type: "TextFileMaterialization", version: 1, path: "scripts/greet-person.mjs", mode: 0o755, digest }],
    assays: [
      { type: "JsnodeOperationPackageAssay", version: 1, name: "syntax", status: "passed" },
      { type: "JsnodeOperationPackageAssay", version: 1, name: "the-rule", status: "passed", scripts: 1, lines: 20 },
      { type: "JsnodeOperationPackageAssay", version: 1, name: "tests", status: "passed", paths: ["test/greet-person.test.mjs"] },
      { type: "JsnodeOperationPackageAssay", version: 1, name: "pack", status: "passed", filename: "greet-person.tgz", digest },
      { type: "JsnodeOperationPackageAssay", version: 1, name: "clean-installation", status: "passed", javascriptFiles: 1, reachableJavascriptFiles: 1 },
      { type: "JsnodeOperationPackageAssay", version: 1, name: "import-face", status: "passed", examples: 1 },
      { type: "JsnodeOperationPackageAssay", version: 1, name: "command-face", status: "passed", examples: 1 },
      { type: "JsnodeOperationPackageAssay", version: 1, name: "help", status: "passed" },
    ],
    ...overrides,
  };
}

function specification() {
  return admitArtifactFabricationSpecification({
    type: "ArtifactFabricationSpecificationCandidate", version: 1,
    source: { type: "ArtifactFabricationSource", version: 1, identity: { type: "ArtifactFabricationSourceIdentity", id: "greet-person-work-order" }, provenance: { type: "ArtifactFabricationSourceProvenance", locator: "content/text/documents/specifications/greet-person.md", digest, sourceSpan: { type: "ArtifactFabricationSourceSpan", startLine: 1, endLine: 1 } } },
    artifact: { type: "FabricatedArtifactIdentity", version: 1, id: "greet-person", kind: "jsnode-operation-package" },
    requirements: [{ type: "ArtifactFabricationRequirement", version: 1, id: "greeting-result", statement: "Return a greeting.", sourceSpan: { type: "ArtifactFabricationSourceSpan", startLine: 1, endLine: 1 } }],
    prohibitions: [], openQuestions: [],
    constraints: [
      { type: "ArtifactFabricationConstraint", version: 1, id: "composition", kind: "law", authority: "test", revision: "1", locator: "test", applicability: "test", statement: "Composition is valid.", sourceSpan: { type: "ArtifactFabricationSourceSpan", startLine: 1, endLine: 1 } },
      { type: "ArtifactFabricationConstraint", version: 1, id: "node-esm", kind: "standard", authority: "Node.js", revision: "24", locator: "test", applicability: "test", statement: "Use ESM.", sourceSpan: { type: "ArtifactFabricationSourceSpan", startLine: 1, endLine: 1 } },
    ],
    projections: [{ type: "ArtifactFabricationProjection", version: 1, id: "jsnode-operation-package", target: "test", configuration: {}, sourceSpan: { type: "ArtifactFabricationSourceSpan", startLine: 1, endLine: 1 } }],
    acceptanceObligations: [{ type: "ArtifactFabricationAcceptanceObligation", version: 1, id: "package-assays", kind: "test", statement: "Pass package assays.", sourceSpan: { type: "ArtifactFabricationSourceSpan", startLine: 1, endLine: 1 } }],
    traceability: [{ type: "ArtifactFabricationTrace", version: 1, requirementId: "greeting-result", constraintIds: ["composition", "node-esm"], projectionIds: ["jsnode-operation-package"], acceptanceObligationIds: ["package-assays"] }],
  });
}

function nested(creation = creationReceipt()) {
  const admittedSpecification = specification();
  const evidenceDigest = creationDigest(creation);
  const realization = admitArtifactFabricationRealizationReceipt(admittedSpecification, {
    type: "ArtifactFabricationRealizationReceiptCandidate", version: 1, artifactId: admittedSpecification.artifact.id, specificationDigest: admittedSpecification.specificationDigest,
    realizations: [{ type: "ArtifactFabricationRealizationEvidence", version: 1, projectionId: "jsnode-operation-package", evidence: { type: "ArtifactFabricationEvidence", locator: creation.destination, digest: evidenceDigest } }],
    acceptances: [{ type: "ArtifactFabricationRealizationEvidence", version: 1, acceptanceObligationId: "package-assays", evidence: { type: "ArtifactFabricationEvidence", locator: creation.destination, digest: evidenceDigest } }],
  });
  return { type: "MarkdownJsnodeOperationPackageFabricationReceipt", version: 1, sourceDigest: admittedSpecification.source.provenance.digest, specificationDigest: admittedSpecification.specificationDigest, artifactSpecification: admittedSpecification, jsnodeOperationPackageCreationReceipt: creation, artifactFabricationRealizationReceipt: realization };
}

test("folds canonical nested success with outer provenance and each passed assay", () => {
  const fold = foldFabricationReceiptIntoWorldRows({ receipt: nested(), t: 100 });
  assert.deepEqual(fold.rows[0].v, { name: "@red-cup-engineering/greet-person-service", version: "0.1.0", workOrder: "content/text/documents/specifications/greet-person.md" });
  assert.equal(fold.rows.filter((row) => row.a === "assay-passed").length, 8);
  assert.equal(fold.rows.filter((row) => row.a === "fabrication-trace").length, 1);
  assert.deepEqual(fold.traceability, nested().artifactFabricationRealizationReceipt.traceability);
  assert.deepEqual(fold.rows.map((row) => row.t), Array.from({ length: 15 }, (_, index) => 100 + index));
});

test("refuses a creation-only receipt before creating rows", () => {
  assert.throws(() => foldFabricationReceiptIntoWorldRows({ receipt: creationReceipt(), t: 1 }), (error) => error.code === "MISSING_REALIZATION_RECEIPT");
});

test("refuses a valid realization paired with another valid creation receipt", () => {
  const receipt = nested();
  receipt.jsnodeOperationPackageCreationReceipt = creationReceipt({ destination: "/tmp/other-greet-person-service" });
  assert.throws(() => foldFabricationReceiptIntoWorldRows({ receipt, t: 1 }), (error) => error.code === "CREATION_REALIZATION_BINDING_MISMATCH");
});

for (const [name, receipt, code] of [
  ["nested failed assay", nested({ ...creationReceipt(), assays: creationReceipt().assays.map((assay, index) => index === 0 ? { ...assay, status: "failed" } : assay) }), "FAILED_ASSAY"],
  ["nested unknown assay", nested({ ...creationReceipt(), assays: creationReceipt().assays.map((assay, index) => index === 0 ? { ...assay, status: "unknown" } : assay) }), "FAILED_ASSAY"],
  ["nested malformed assay", nested({ ...creationReceipt(), assays: [{ name: "syntax", status: "passed" }] }), "INCOMPLETE_ASSAYS"],
]) {
  test("refuses " + name + " before producing rows", () => {
    assert.throws(() => foldFabricationReceiptIntoWorldRows({ receipt, t: 1 }), (error) => error.code === code && error.receiptRefusal?.type === "JsnodeOperationPackageCreationReceiptRefusal");
  });
}

test("refuses a non-object receipt and a non-integer trace ordinal", () => {
  assert.throws(() => foldFabricationReceiptIntoWorldRows({ receipt: "x", t: 1 }), /receipt must be an object/u);
  assert.throws(() => foldFabricationReceiptIntoWorldRows({ receipt: nested(), t: 1.5 }), /t must be an integer/u);
});


test("receipt admission writes a callable EAVT package catalog and refuses duplicate or unbound receipts without changing it", async t => {
  const root = await mkdtemp(join(tmpdir(), "jsnode-receipt-admission-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const destination = join(root, "node_modules", "@red-cup-engineering", "greet-person-service");
  await mkdir(join(destination, "scripts"), { recursive: true });
  await writeFile(join(destination, "package.json"), JSON.stringify({ name: "@red-cup-engineering/greet-person-service", version: "0.1.0", type: "module", exports: "./scripts/greet-person.mjs" }));
  await writeFile(join(destination, "scripts/greet-person.mjs"), '/**\n * @param {string} name Name.\n * @returns {string} Greeting.\n */\nexport function greet(name) { return `Hello, ${name}`; }\n');
  const receiptPath = join(root, "receipt.json");
  await writeFile(receiptPath, JSON.stringify(nested(creationReceipt({ destination }))));
  const flatfilePath = join(root, "packages.eavt");
  const result = await admitFabricationReceipt({ flatfilePath, receiptPath });
  const catalog = await readFile(flatfilePath, "utf8");
  const rows = catalog.trimEnd().split("\n").map(decode);
  assert.equal(rows.length, result.rows);
  assert.equal(rows.find(row => row.a === "has-operation").v.exportName, "greet");
  const [bound] = await readBoundPackageOperations({ fernPath: flatfilePath, operationsRoot: root });
  assert.equal(bound.run("world"), "Hello, world");
  await assert.rejects(() => admitFabricationReceipt({ flatfilePath, receiptPath }), error => error.refusal?.reason === "ALREADY_ADMITTED");
  const otherReceipt = nested(creationReceipt({ destination, packageVersion: "0.2.0" }));
  delete otherReceipt.artifactFabricationRealizationReceipt;
  await writeFile(receiptPath, JSON.stringify(otherReceipt));
  await assert.rejects(() => admitFabricationReceipt({ flatfilePath, receiptPath }), error => error.code === "MISSING_REALIZATION_RECEIPT");
  assert.equal(await readFile(flatfilePath, "utf8"), catalog);
});
