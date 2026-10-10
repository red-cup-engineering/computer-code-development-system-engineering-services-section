/**
 * Relocating tracked directories of the house repository. A move runs in a linked worktree, never in
 * the shared checkout: every tracked file under `from` moves to `to`, merged into `to` when it
 * already exists and no entry collides. A batch of moves lands as one transaction on origin/main,
 * joined by branch integration, which refreshes the shared checkout only where no other writer has
 * an edit. The file moves themselves are the filepath section's.
 */
import { mergeDirectoryContents } from "@red-cup-engineering/computer-filepath-engineering-services-section/merge-directory-contents";
import { relocateDirectory } from "@red-cup-engineering/computer-filepath-engineering-services-section/relocate-directory";
import { statPath } from "@red-cup-engineering/computer-file-engineering-services-section/stat-path";
import { gitWorktreePlan, splitNullOutput } from "@red-cup-engineering/git-services-section/git-command-codec";
import { executeJavascriptNodeCommandAsynchronously } from "@red-cup-engineering/execute-javascript-node-command-service/asynchronously";

import { integrateGitBranch } from "../git/operations.mjs";
import { runStep, transactWorktree } from "./worktree.mjs";

const literal = (value) => typeof value === "string" && value !== "" && value !== "." && !value.startsWith("/") && !value.startsWith("./") && !value.split("/").includes("..");

/** Admit a batch of { from, to } moves between literal repository-relative directories. */
export function readDirectoryMoves(moves) {
  if (!Array.isArray(moves) || moves.length === 0) throw new TypeError("moves is required and must be a non-empty array");
  return Object.freeze(moves.map((move) => {
    if (!literal(move?.from) || !literal(move?.to)) throw new TypeError("each move needs a literal repository-relative from and to");
    if (move.from === move.to) throw new TypeError(`from and to must differ: ${move.from}`);
    return Object.freeze({ from: move.from, to: move.to });
  }));
}

const git = async (runner, step, cwd) => (await runStep(runner, step, cwd)).stdout;

/** Move one tracked directory inside the linked worktree `workspace`. Refuses the shared checkout
 *  before touching a file, a `from` with no tracked files, and a `to` that collides. */
export async function relocateTrackedDirectory({ workspace, from, to, dryRun = false, runner = executeJavascriptNodeCommandAsynchronously }) {
  const [move] = readDirectoryMoves([{ from, to }]);
  if ((await git(runner, gitWorktreePlan.gitDirectory(), workspace)).trim() === (await git(runner, gitWorktreePlan.commonDirectory(), workspace)).trim()) {
    throw new Error("directory relocation requires a linked Git worktree, never the shared checkout");
  }
  if ((await statPath({ path: `${workspace}/${move.from}` })).kind !== "directory") throw new Error(`directory relocation: source is not a directory: ${move.from}`);
  const trackedFiles = splitNullOutput(await git(runner, gitWorktreePlan.trackedFiles(move.from), workspace));
  if (trackedFiles.length === 0) throw new Error(`directory relocation: no Git-tracked files under ${move.from}`);
  const destination = await statPath({ path: `${workspace}/${move.to}` });
  const source = `${workspace}/${move.from}`;
  const target = `${workspace}/${move.to}`;
  if (!destination.exists) return Object.freeze({ ...move, trackedFiles, outcome: await relocateDirectory({ source, destination: target, apply: !dryRun }) });
  if (destination.kind !== "directory") throw new Error(`directory relocation: destination exists and is not a directory: ${move.to}`);
  const outcome = await mergeDirectoryContents({ source, destination: target, apply: !dryRun });
  if (outcome.type === "DirectoryContentsMergeRefusal") throw new Error(`directory relocation: refused merging ${move.from} into ${move.to} (${outcome.reason}): ${(outcome.collisions ?? []).map((entry) => entry.relativePath).join(", ")}`);
  if (outcome.type === "DirectoryContentsMergePartialFailure") throw Object.assign(new Error(`directory relocation: partial failure merging ${move.from} into ${move.to} (${outcome.reason}): ${outcome.error ?? JSON.stringify(outcome.verification)}`), { partial: true });
  return Object.freeze({ ...move, trackedFiles, outcome });
}

/** Apply `moves` in one ephemeral worktree and land them on origin/main as one commit. A move refused
 *  before touching a file is recorded and the rest proceed; a move that fails partway abandons the
 *  whole transaction. A dry run plans every move and commits nothing. */
export async function transactDirectoryRelocations({ repository, moves, message, dryRun = false, land = ({ repository: root, branch, sourceBase, message: text }) => integrateGitBranch({ packageRoot: root }, { branch, sourceBase, message: text }), environment = process.env, runner = executeJavascriptNodeCommandAsynchronously }) {
  const admitted = readDirectoryMoves(moves);
  if (typeof message !== "string" || message.trim() === "") throw new TypeError("message is required");
  const accepted = [];
  const refused = [];
  const result = await transactWorktree({
    repository, message: message.trim(), land, environment, runner,
    effect: async (workspace) => {
      for (const move of admitted) {
        try {
          accepted.push(Object.freeze({ ...move, outcome: (await relocateTrackedDirectory({ workspace, ...move, dryRun, runner })).outcome }));
        } catch (error) {
          if (error?.partial === true) throw error;
          refused.push(Object.freeze({ ...move, reason: error instanceof Error ? error.message : String(error) }));
        }
      }
    },
  });
  const { outcome: _outcome, ...transaction } = result;
  const reason = result.committed ? {} : { reason: dryRun ? "dry-run" : accepted.length === 0 ? "no-accepted-moves" : "nothing-changed" };
  return Object.freeze({ ...transaction, ...reason, accepted: Object.freeze(accepted), refused: Object.freeze(refused) });
}
