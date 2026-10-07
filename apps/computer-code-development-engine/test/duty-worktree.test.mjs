import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { defaultFilesystemBinding } from "@red-cup-engineering/computer-system-engine/rpc/binding";
import { executeJavascriptNodeCommandAsynchronously } from "@red-cup-engineering/execute-javascript-node-command-service/asynchronously";
import { WORK_BRANCH } from "@red-cup-engineering/git-services-section/git-command-codec";
import { dutyBranch, dutyWorktreeName, dutyWorktreeOperations, dutyWorktreePath, readDutyWorktreeCapacity } from "../src/workspace/duty-worktree.mjs";
import { workspaceReadoutOperations } from "../src/workspace/readout.mjs";
import { WORKTREE_PNPM } from "../src/workspace/worktree.mjs";

const DUTY = "work-item:duty-worktree/a";
const sandboxed = spawnSync("bwrap", ["--unshare-all", "--ro-bind", "/", "/", "--", "true"]).status === 0;

function git(root, ...arguments_) {
  const result = spawnSync("git", arguments_, { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

/** A shared checkout of a bare origin whose main holds one package with tests and a corpus of two
 *  sections, each linking the other. The package's second test passes only where the worktree
 *  cannot be written, as in the check's sandbox. */
function fixture(environment = {}) {
  const parent = mkdtempSync(path.join(tmpdir(), "duty-worktree-"));
  const origin = path.join(parent, "origin.git");
  const shared = path.join(parent, "shared");
  git(parent, "init", "--bare", "--initial-branch=main", origin);
  git(parent, "clone", origin, shared);
  git(shared, "config", "user.email", "house@example.invalid");
  git(shared, "config", "user.name", "House");
  mkdirSync(path.join(shared, "pkg", "test"), { recursive: true });
  writeFileSync(path.join(shared, "pkg", "package.json"), '{ "name": "pkg", "type": "module" }\n');
  writeFileSync(path.join(shared, "pkg", "value.mjs"), "export const value = 1;\n");
  writeFileSync(path.join(shared, "pkg", "test", "value.test.mjs"), [
    'import assert from "node:assert/strict";',
    'import { writeFileSync } from "node:fs";',
    'import test from "node:test";',
    'import { value } from "../value.mjs";',
    'test("value", () => assert.equal(value, 1));',
    'test("the check cannot write the worktree", () => assert.throws(() => writeFileSync("marker", "x"), { code: "EROFS" }));',
    "",
  ].join("\n"));
  for (const [section, other] of [["a", "b"], ["b", "a"]]) {
    mkdirSync(path.join(shared, "corpus", "services", `${section}-section`), { recursive: true });
    writeFileSync(path.join(shared, "corpus", "services", `${section}-section`, "README.md"), `# ${section}\n\nSee [${other}](../${other}-section/README.md).\n`);
  }
  git(shared, "add", ".");
  git(shared, "commit", "-m", "base");
  git(shared, "push", "-u", "origin", "HEAD:main");
  const env = { METROPLAT_DUTY_WORKTREES: path.join(parent, "duties"), METROPLAT_CORPUS_FACTS: path.join(parent, "facts"), ...environment };
  // Linking packages is pnpm's work, not this fixture's: its step succeeds without running.
  const linked = [];
  const runner = (request, policy) => {
    if (request.command !== WORKTREE_PNPM) return executeJavascriptNodeCommandAsynchronously(request, policy);
    linked.push(request.directory);
    return Promise.resolve({ result: { status: 0, signal: null, stdout: "", stderr: "", error: "" } });
  };
  const ready = new Set([DUTY, "work-item:duty-worktree/b"]);
  // The accepted receipts of the duty's work, as the work ledger would read them back.
  const accepted = [];
  const operations = Object.fromEntries(dutyWorktreeOperations({ repository: shared, dataRoot: path.join(parent, "data"), isReadyDuty: (scope) => ready.has(scope), acceptedWork: () => accepted, corpusRoot: "corpus", environment: env, runner }).map((entry) => [entry.verb, entry]));
  const readout = Object.fromEntries(workspaceReadoutOperations(defaultFilesystemBinding(path.join(parent, "data"), { packageRoot: shared }), { environment: env }).map((entry) => [entry.verb, entry]));
  return { parent, shared, env, linked, accepted, operations, readout };
}

test("a duty's name, branch and worktree read like its scope and never collide with a look-alike", () => {
  assert.notEqual(dutyWorktreeName("work-item:a/b"), dutyWorktreeName("work-item:a-b"));
  assert.match(dutyWorktreeName(DUTY), /^work-item-duty-worktree-a-[0-9a-f]{12}$/u);
  assert.ok(dutyWorktreeName(`work-item:${"x".repeat(200)}`).length <= 48 + 13);
  assert.match(dutyWorktreeName("///"), /^[0-9a-f]{12}$/u);
  assert.match(dutyBranch(DUTY), WORK_BRANCH);
  assert.equal(dutyWorktreePath(DUTY, { METROPLAT_DUTY_WORKTREES: "/duties" }), `/duties/${dutyWorktreeName(DUTY)}`);
});

test("a ready duty's worktree is opened, written, checked, committed onto the duty's branch, closed and resumed", async (context) => {
  const setup = fixture();
  context.after(() => rmSync(setup.parent, { recursive: true, force: true }));
  const { operations: duty, readout } = setup;
  const workspace = dutyWorktreePath(DUTY, setup.env);
  const branch = dutyBranch(DUTY);
  const main = git(setup.shared, "rev-parse", "HEAD");

  assert.equal((await duty["duty-worktree-open"].execute({ duty: "work-item:not-ready" })).reason, "duty-not-ready");
  assert.equal((await readout["workspace-file-replace"].execute({ duty: DUTY, path: "pkg/extra.mjs", content: "x\n" })).reason, "worktree-absent");

  const opened = await duty["duty-worktree-open"].execute({ duty: DUTY });
  assert.deepEqual(opened, { kind: "metroplat.workspace.duty-worktree:witness", duty: DUTY, branch, opened: true, head: main });
  assert.deepEqual(setup.linked, [workspace]);
  assert.equal((await duty["duty-worktree-open"].execute({ duty: DUTY })).opened, false);

  // Writes naming the duty land in its worktree, never in the shared checkout, and never in Git's files.
  const created = await readout["workspace-file-replace"].execute({ duty: DUTY, path: "pkg/lib/extra.mjs", content: "export const extra = 2;\n" });
  assert.equal(created.kind, "metroplat.filesystem.workspace-file-replace:witness", JSON.stringify(created));
  assert.equal(readFileSync(path.join(workspace, "pkg", "lib", "extra.mjs"), "utf8"), "export const extra = 2;\n");
  assert.equal(existsSync(path.join(setup.shared, "pkg", "lib", "extra.mjs")), false);
  assert.equal((await readout["workspace-file-replace"].execute({ duty: DUTY, path: "pkg/lib/extra.mjs", content: "again\n" })).reason, "stale-source");
  assert.equal((await readout["workspace-file-replace"].execute({ duty: DUTY, path: ".git/hooks/post-commit", content: "#!/bin/sh\n" })).reason, "outside-package");
  assert.equal((await readout["workspace-file-replace"].execute({ duty: DUTY, path: "../escape.mjs", content: "x\n" })).reason, "outside-package");

  if (sandboxed) {
    const checked = await duty["duty-worktree-check"].execute({ duty: DUTY });
    assert.equal(checked.ok, true, JSON.stringify(checked));
    assert.deepEqual(checked.packages.map(({ package: owner, tests, status, pass, fail }) => ({ owner, tests, status, pass, fail })), [{ owner: "pkg", tests: 1, status: 0, pass: 2, fail: 0 }]);
    assert.equal(existsSync(path.join(workspace, "pkg", "marker")), false);
  }

  const committed = await duty["duty-worktree-commit"].execute({ duty: DUTY, message: "Add the extra value" }, {}, { invocation: { subject: "character:outside" } });
  assert.equal(committed.committed, true, JSON.stringify(committed));
  assert.equal(committed.changes, 1);
  assert.equal(git(setup.shared, "ls-remote", "origin", `refs/heads/${branch}`).split(/\s/u)[0], committed.head);
  assert.equal(git(setup.shared, "ls-remote", "origin", "refs/heads/main").split(/\s/u)[0], main);
  assert.equal(git(workspace, "show", "-s", "--format=%B", committed.head), `Add the extra value\n\nDuty: ${DUTY}\nProvided-by: character:outside`);
  assert.equal((await duty["duty-worktree-commit"].execute({ duty: DUTY, message: "Again" })).committed, false);

  // Closing keeps the branch; the next opening resumes from it.
  assert.equal((await duty["duty-worktree-close"].execute({ duty: DUTY })).closed, true);
  assert.equal(existsSync(workspace), false);
  assert.equal(git(setup.shared, "rev-parse", `refs/heads/${branch}`), committed.head);
  assert.equal((await readout["workspace-file-slice"].execute({ duty: DUTY, path: "pkg/value.mjs" })).reason, "worktree-absent");
  const resumed = await duty["duty-worktree-open"].execute({ duty: DUTY });
  assert.equal(resumed.head, committed.head);
  assert.equal(existsSync(path.join(workspace, "pkg", "lib", "extra.mjs")), true);
  assert.equal((await duty["duty-worktree-close"].execute({ duty: DUTY })).closed, true);
  assert.equal((await duty["duty-worktree-close"].execute({ duty: DUTY })).closed, false);
});

test("a check reports each failing test, a clean duty has nothing to commit, and the node opens only so many worktrees", async (context) => {
  const setup = fixture({ METROPLAT_DUTY_WORKTREE_LIMIT: "1" });
  context.after(() => rmSync(setup.parent, { recursive: true, force: true }));
  const { operations: duty, readout } = setup;
  assert.equal((await duty["duty-worktree-open"].execute({ duty: DUTY })).opened, true);
  assert.equal((await duty["duty-worktree-commit"].execute({ duty: DUTY, message: "Nothing" })).reason, "nothing-to-commit");
  assert.equal((await duty["duty-worktree-open"].execute({ duty: "work-item:duty-worktree/b" })).reason, "worktree-limit");

  if (sandboxed) {
    const workspace = dutyWorktreePath(DUTY, setup.env);
    const value = readFileSync(path.join(workspace, "pkg", "value.mjs"), "utf8");
    const { artifactId } = await import("@red-cup-engineering/semiotic-eavt-services-section/identity");
    const replaced = await readout["workspace-file-replace"].execute({ duty: DUTY, path: "pkg/value.mjs", expected: artifactId(value), content: "export const value = 3;\n" });
    assert.equal(replaced.before, artifactId(value));
    const checked = await duty["duty-worktree-check"].execute({ duty: DUTY });
    assert.equal(checked.ok, false);
    assert.equal(checked.packages[0].fail, 1);
    assert.match(checked.packages[0].failures, /not ok \d+ - value/u);
  }
});

test("a check holds the corpus a duty changes to the ratchet: no section's debt may rise", async (context) => {
  const setup = fixture();
  context.after(() => rmSync(setup.parent, { recursive: true, force: true }));
  const { operations: duty } = setup;
  assert.equal((await duty["duty-worktree-open"].execute({ duty: DUTY })).opened, true);
  const workspace = dutyWorktreePath(DUTY, setup.env);
  assert.equal((await duty["duty-worktree-check"].execute({ duty: DUTY })).corpus, undefined, "a duty that leaves the corpus alone is not censused");

  // Deleting b's page breaks a's link to it: damage lands in the section that did not change.
  rmSync(path.join(workspace, "corpus", "services", "b-section", "README.md"));
  const refused = await duty["duty-worktree-check"].execute({ duty: DUTY });
  assert.equal(refused.ok, false, JSON.stringify(refused));
  assert.deepEqual(refused.corpus.rises, [{ section: "services/a-section", measure: "brokenLinks", base: 0, candidate: 1 }]);
  assert.equal(refused.corpus.fork, git(setup.shared, "rev-parse", "HEAD"));

  // Moving it instead carries its debt with it, and a's link follows it.
  mkdirSync(path.join(workspace, "corpus", "services", "c-section"), { recursive: true });
  writeFileSync(path.join(workspace, "corpus", "services", "c-section", "README.md"), "# b\n\nSee [a](../a-section/README.md).\n");
  writeFileSync(path.join(workspace, "corpus", "services", "a-section", "README.md"), "# a\n\nSee [b](../c-section/README.md).\n");
  const admitted = await duty["duty-worktree-check"].execute({ duty: DUTY });
  assert.equal(admitted.corpus.holds, true, JSON.stringify(admitted));
  assert.equal(admitted.corpus.moves, 1);
  assert.equal(admitted.ok, true);
  assert.equal((await duty["duty-worktree-close"].execute({ duty: DUTY })).closed, true);
});

test("the holder joins only the commit an independent receiver accepted, then retires the duty's worktree and branch", async (context) => {
  const setup = fixture();
  context.after(() => rmSync(setup.parent, { recursive: true, force: true }));
  const { operations: duty, readout, accepted } = setup;
  const branch = dutyBranch(DUTY);
  const integrate = duty["duty-worktree-integrate"];
  const subject = "fixture:intent";
  assert.equal(integrate.locus, undefined, "no standing attenuated to a duty reaches the join");

  await duty["duty-worktree-open"].execute({ duty: DUTY });
  await readout["workspace-file-replace"].execute({ duty: DUTY, path: "pkg/lib/extra.mjs", content: "export const extra = 2;\n" });
  const first = await duty["duty-worktree-commit"].execute({ duty: DUTY, message: "Add the extra value" }, {}, { invocation: { subject: "character:outside" } });
  assert.equal((await integrate.execute({ duty: DUTY, subject })).reason, "not-accepted");

  // Work committed after the receiver accepted is not the work it accepted.
  const receipt = (evidence) => ({ scope: DUTY, subject, provider: "character:outside", receiver: "office:holder", providerEvidence: evidence });
  accepted.push(receipt(["account:character:outside", `commit:${first.head}`]));
  assert.equal((await integrate.execute({ duty: DUTY, subject: "fixture:unrelated" })).reason, "not-accepted");
  await readout["workspace-file-replace"].execute({ duty: DUTY, path: "pkg/lib/later.mjs", content: "export const later = 3;\n" });
  const second = await duty["duty-worktree-commit"].execute({ duty: DUTY, message: "Add a later value" });
  assert.equal((await integrate.execute({ duty: DUTY, subject })).reason, "head-not-accepted");

  accepted.push(receipt([`commit:${second.head}`]));
  const joined = await integrate.execute({ duty: DUTY, subject }, {}, { startedAt: "2026-09-28T12:00:00.000Z" });
  assert.equal(joined.integrated, true, JSON.stringify(joined));
  assert.equal(joined.branchHead, second.head);
  const main = git(setup.shared, "ls-remote", "origin", "refs/heads/main").split(/\s/u)[0];
  assert.equal(joined.queued, true);
  assert.equal(main, git(setup.shared, "rev-parse", "HEAD"));
  assert.equal(joined.candidate.commit, second.head);
  assert.equal(git(setup.shared, "rev-parse", `refs/queue/${joined.candidate.name}^{}`), second.head);
  assert.equal(existsSync(path.join(setup.shared, "pkg", "lib", "later.mjs")), false, "naming a candidate must leave the source owner's checkout unchanged");
  assert.equal(existsSync(dutyWorktreePath(DUTY, setup.env)), false);
  assert.equal(spawnSync("git", ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`], { cwd: setup.shared }).status, 1);
  assert.equal(git(setup.shared, "ls-remote", "origin", `refs/heads/${branch}`), "");
  assert.equal((await integrate.execute({ duty: DUTY, subject })).reason, "branch-absent");
});


test("retained unregistered evidence does not use capacity, but interrupted registrations do", async context => {
  const setup = fixture({ METROPLAT_DUTY_WORKTREE_LIMIT: "1" });
  context.after(() => rmSync(setup.parent, { recursive: true, force: true }));
  const evidence = path.join(setup.env.METROPLAT_DUTY_WORKTREES, "retained-evidence");
  mkdirSync(evidence, { recursive: true });
  writeFileSync(path.join(evidence, "proposal.txt"), "preserved source");
  assert.equal((await setup.operations["duty-worktree-open"].execute({ duty: DUTY })).opened, true);
  const workspace = dutyWorktreePath(DUTY, setup.env);
  rmSync(path.join(workspace, ".git"));
  assert.deepEqual(readDutyWorktreeCapacity(setup.env, setup.shared), { resources: [workspace], retainedDirectories: [evidence] });
  assert.equal((await setup.operations["duty-worktree-open"].execute({ duty: "work-item:duty-worktree/b" })).reason, "worktree-limit");
  assert.equal(readFileSync(path.join(evidence, "proposal.txt"), "utf8"), "preserved source");
});

test("simultaneous independent openings share the finite capacity boundary", async context => {
  const setup = fixture({ METROPLAT_DUTY_WORKTREE_LIMIT: "1" });
  context.after(() => rmSync(setup.parent, { recursive: true, force: true }));
  const results = await Promise.all([DUTY, "work-item:duty-worktree/b"].map(duty => setup.operations["duty-worktree-open"].execute({ duty })));
  assert.equal(results.filter(result => result.opened === true).length, 1);
  assert.equal(results.filter(result => result.reason === "worktree-limit").length, 1);
  assert.equal(readDutyWorktreeCapacity(setup.env, setup.shared).resources.length, 1);
});

test("an existing workspace cannot be reused under a different source owner", async context => {
  const setup = fixture();
  context.after(() => rmSync(setup.parent, { recursive: true, force: true }));
  await setup.operations["duty-worktree-open"].execute({ duty: DUTY });
  const other = fixture();
  context.after(() => rmSync(other.parent, { recursive: true, force: true }));
  const open = dutyWorktreeOperations({ repository: other.shared, dataRoot: other.parent, isReadyDuty: () => true, environment: setup.env }).find(entry => entry.verb === "duty-worktree-open");
  await assert.rejects(open.execute({ duty: DUTY }), /belongs to another source repository/);
  assert.equal(git(dutyWorktreePath(DUTY, setup.env), "rev-parse", "--git-common-dir"), path.join(setup.shared, ".git"));
});
