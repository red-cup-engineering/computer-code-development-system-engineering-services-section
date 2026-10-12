#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { induceVerifiedSoftwareMissionProposal } from "../src/mission/client.mjs";

/**
 * Induces one verified mission proposal supplied on standard input.
 * @returns {void}
 * @throws {Error} When the receiver input is malformed or induction refuses.
 */
function main() {
  const input = JSON.parse(readFileSync(0, "utf8"));
  const result = induceVerifiedSoftwareMissionProposal(input);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
