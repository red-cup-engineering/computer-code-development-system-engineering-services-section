import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { executeJavascriptNodeCommandAsynchronously } from "@red-cup-engineering/execute-javascript-node-command-service/asynchronously";
import { dutyBranch, dutyWorktreeOperations, dutyWorktreePath } from "../src/workspace/duty-worktree.mjs";
import { WORKTREE_PNPM } from "../src/workspace/worktree.mjs";
import { composeCandidates, pendingCandidates } from "@red-cup-engineering/node-runtime-release-promotion-service/integrate";
const git = (root, ...args) => {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
};
test("duty work preserves original source across resume and independent receiving", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "source-delivery-custody-"));
  try {
    const origin = path.join(root, "origin.git");
    const shared = path.join(root, "shared");
    git(root, "init", "--bare", "--initial-branch=main", origin);
    git(root, "clone", origin, shared);
    git(shared, "config", "user.name", "Controlled producer");
    git(shared, "config", "user.email", "controlled@example.invalid");
    writeFileSync(path.join(shared, "consumer.mjs"), "export const value = () => 1;\n");
    git(shared, "add", "."); git(shared, "commit", "-m", "original"); git(shared, "push", "origin", "HEAD:main");
    const sourceBase = git(shared, "rev-parse", "HEAD");
    const duty = "controlled:source-delivery";
    const environment = { METROPLAT_DUTY_WORKTREES: path.join(root, "work") };
    const runner = (request, policy) => request.command === WORKTREE_PNPM
      ? Promise.resolve({ result: { status: 0, signal: null, stdout: "", stderr: "", error: "" } })
      : executeJavascriptNodeCommandAsynchronously(request, policy);
    const accepted = []; // Controlled receiving evidence; no real appointment or work acceptance.
    const operations = Object.fromEntries(dutyWorktreeOperations({ repository: shared, dataRoot: root, isReadyDuty: () => true, acceptedWork: () => accepted, corpusRoot: "", environment, runner }).map(entry => [entry.verb, entry]));
    const call = (verb, args = {}) => operations[verb].execute({ duty, ...args });
    assert.equal((await call("duty-worktree-open")).sourceBase, sourceBase);
    writeFileSync(path.join(dutyWorktreePath(duty, environment), "consumer.mjs"), "export const value = () => 2;\n");
    const work = await call("duty-worktree-commit", { message: "intended effect" });
    await call("duty-worktree-close");
    writeFileSync(path.join(shared, "receiving-state.json"), '{"current":true}\n');
    git(shared, "add", "."); git(shared, "commit", "-m", "concurrent receiving state"); git(shared, "push", "origin", "HEAD:main");
    const resumed = await call("duty-worktree-open");
    assert.equal(resumed.sourceBase, sourceBase);
    assert.equal(resumed.head, work.head);
    const args = { subject: "controlled:intent" };
    assert.equal((await call("duty-worktree-integrate", args)).reason, "not-accepted");
    accepted.push({ scope: duty, subject: args.subject, provider: "controlled:provider", receiver: "controlled:independent-receiver", providerEvidence: [`commit:${work.head}`] });
    assert.equal((await call("duty-worktree-integrate", { ...args, sourceBase: git(shared, "rev-parse", "HEAD") })).reason, "source-base-mismatch");
    // Older work with no recorded before-source must be declared; it is never inferred from main.
    git(shared, "config", "--unset", `branch.${dutyBranch(duty)}.sourceBase`);
    assert.equal((await call("duty-worktree-integrate", args)).reason, "source-base-absent");
    const joined = await call("duty-worktree-integrate", { ...args, sourceBase });
    assert.equal(joined.queued, true, JSON.stringify(joined));
    const candidates = await pendingCandidates({ repository: shared, queueRoot: path.join(root, "queue") });
    const result = await composeCandidates({ repository: shared, base: git(shared, "rev-parse", "HEAD"), candidates });
    assert.equal(result.conflicts.length, 0);
    assert.equal(git(shared, "show", `${result.head}:consumer.mjs`), "export const value = () => 2;");
    assert.equal(git(shared, "show", `${result.head}:receiving-state.json`), '{"current":true}');
    console.log(JSON.stringify({ controlled: true, nativeDutyProducerAndReceiver: true, originalSourceSurvivesResume: true, independentReceivingRetained: true, ambiguousSourceRefused: true, concurrentReceivingStateRetained: true }));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
