import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { OBSERVATION_TYPE, RESTORE_CLASS, observeRepositoryRestore, observeRestoreReceiptFile, restoreAvailabilityFromReceipt } from "../src/git/restore.mjs";

const gitBin = "/usr/bin/git";
const REQUEST_TYPE = "RepositoryRestoreObservationRequest";

test("a bounded restore verifies selected files fetched from a real local remote, and names where it stops", async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "repository-restore-fixture-"));
  const source = join(fixtureRoot, "source");
  try {
    await mkdir(join(source, "control"), { recursive: true });
    git(fixtureRoot, ["init", "--quiet", "--initial-branch=main", source]);
    await writeFile(join(source, "README.md"), "fixture repository\n");
    await writeFile(join(source, "control", "task-corpus.json"), '{"tasks":[]}\n');
    await writeFile(join(source, "unselected.txt"), "left behind\n");
    git(source, ["add", "README.md", "control/task-corpus.json", "unselected.txt"]);
    git(source, ["-c", "user.name=Restore Test", "-c", "user.email=restore@example.invalid", "commit", "--quiet", "-m", "fixture"]);
    const expectedCommit = git(source, ["rev-parse", "HEAD"]).trim();

    const observation = observeRepositoryRestore(
      { type: REQUEST_TYPE, remoteUrl: source, ref: "main", requiredPaths: ["control/task-corpus.json", "README.md"] },
      { recordedAt: "2026-08-29T12:00:00.000Z" },
    );
    assert.equal(observation.type, OBSERVATION_TYPE);
    assert.equal(observation.available, true, observation.diagnostic);
    assert.equal(observation.fresh, true);
    assert.equal(observation.restoreClass, RESTORE_CLASS);
    assert.equal(observation.source.commit, expectedCommit);
    assert.deepEqual(observation.restoredMaterial.map(({ path }) => path), ["README.md", "control/task-corpus.json"]);
    assert.ok(observation.restoredMaterial.every(({ carrier }) => carrier === "git-blob"));
    assert.equal(observation.restoredMaterial[0].gitObject, git(source, ["rev-parse", "HEAD:README.md"]).trim());
    assert.ok(observation.doesNotProve.includes("untracked-or-ignored-files"));
    assert.equal(observation.temporaryRepositoryRemoved, true);
    assert.equal(git(source, ["status", "--porcelain"]), "");

    const missing = observeRepositoryRestore({ type: REQUEST_TYPE, remoteUrl: source, ref: "main", requiredPaths: ["absent.txt"] });
    assert.equal(missing.available, false);
    assert.equal(missing.failedAt, "inspect-selected-material");
    assert.match(missing.diagnostic, /absent\.txt/u);

    const unreachable = observeRepositoryRestore({ type: REQUEST_TYPE, remoteUrl: join(fixtureRoot, "absent"), ref: "main", requiredPaths: ["README.md"] });
    assert.equal(unreachable.available, false);
    assert.equal(unreachable.failedAt, "fetch-remote-ref");
    assert.equal(unreachable.temporaryRepositoryRemoved, true);
    assert.equal(unreachable.source.commit, undefined);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test("an inadmissible restore request throws before any effect", () => {
  assert.throws(() => observeRepositoryRestore({ type: REQUEST_TYPE, remoteUrl: "origin", ref: "main", requiredPaths: ["../secret"] }), /parent segment/u);
  assert.throws(() => observeRepositoryRestore({ type: REQUEST_TYPE, remoteUrl: "origin", ref: "main", requiredPaths: ["README.md"], argv: ["status"] }), /may not select argv/u);
});

test("a restore receipt is admitted while fresh, reported stale after, and read from an absolute file", async () => {
  const receipt = {
    type: OBSERVATION_TYPE,
    available: true,
    fresh: true,
    restoreClass: RESTORE_CLASS,
    source: { remoteUrl: "origin", ref: "main", commit: "a".repeat(40) },
    requiredPaths: ["README.md"],
    restoredMaterial: [{ path: "README.md", carrier: "git-blob" }],
    doesNotProve: ["untracked-or-ignored-files"],
    temporaryRepositoryRemoved: true,
    recordedAt: "2026-08-29T12:00:00.000Z",
    summary: "bounded restore succeeded",
  };
  const twoDays = 2 * 24 * 60 * 60 * 1000;
  const current = restoreAvailabilityFromReceipt(receipt, { observedAt: "2026-08-30T12:00:00.000Z", maximumAgeMilliseconds: twoDays });
  assert.equal(current.available, true);
  assert.ok(current.evidence.includes("not-proven:untracked-or-ignored-files"));
  const stale = restoreAvailabilityFromReceipt(receipt, { observedAt: "2026-09-02T12:00:00.000Z", maximumAgeMilliseconds: twoDays });
  assert.equal(stale.available, false);
  assert.match(stale.summary, /stale/u);
  assert.throws(() => restoreAvailabilityFromReceipt(receipt, { observedAt: "2026-08-29T11:00:00.000Z" }), /future/u);
  assert.throws(() => restoreAvailabilityFromReceipt({ ...receipt, requiredPaths: ["other.md"] }), /omits required/u);

  const directory = await mkdtemp(join(tmpdir(), "repository-restore-receipt-"));
  try {
    const file = join(directory, "receipt.json");
    await writeFile(file, JSON.stringify(receipt));
    const fromFile = observeRestoreReceiptFile(file, { observedAt: "2026-08-30T12:00:00.000Z" });
    assert.equal(fromFile.available, true);
    assert.equal(fromFile.evidence[0], `file:${file}`);
    assert.throws(() => observeRestoreReceiptFile("receipt.json"), /absolute/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

function git(cwd, args) {
  return execFileSync(gitBin, args, { cwd, encoding: "utf8" });
}
