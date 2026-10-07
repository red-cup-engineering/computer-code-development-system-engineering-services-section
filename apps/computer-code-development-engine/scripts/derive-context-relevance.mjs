#!/usr/bin/env node
import path from "node:path";

import { deriveContextRelevance } from "../src/coding-context/context-relevance.mjs";
import { runJavascriptNodeOperation } from "@red-cup-engineering/javascript-node-services-section/operation";

export async function deriveContextRelevanceScript(params = {}) {
  const repoRoot = path.resolve(typeof params.repoRoot === "string" ? params.repoRoot : process.cwd());
  return deriveContextRelevance(repoRoot, params);
}

if (import.meta.main) {
  const result = await runJavascriptNodeOperation({ name: "derive-context-relevance", description: "deriveContextRelevanceScript — the derive-context-relevance operation.", operation: deriveContextRelevanceScript }, { arguments: process.argv.slice(2), standardInput: process.stdin, standardOutput: process.stdout });
  process.exitCode = result.exitCode;
}
