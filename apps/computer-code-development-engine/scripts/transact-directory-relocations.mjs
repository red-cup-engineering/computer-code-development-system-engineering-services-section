#!/usr/bin/env node
// Relocates tracked directories of the house repository in one worktree transaction that lands on
// origin/main through branch integration. Reads a JSON array of { from, to } moves on stdin.
//
//   node transact-directory-relocations.mjs --repository <shared checkout> --message <message> [--dry-run] < moves.json
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { transactDirectoryRelocations } from "../src/workspace/relocation.mjs";

if (import.meta.main) {
  const { values } = parseArgs({ options: { repository: { type: "string", default: process.cwd() }, message: { type: "string" }, "dry-run": { type: "boolean", default: false } } });
  const result = await transactDirectoryRelocations({ repository: path.resolve(values.repository), moves: JSON.parse(readFileSync(0, "utf8")), message: values.message, dryRun: values["dry-run"] });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.landing?.ok === false ? 1 : 0;
}
