/** MCP projects the same specification-bound operations that allocated workers use. */
import { createMcpServer } from "@red-cup-engineering/mcp-engineering-services-section/server";
import { fabricationOperations } from "./operations.mjs";

const instructions = "The fabrication line translates sourced requirements into canonical module or package orders. A Modules order carries explicit receiving obligations and produces source proposals for an existing consumer; a Package order retains its package-birth obligations. Supply exactly one local path or inline MarkdownDocumentSource. An inline source path is a provenance locator, never fetched or interpreted as authority. translate_work_order shows which documents the translator admits. list_fabrication_records lists only translator-accepted JSNode work orders, plus fabrication receipts; arbitrary Markdown under a specifications directory is not a work order. derive_jsnode_modules returns an admitted-work-order-bound source proposal and schemas without creating a package or using a registry. Submit it for independent receiving and authorized application to an existing consumer. Package publication requires publish:true and activation is separate. Write no script by hand that this line can fabricate. fabricate_jsnode_operation_package refuses a destination whose parent already holds sibling single-function packages (org-layering.md's \"A services-section IS the package\") — the fix is a new script inside an existing or new <topic>-services-section package, never another sibling package there.";

export function openFabricationMcp(options = {}) {
  const operations = fabricationOperations(undefined, options);
  const server = createMcpServer({
    name: "jsnode-fabrication", version: "0.1.0", instructions,
    tools: operations.map(op => ({
      name: op.verb.slice("fabrication-".length).replaceAll("-", "_"),
      title: op.summary, description: op.description, inputSchema: op.domain.schema,
      annotations: { destructiveHint: false, idempotentHint: op.effects.replay === "safe",
        openWorldHint: op.effects.class === "external", readOnlyHint: ["pure", "host-read"].includes(op.effects.class) },
      handler: args => op.execute(args),
    })),
  });
  return Object.freeze({ handle: message => server.handleMessage(message) });
}
