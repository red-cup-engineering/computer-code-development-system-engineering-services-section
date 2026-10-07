import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { findServicesSectionRepositoryRoot, readServicesSectionLaw } from "@red-cup-engineering/services-section-form-services-section/read-services-section-law";
import { servicesSectionFormOperations } from "../../src/services-section-form/operations.mjs";

const law = await readServicesSectionLaw(await findServicesSectionRepositoryRoot(dirname(fileURLToPath(import.meta.url))));

async function installSectionLaw(root) {
  const directory = resolve(root, "lib/emsenn/services/561-group/services/561-group-services-section/data/records/schema");
  await mkdir(directory, { recursive: true });
  await Promise.all([
    writeFile(resolve(directory, "services-section-form.schema.json"), JSON.stringify(law.schema)),
    writeFile(resolve(directory, "services-section-form-content-taxonomy.json"), JSON.stringify(law.contentTaxonomy)),
  ]);
}


test("the operation family exposes the canonical founder and binds writes to the host repository root", async () => {
  const root = await mkdtemp(join(tmpdir(), "found-services-section-operation-"));
  await installSectionLaw(root);
  try {
    await mkdir(join(root, "lib/emsenn/services/561-group/services"), { recursive: true });
    const [found] = servicesSectionFormOperations({ repositoryRoot: root });
    assert.equal(found.verb, "found-services-section");
    const request = {
      path: "lib/emsenn/services/561-group/services/operation-founded-services-section",
      name: "Operation Founded Services Section",
      custody: "engineering",
      packageName: "@red-cup-engineering/operation-founded-services-section",
      packageDescription: "A section founded through the installed operation family."
    };
    const executed = await found.execute(request, {}, { invocation: { subject: "test:program-manager" } });
    const result = executed?.value !== undefined && executed?.ok !== undefined ? executed.value : executed;
    assert.equal(result.path, request.path);
    assert.deepEqual([...result.created].sort(), ["README.md", "package.json"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
