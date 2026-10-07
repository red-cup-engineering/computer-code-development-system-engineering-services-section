#!/usr/bin/env node
/**
 * One maintenance pass over the node's repository, run as its `repository-maintenance` node job at
 * idle priority: pack loose objects in batches (a one-shot repack is killed under memory pressure),
 * then write the multi-pack index and the commit graph with changed-path filters, so tree reads and
 * worktree creation stay fast however many writers commit. The repository is the node's working
 * tree (NODE_JOB_WORKING_TREE), else the checkout enclosing the working directory. Prints one JSON
 * line per step and exits nonzero when any step fails.
 */
import { spawnSync } from "node:child_process";

const LOOSE_OBJECT_BATCH = 50_000;
const repository = process.env.NODE_JOB_WORKING_TREE?.trim()
  || spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).stdout.trim();
if (!repository) throw new TypeError("maintain-repository: no repository (run as a node job, or inside a checkout)");

const steps = [
  ["loose-objects", ["-c", `maintenance.loose-objects.batchSize=${LOOSE_OBJECT_BATCH}`, "maintenance", "run", "--task=loose-objects"]],
  ["multi-pack-index", ["multi-pack-index", "write"]],
  ["commit-graph", ["commit-graph", "write", "--reachable", "--changed-paths"]],
];
let failed = false;
for (const [step, args] of steps) {
  const started = Date.now();
  const run = spawnSync("git", ["-C", repository, ...args], { encoding: "utf8" });
  const ok = run.status === 0;
  failed ||= !ok;
  process.stdout.write(`${JSON.stringify({ step, ok, seconds: Math.round((Date.now() - started) / 1000), ...(ok ? {} : { status: run.status, signal: run.signal, stderr: run.stderr.trim().slice(-400) }) })}\n`);
}
process.exitCode = failed ? 1 : 0;
