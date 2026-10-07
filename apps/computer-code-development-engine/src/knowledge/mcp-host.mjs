/** The anchored-knowledge MCP surface, built in the process that serves it. */
import path from "node:path";
import { createMcpServer } from "@red-cup-engineering/mcp-engineering-services-section/server";
import { MAX_CLAIM_CHARACTERS, admitAnchoredFinding, readAnchoredFindings } from "./anchored-findings.mjs";

const ADDRESS = { type: "string", description: "A proof-path address: a repository path (file or section directory), optionally with #symbol. Empty is the whole repository." };

const tools = Object.freeze([
  {
    name: "read",
    description: "What the fleet already knows at a proof-path address, before you read or search the source there. Returns live findings at and beneath the address: final claims anchored to the git blobs they were learned from. A hit stands in for reading them. `relearn` lists addresses whose source changed or whose prior claim was unfinished model output.",
    inputSchema: {
      type: "object",
      properties: {
        address: ADDRESS,
        limit: { type: "number", description: "Maximum live findings returned; default 50. counts reports every finding regardless." },
        includeRetired: { type: "boolean", description: "Also list retired findings with changed anchors or the reason a claim was refused; default false." },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "admit",
    description: `Keep what you learned about the repository for every agent after you: one claim of at most ${MAX_CLAIM_CHARACTERS} characters at a proof-path address, anchored to the files you learned it from (by default the address's own file). The anchors' current content is hashed on admission, and the finding stays live until any of them changes. Admit what cost you reading to learn: what a module or section owns, its entry points, invariants, where a capability actually lives. Name findings you found wrong in \`supersedes\`.`,
    inputSchema: {
      type: "object",
      required: ["address", "claim"],
      properties: {
        address: ADDRESS,
        claim: { type: "string", maxLength: MAX_CLAIM_CHARACTERS },
        anchors: { type: "array", items: { type: "string" }, description: "Repository files the claim was learned from; default the address's file." },
        supersedes: { type: "array", items: { type: "string" }, description: "Ids of findings this one retires." },
        producer: {
          type: "object",
          properties: { agent: { type: "string" }, model: { type: "string" }, session: { type: "string" }, work: { type: "string" } },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
]);

const INSTRUCTIONS = "Anchored knowledge of the house repository, shared by every agent: read an address before reading its source, and admit what you learned there. A finding lives exactly as long as the files it is anchored to are unchanged.";

/** Build one anchored-knowledge MCP handler over a fixed repository and the settlement it journals into. */
export function openAnchoredKnowledgeMcp({ root, dataRoot, now = () => new Date().toISOString() } = {}) {
  if (typeof root !== "string" || root.length === 0) throw new TypeError("a fixed repository root is required");
  if (typeof dataRoot !== "string" || dataRoot.length === 0) throw new TypeError("a settlement data root is required");
  const store = Object.freeze({ root: path.resolve(root), dataRoot: path.resolve(dataRoot) });
  const call = (name, args = {}) => {
    if (name === "read") return readAnchoredFindings(store, args);
    if (name === "admit") return admitAnchoredFinding(store, args, now());
    throw new Error(`unknown anchored-knowledge operation ${name}`);
  };
  const server = createMcpServer({
    name: "anchored-knowledge",
    version: "0.1.0",
    instructions: INSTRUCTIONS,
    tools: tools.map((tool) => ({ ...tool, handler: (args) => call(tool.name, args) })),
  });
  return Object.freeze({ handle: (message) => server.handleMessage(message) });
}
