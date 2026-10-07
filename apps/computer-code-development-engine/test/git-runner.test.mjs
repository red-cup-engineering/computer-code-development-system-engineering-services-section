import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { gitRepositoryObservationPlan } from "@red-cup-engineering/git-services-section/git-command-codec";
import { executeGitPlan } from "../src/git/runner.mjs";

test("the code-development Git runner executes the shared codec plan", () => {
  const repository = mkdtempSync(path.join(tmpdir(), "git-runner-test-"));
  try {
    execFileSync("git", ["init", "--quiet", "--initial-branch=main"], { cwd: repository });
    writeFileSync(path.join(repository, "README.md"), "fixture\n");
    execFileSync("git", ["add", "README.md"], { cwd: repository });
    execFileSync("git", ["-c", "user.name=Git Runner Test", "-c", "user.email=git-runner@example.invalid", "commit", "--quiet", "-m", "fixture"], { cwd: repository });
    const commands = [];
    const receipt = executeGitPlan(repository, gitRepositoryObservationPlan.head(), commands);
    assert.equal(receipt.status, 0);
    assert.match(receipt.stdout.trim(), /^[0-9a-f]{40,64}$/u);
    assert.equal(commands.length, 1);
  } finally {
    rmSync(repository, { recursive: true, force: true });
  }
});
