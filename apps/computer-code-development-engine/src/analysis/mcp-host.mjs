/** The workspace-analysis MCP surface, built in the process that serves it. */
import path from "node:path";
import { createMcpServer } from "@red-cup-engineering/mcp-engineering-services-section/server";
import { createJsnodeWorkspacePlatform } from "./service.mjs";
import { JSNODE_TOOLS, jsnodeInstructions } from "./mcp.mjs";

/**
 * Build one workspace-analysis MCP handler over a fixed repository root.
 * The host owns composition and passes the root explicitly; no MCP child reads CLI flags.
 */
export function openWorkspaceAnalysisMcp({ root, intervalSeconds, journalRoot } = {}) {
  if (typeof root !== "string" || root.length === 0) throw new TypeError("a fixed repository root is required");
  const name = "jsnode-workspace";
  const platform = createJsnodeWorkspacePlatform({
    name,
    root: path.resolve(root),
    ...(intervalSeconds === undefined ? {} : { intervalSeconds }),
    ...(journalRoot === undefined ? {} : { journalRoot: path.resolve(journalRoot) }),
  });
  const server = createMcpServer({ name, version: "0.8.0", tools: JSNODE_TOOLS, instructions: jsnodeInstructions(name) });
  return Object.freeze({ handle: (message) => server.handleMessage(message, { platform }) });
}
