#!/usr/bin/env node
import { createInterface } from "node:readline";
import { collapseWorkspacePackages, relocateWorkspace } from "../src/workspace-relocation.mjs";

if (import.meta.main) {
  for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
    if (line.trim()) {
      const request = JSON.parse(line);
      const run = request.kind === "package-collapse" ? collapseWorkspacePackages : relocateWorkspace;
      process.stdout.write(JSON.stringify(await run(request)) + "\n");
    }
  }
}
