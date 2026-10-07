import { operation } from "@red-cup-engineering/computer-system-engine/rpc/operation";
import { schemaFrom } from "@red-cup-engineering/json-schema-services-section/contracts";
import { foundServicesSection } from "@red-cup-engineering/services-section-form-services-section/found-services-section";

const foundingRequest = schemaFrom({
  $id: "services-section-form/found-services-section/request",
  type: "object",
  required: ["path", "name", "custody", "packageName", "packageDescription"],
  properties: {
    path: { type: "string", minLength: 1 },
    name: { type: "string", minLength: 1 },
    custody: { enum: ["science", "engineering", "operations", "561-group", "public"] },
    packageName: { type: "string", minLength: 1 },
    packageDescription: { type: "string", minLength: 1 },
    brand: { type: "string", minLength: 1 },
    keywords: { type: "array", items: { type: "string" } },
    parentReadmeSentence: { type: "string" },
    readme: { type: "string" }
  },
  additionalProperties: false
});

/**
 * MetroPlat/FeltOS operation family for the section-form founder.
 *
 * The repository root is host authority, never caller input. This turns the
 * already-tested founding function into an allocatable institutional
 * capability without creating a second founding implementation.
 */
export function servicesSectionFormOperations(binding) {
  return Object.freeze([
    operation({
      verb: "found-services-section",
      summary: "Found one services-section directory through the canonical ServicesSectionForm operator.",
      description: "Creates only the canonical README/package section nucleus under the 561 Group services tree, never overwrites existing nucleus files, and returns the folded ServicesSectionForm receipt. The host supplies the repository root; callers cannot redirect the write to another filesystem root.",
      domain: foundingRequest,
      writes: ["repository/services-section"],
      effects: {
        class: "external",
        replay: "coordinated",
        coordination: "coordination-required",
        deterministic: true,
        totality: "schema-bounded"
      },
      run: (input) => {
        if (typeof binding?.repositoryRoot !== "string" || binding.repositoryRoot.length === 0) {
          throw new TypeError("found-services-section requires the host repository root");
        }
        return foundServicesSection({ ...input, root: binding.repositoryRoot });
      }
    })
  ]);
}
