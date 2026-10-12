#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { executeSoftwareMission, induceVerifiedSoftwareMissionProposal } from "../src/mission/client.mjs";

async function main() {
  const input = JSON.parse(readFileSync(0, "utf8"));
  const result = await executeSoftwareMission(input.mission, input.execution);
  if (input.receiver !== undefined && !result.outcome?.proposal) {
    throw new Error("receiver induction requires one verified SoftwareMissionChangeProposal");
  }
  const induction = input.receiver === undefined
    ? null
    : induceVerifiedSoftwareMissionProposal({ ...input.receiver, proposal: result.outcome?.proposal });
  process.stdout.write(`${JSON.stringify({ result, induction })}\n`);
  if (result.outcome?.verified !== true && result.outcome?.answered !== true) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
