/** Specification-bound fabrication operations, independent of their protocol face. */
import { renderJsonSchemaModule } from "@red-cup-engineering/javascript-node-code-fabrication-services-section/transform-json-schema-to-typescript";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { operation } from "@red-cup-engineering/computer-system-engine/rpc/operation";
import { schemaFrom } from "@red-cup-engineering/json-schema-services-section/contracts";
import { remoteInferenceMarket, remoteInferenceMarketFromEnv } from "@red-cup-engineering/computer-inference-engine/dispatch/remote-inference-market";
import { fabricateMarkdownJsnodeOperationPackage } from "@red-cup-engineering/jsnode-package-services-section/fabricate-markdown-jsnode-operation-package";
import { translateMarkdownJsnodeOperationPackageSpecification } from "@red-cup-engineering/jsnode-package-services-section/translate-markdown-jsnode-operation-package-specification";
import { listFabricationRecords } from "@red-cup-engineering/jsnode-package-services-section/fabrication-records";

import { deriveJsnodeModules } from "@red-cup-engineering/jsnode-package-services-section/derive-jsnode-package-from-closure";

const DEFAULT_REGISTRY = "https://registry.561.group";
const documentInput = {
  path: { type: "string", minLength: 1 },
  source: {
    type: "object", required: ["type", "path", "text"], additionalProperties: false,
    properties: {
      type: { const: "MarkdownDocumentSource" },
      path: { type: "string", minLength: 1 },
      text: { type: "string" },
    },
  },
};
const documentChoice = [{ required: ["path"] }, { required: ["source"] }];

// Inline text is the existing sourced-document carrier. Its locator is evidence
// metadata; only an explicit local path asks this host to read a file.
function workOrderSource(root, args) {
  if (args.source !== undefined) return args.source;
  const absolute = resolve(root, args.path);
  return { type: "MarkdownDocumentSource", path: absolute, text: readFileSync(absolute, "utf8") };
}

function fabricationDeclarations(registry) {
  return [
    {
      name: "translate_work_order",
      title: "Translate a Markdown work order",
      description: "Translates a sourced Markdown order into its canonical artifact-fabrication candidate without admission, inference or mutation. A Modules section carries source-free operations, examples and exact dependencies; explicit Acceptance obligations and their traceability remain in the order. This produces jsnode-modules for an existing consumer without package birth. Package dialects retain their package obligations. Refusals retain the source translation phase.",
      inputSchema: { type: "object", oneOf: documentChoice, properties: documentInput, additionalProperties: false },
      annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false, readOnlyHint: true },
    },
    {
      name: "derive_jsnode_modules",
      title: "Derive source modules without package birth",
      description: "Consumes one canonical ArtifactFabricationSpecificationCandidate for jsnode-modules, admits its meaning closure and plan before inference, and returns module proposals, schemas, prior clause assays and supplier provenance. The order carries operations, examples and exact dependencies, without Markdown, authored source, package identity, command catalog or package-birth requirements. The supplied inference service selects execution methods separately for assay and source requests under its purchase policy. Exact dependencies must already be installed in the host-bound consumer project; unavailable versions refuse before inference. Behavioral assays reuse that context without destination, npm install, publication or receiving. A proposal is not acceptance; inference and temporary pre-assay execution may consume resources.",
      inputSchema: { type: "object", required: ["workOrder"], properties: { workOrder: { type: "object" } }, additionalProperties: false },
      annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: true, readOnlyHint: false },
    },
    {
      name: "fabricate_jsnode_operation_package",
      title: "Fabricate an operation package from a work order",
      description: "Runs the whole circuit: translate, admit the artifact specification, admit the JSNode specification, birth the package at an absent destination, run its assays, publish through the full release gate only when publish is true, and return the fabrication receipt or a phase-named refusal. The supplied inference service selects assay and source execution methods under its purchase policy. Three effects: the package directory, the registry publication, and its publish receipt. Refuses (DESTINATION_FRAGMENTS_EXISTING_PACKAGE_FAMILY) a destination whose parent directory already holds sibling single-function packages and carries no package.json of its own — consolidate into one <topic>-services-section package instead of birthing another sibling there.",
      inputSchema: { type: "object", required: ["destination"], oneOf: documentChoice, properties: { ...documentInput, destination: { type: "string", minLength: 1 }, registry: { type: "string", format: "uri", default: registry }, publish: { type: "boolean", default: false } }, additionalProperties: false },
      annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: true, readOnlyHint: false },
    },
    {
      name: "list_fabrication_records",
      title: "List translatable JSNode work orders and fabrication receipts",
      description: "Walks specification directories and returns only Markdown documents accepted by the JSNode operation-package translator, with artifact ID and specification digest, plus admitted fabrication receipts with the generated package identity.",
      inputSchema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 1000, default: 200 } }, additionalProperties: false },
      annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false, readOnlyHint: true },
    },
    {
      name: "project_json_schema_module",
      title: "Project a schema module deterministically",
      description: "Projects supplied JSON Schema entries into JavaScript runtime source, TypeScript source or declarations using the existing code-layer renderer. This is a pure source proposal, not arbitrary operation derivation, source application or independent receiving. TypeScript omits constraints it cannot express; runtime schemas retain those constraints.",
      inputSchema: {
        type: "object", required: ["entries"], additionalProperties: false,
        properties: {
          entries: { type: "array", minItems: 1, items: {
            type: "object", required: ["schema", "exportName", "typeName"], additionalProperties: false,
            properties: {
              schema: { type: "object" },
              exportName: { type: "string", pattern: "^[A-Za-z_$][A-Za-z0-9_$]*$" },
              typeName: { type: "string", pattern: "^[A-Za-z_$][A-Za-z0-9_$]*$" },
              runtimeName: { type: "string", pattern: "^[A-Za-z_$][A-Za-z0-9_$]*$" },
              aliases: { type: "array", items: { type: "string" } }, internal: { type: "boolean" },
            },
          } },
          format: { enum: ["typescript", "javascript", "declaration"] },
          runtimeBinding: { type: "object", required: ["name", "from"], additionalProperties: false,
            properties: { name: { type: "string", pattern: "^[A-Za-z_$][A-Za-z0-9_$]*$" }, from: { type: "string", minLength: 1 }, genericSchema: { type: "boolean" } } },
        },
      },
      outputSchema: { type: "object", required: ["format", "source"], additionalProperties: false,
        properties: { format: { enum: ["typescript", "javascript", "declaration"] }, source: { type: "string" } } },
      effects: { class: "pure", replay: "safe", coordination: "coordination-free", deterministic: true, totality: "partial" },
      annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false, readOnlyHint: true },
    },
  ];
}

/** The host supplies a repository and the existing native market; this grants no effects. */
export function fabricationOperations(binding, options = {}) {
  const root = options.root ?? binding?.repositoryRoot ?? options.environment?.METROPLAT_REPOSITORY_ROOT;
  if (typeof root !== "string" || !root.length) throw new TypeError("a fixed repository root is required");
  const registry = options.registry ?? DEFAULT_REGISTRY;
  let infer = options.infer, judge = options.judge;
  const composeDerivation = () => {
    if (infer === undefined && options.inference !== false) {
      // Fabrication consumes the host's admitted inference service. It neither
      // creates a configured customer nor opens another private purchasing port.
      // In-process hosts supply their existing service client; standalone callers
      // use the same authenticated machine-client protocol as other consumers.
      const market = options.inferenceCall === undefined
        ? remoteInferenceMarketFromEnv(options.environment ?? process.env)
        : remoteInferenceMarket({ call: options.inferenceCall });
      infer = request => market.chat(request);
      judge = (lot, outcome, evidence) => market.judge(lot, outcome, evidence);
    }
    return {
      infer: infer === undefined ? undefined : request => infer({ ...request,
        // Purchase constraints come from host composition, never the work-order caller.
        ...(options.workPlacement === undefined ? {} : { workPlacement: options.workPlacement }),
        ...(options.considerationPolicy === undefined ? {} : { considerationPolicy: options.considerationPolicy }),
        ...(options.agentBounds === undefined ? {} : { agentBounds: options.agentBounds }),
      }),
      judge,
      dependencyProjectRoot: options.dependencyProjectRoot ?? root,
    };
  };
  const dispatch = async (name, args) => {
    if (name === "project_json_schema_module") {
      const { entries, ...projection } = args;
      return { format: args.format ?? "typescript", source: renderJsonSchemaModule(entries, projection) };
    }
    if (name === "translate_work_order") {
      return translateMarkdownJsnodeOperationPackageSpecification({ type: "MarkdownJsnodeOperationPackageSpecificationTranslationRequest", version: 1, source: workOrderSource(root, args) });
    }
    if (name === "derive_jsnode_modules") {
      return deriveJsnodeModules(args.workOrder, composeDerivation());
    }
    if (name === "fabricate_jsnode_operation_package") {
      return fabricateMarkdownJsnodeOperationPackage({
        type: "MarkdownJsnodeOperationPackageFabricationRequest",
        version: 1,
        source: workOrderSource(root, args),
        destination: resolve(root, args.destination),
        registry: args.registry ?? registry,
        publish: args.publish ?? false,
      }, composeDerivation());
    }
    if (name === "list_fabrication_records") return listFabricationRecords(root, { limit: args.limit ?? 200 });
    throw new Error(`unregistered fabrication MCP tool: ${name}`);
  };
  return Object.freeze(fabricationDeclarations(registry).map(declaration => {
    const verb = "fabrication-" + declaration.name.replaceAll("_", "-");
    const readOnly = declaration.annotations.readOnlyHint;
    return operation({
      verb, summary: declaration.title, description: declaration.description,
      inputFormat: "json", outputFormat: "json",
      domain: schemaFrom({ $id: "fabrication/" + verb + "/input", ...declaration.inputSchema }),
      codomain: schemaFrom({ $id: "fabrication/" + verb + "/output", ...(declaration.outputSchema ?? { type: "object" }) }),
      effects: declaration.effects ?? { class: readOnly ? "host-read" : "external", replay: readOnly ? "safe" : "coordinated",
        coordination: readOnly ? "coordination-free" : "coordination-required", deterministic: "unmeasured", totality: "partial" },
      run: input => dispatch(declaration.name, input),
    });
  }));
}
