/**
 * @packageDocumentation
 *
 * The code-development engine's bounded restore assay: materialize selected tracked files of one
 * remote ref in a fresh temporary repository, verify each against the remote's objects, remove the
 * repository, and admit such a receipt as current restore availability while it is fresh. A
 * successful receipt proves that projection at one commit, never a full backup restore. Arguments
 * and output decoding are git-services-section's codecs; every command runs through the engine's
 * one runner.
 */
import { lstatSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { sha256Digest } from "@red-cup-engineering/cryptographic-computer-data-engineering-services-section/integrity";
import { gitRestorePlan as plan, readLfsPointer, readOid, readRepositoryRestoreRequest } from "@red-cup-engineering/git-services-section/git-command-codec";

import { executeGitPlan } from "./runner.mjs";

export const RESTORE_CLASS = "bounded-git-tracked-projection";
export const OBSERVATION_TYPE = "RepositoryRestoreObservation";
export const DEFAULT_MAXIMUM_RECEIPT_AGE_MILLISECONDS = 31 * 24 * 60 * 60 * 1000;

const FIXED_OPERATIONS = Object.freeze([
  "initialize-empty-temporary-repository",
  "configure-promisor-remote",
  "fetch-one-ref-at-depth-one-with-tree-filter",
  "configure-exact-sparse-projection",
  "checkout-detached-fetched-commit-with-lfs-smudge-disabled",
  "restore-and-verify-selected-lfs-objects-if-required",
  "verify-selected-material-against-remote-git-objects",
  "remove-temporary-repository",
]);

const DOES_NOT_PROVE = Object.freeze([
  "full-repository-checkout",
  "local-commits-absent-from-the-remote-ref",
  "working-tree-changes",
  "untracked-or-ignored-files",
  "credentials-hooks-or-machine-configuration",
  "external-service-state",
  "backup-integrity-retention-or-history",
  "google-drive-or-restic-recoverability",
]);

/** The restored file inside `repository`: a regular file whose real path stays inside it. */
function restoredFile(repository, file) {
  const absolute = path.join(repository, file);
  let real;
  try {
    real = realpathSync(absolute);
  } catch {
    throw new Error(`required restored file is absent: ${file}`);
  }
  if (!real.startsWith(`${repository}${path.sep}`)) throw new Error(`restored path escapes temporary repository: ${file}`);
  if (!lstatSync(absolute).isFile()) throw new Error(`required restored file is absent: ${file}`);
  return absolute;
}

/** Verify one restored file: a large-file object against its pointer's digest and size, any other
 *  file against the blob its commit names. */
function verifyRestoredFile(repository, { file, absolute, object, pointer, pointerBytes }, commands) {
  const content = readFileSync(absolute);
  if (pointer !== null) {
    const digest = sha256Digest(content);
    if (digest !== pointer.oid || String(content.length) !== pointer.size) throw new Error(`restored Git LFS object does not match its pointer: ${file}`);
    return Object.freeze({ path: file, carrier: "git-lfs", gitObject: object, pointerDigest: sha256Digest(pointerBytes), contentDigest: digest, bytes: String(content.length) });
  }
  if (readOid(executeGitPlan(repository, plan.worktreeObject(file), commands).stdout) !== object) throw new Error(`restored file does not match its remote Git blob: ${file}`);
  return Object.freeze({ path: file, carrier: "git-blob", gitObject: object, contentDigest: sha256Digest(content), bytes: String(content.length) });
}

/**
 * Observe whether a request's files can be restored from its remote ref now: fetch the ref into a
 * fresh temporary repository, check out exactly those files, verify them, and remove the
 * repository. A failure is negative evidence naming the stage it stopped at, never a throw; only an
 * inadmissible request throws.
 */
export function observeRepositoryRestore(input, { recordedAt = new Date().toISOString() } = {}) {
  const request = readRepositoryRestoreRequest(input);
  const commands = [];
  const bounds = { restoreClass: RESTORE_CLASS, requiredPaths: request.requiredPaths, fixedOperations: FIXED_OPERATIONS, doesNotProve: DOES_NOT_PROVE };
  let temporaryRoot;
  let stage = "create-temporary-directory";
  try {
    temporaryRoot = realpathSync(mkdtempSync(path.join(tmpdir(), "repository-restore-observation-")));
    const repository = path.join(temporaryRoot, "repository");
    const run = (step) => executeGitPlan(repository, step, commands);
    stage = "initialize-repository";
    executeGitPlan(temporaryRoot, plan.initialize("repository"), commands);
    for (const step of [plan.addOrigin(request.remoteUrl), plan.promisor(), plan.treelessFilter()]) run(step);
    stage = "fetch-remote-ref";
    run(plan.fetch(request.ref));
    const commit = readOid(run(plan.fetched()).stdout);
    stage = "configure-sparse-projection";
    run(plan.sparse(request.requiredPaths));
    stage = "checkout-remote-commit";
    run(plan.checkout(commit));
    stage = "inspect-selected-material";
    const selected = request.requiredPaths.map((file) => {
      const absolute = restoredFile(repository, file);
      const pointerBytes = readFileSync(absolute);
      return { file, absolute, object: readOid(run(plan.object(commit, file)).stdout), pointer: readLfsPointer(pointerBytes), pointerBytes };
    });
    const largeFiles = selected.filter((entry) => entry.pointer !== null).map((entry) => entry.file);
    if (largeFiles.length > 0) {
      stage = "restore-selected-lfs-objects";
      run(plan.pullLfs(largeFiles));
    }
    stage = "verify-selected-material";
    const restoredMaterial = Object.freeze(selected.map((entry) => verifyRestoredFile(repository, entry, commands)));
    return Object.freeze({
      type: OBSERVATION_TYPE,
      available: true,
      fresh: true,
      ...bounds,
      source: Object.freeze({ remoteUrl: request.remoteUrl, ref: request.ref, commit }),
      restoredMaterial,
      proves: Object.freeze([
        "remote-ref-resolved-to-commit",
        "selected-tracked-files-materialized-in-a-fresh-temporary-repository",
        "selected-material-verified-against-remote-git-objects",
      ]),
      customerRepositoryMutation: false,
      temporaryRepositoryRemoved: true,
      recordedAt,
      summary: `Fresh bounded Git restore verified ${restoredMaterial.length} selected tracked file${restoredMaterial.length === 1 ? "" : "s"} at ${commit}. This is not a full backup restore.`,
    });
  } catch (error) {
    return Object.freeze({
      type: OBSERVATION_TYPE,
      available: false,
      fresh: false,
      ...bounds,
      source: Object.freeze({ remoteUrl: request.remoteUrl, ref: request.ref }),
      failedAt: stage,
      diagnostic: error instanceof Error ? error.message : String(error),
      customerRepositoryMutation: false,
      temporaryRepositoryRemoved: temporaryRoot !== undefined,
      recordedAt,
      summary: "The bounded Git restore observation did not produce a verified fresh projection.",
    });
  } finally {
    if (temporaryRoot !== undefined) rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

/**
 * Admit a successful restore receipt as restore availability at `observedAt`: available while it is
 * no older than `maximumAgeMilliseconds` (31 days by default). A stale receipt still witnesses the
 * earlier restore but no longer reports current availability; a receipt dated more than five
 * minutes ahead is refused.
 */
export function restoreAvailabilityFromReceipt(receipt, { observedAt = new Date().toISOString(), maximumAgeMilliseconds = DEFAULT_MAXIMUM_RECEIPT_AGE_MILLISECONDS } = {}) {
  if (!Number.isSafeInteger(maximumAgeMilliseconds) || maximumAgeMilliseconds < 0) throw new TypeError("maximumAgeMilliseconds must be a nonnegative safe integer");
  if (receipt?.type !== OBSERVATION_TYPE || receipt.restoreClass !== RESTORE_CLASS) throw new TypeError("receipt is not a bounded repository restore observation");
  if (receipt.available !== true || receipt.fresh !== true || receipt.temporaryRepositoryRemoved !== true) {
    throw new TypeError("receipt does not record a successful fresh bounded restore with temporary cleanup");
  }
  if (!/^[0-9a-f]{40,64}$/u.test(receipt.source?.commit ?? "")) throw new TypeError("receipt source commit is invalid");
  if (!Array.isArray(receipt.requiredPaths) || receipt.requiredPaths.length === 0 || !Array.isArray(receipt.restoredMaterial)) {
    throw new TypeError("receipt has no selected restored material");
  }
  const restored = new Set(receipt.restoredMaterial.map((material) => material?.path));
  if (receipt.requiredPaths.some((file) => !restored.has(file))) throw new TypeError("receipt omits required restored material");
  const observedTime = Date.parse(observedAt);
  const recordedTime = Date.parse(receipt.recordedAt);
  if (!Number.isFinite(observedTime) || !Number.isFinite(recordedTime)) throw new TypeError("receipt and observation timestamps must be valid ISO timestamps");
  const ageMilliseconds = observedTime - recordedTime;
  if (ageMilliseconds < -5 * 60 * 1000) throw new TypeError("restore receipt is dated in the future");
  const available = ageMilliseconds <= maximumAgeMilliseconds;
  return Object.freeze({
    available,
    summary: available
      ? receipt.summary
      : `The last bounded Git restore receipt is stale at ${Math.floor(ageMilliseconds / (24 * 60 * 60 * 1000))} days old; rerun the fresh restore assay.`,
    evidence: Object.freeze([
      `restore-class:${receipt.restoreClass}`,
      `remote-ref:${receipt.source.remoteUrl}#${receipt.source.ref}`,
      `remote-commit:${receipt.source.commit}`,
      `receipt-recorded-at:${receipt.recordedAt}`,
      ...receipt.requiredPaths.map((file) => `restored-path:${file}`),
      ...receipt.doesNotProve.map((boundary) => `not-proven:${boundary}`),
    ]),
    receipt,
    ageMilliseconds,
    maximumAgeMilliseconds,
  });
}

/** Admit the restore receipt stored at an absolute path, its file first among the evidence. */
export function observeRestoreReceiptFile(file, options = {}) {
  if (typeof file !== "string" || !path.isAbsolute(file)) throw new TypeError("restore receipt path must be absolute");
  const observation = restoreAvailabilityFromReceipt(JSON.parse(readFileSync(file, "utf8")), options);
  return Object.freeze({ ...observation, evidence: Object.freeze([`file:${file}`, ...observation.evidence]) });
}
