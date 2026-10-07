#!/usr/bin/env node
// Commits exactly the named files of a checkout without touching any other writer's index entries
// or worktree edits; with --push, lands them through the node's merge queue instead: a candidate on
// origin/main holding what the checkout has at each named path, which the node integrates, admits
// and publishes (nobody else moves main). `git stash`, `git rebase`, `git pull` and `git reset` act
// on the whole worktree and take every other session's uncommitted edits with them.
//
//   commit-paths --message <message> [--push [--candidate <owner>/<slice>]] [--dry-run] <path>...
//
// Paths are files, relative to the current directory or absolute, inside one repository.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { parseArgs } from "node:util";

import { commitGitPaths } from "../src/git/operations.mjs";

if (import.meta.main) {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { message: { type: "string", short: "m" }, push: { type: "boolean", default: false }, candidate: { type: "string" }, "dry-run": { type: "boolean", default: false } } });
  const root = path.resolve(execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim());
  const paths = positionals.map((file) => path.relative(root, path.resolve(file)).split(path.sep).join("/"));
  const result = commitGitPaths({ packageRoot: root }, { paths, message: values.message, push: values.push, dryRun: values["dry-run"], ...(values.candidate ? { candidate: values.candidate } : {}) });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.ok ? 0 : 1;
}
