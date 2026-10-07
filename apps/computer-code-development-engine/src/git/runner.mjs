/**
 * @packageDocumentation
 *
 * The code-development engine's one Git runner: it executes a plan from git-services-section's
 * codec in a repository, records each command in the caller's log, waits out a held index.lock
 * or ref lock for a bounded time, and throws when git exits with a status the plan does not accept.
 */
import { executeJavascriptNodeCommand } from "@red-cup-engineering/execute-javascript-node-command-service";

import { stepRequest } from "../workspace/worktree.mjs";

const LOCK_RETRY_MILLISECONDS = 5_000;
const LOCAL_COMMAND_MILLISECONDS = 60_000;
// A transfer to or from a remote is slow on a loaded node, not broken: fetching main can take
// minutes. It gets a long outer bound; over HTTP, git itself aborts a transfer that moves under a
// kilobyte a second for a minute, and over SSH the connection's own keepalives decide.
const REMOTE_COMMAND_MILLISECONDS = 600_000;
const REMOTE_SUBCOMMANDS = new Set(["fetch", "push", "pull", "ls-remote", "clone"]);
const STALLED_TRANSFER = Object.freeze({ GIT_HTTP_LOW_SPEED_LIMIT: "1000", GIT_HTTP_LOW_SPEED_TIME: "60" });
const LOCK_POLL_MILLISECONDS = 100;
const lockWaitBuffer = new Int32Array(new SharedArrayBuffer(4));

// Another process holding the index or a ref lock is contention, not failure: the runner waits it
// out for a bounded time and runs the step again. A remote transfer whose tracking ref moved under
// it (a concurrent fetch of origin/main) is contention too, since the rerun reads the ref afresh;
// a ref that moved under a step naming its expected value (update-ref's compare-and-swap) is not.
function lockContention(result, remote) {
  if (result.status === 0) return false;
  const diagnostic = `${result.stderr}\n${result.stdout}\n${result.error ?? ""}`;
  return /index\.lock|\.lock'?: File exists/iu.test(diagnostic) || (remote && /cannot lock ref/iu.test(diagnostic));
}

function waitForLock() {
  Atomics.wait(lockWaitBuffer, 0, 0, LOCK_POLL_MILLISECONDS);
}

function gitSubcommand(args) {
  for (let at = 0; at < args.length; at += 1) {
    if (args[at] === "-c" || args[at] === "-C") at += 1;
    else if (!args[at].startsWith("-")) return args[at];
  }
  return undefined;
}

export function executeGitPlan(root, plan, commands) {
  let retryUntil;
  const remote = REMOTE_SUBCOMMANDS.has(gitSubcommand(plan.arguments));
  const step = remote ? { ...plan, environment: { ...STALLED_TRANSFER, ...plan.environment } } : plan;
  const timeoutMilliseconds = remote ? REMOTE_COMMAND_MILLISECONDS : LOCAL_COMMAND_MILLISECONDS;
  while (true) {
    const receipt = executeJavascriptNodeCommand(stepRequest(step, root), { timeoutMilliseconds });
    const result = receipt.result;
    commands.push(Object.freeze({
      command: `git ${plan.arguments.join(" ")}`,
      status: result.status,
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim(),
    }));
    if (lockContention(result, remote)) {
      retryUntil ??= Date.now() + LOCK_RETRY_MILLISECONDS;
      if (Date.now() < retryUntil) {
        waitForLock();
        continue;
      }
      throw new Error(`git ${plan.arguments.join(" ")} failed after waiting for a lock: ${(result.stderr || result.stdout || result.error).trim()}`);
    }
    if (!plan.ok.includes(result.status)) {
      throw new Error(`git ${plan.arguments.join(" ")} failed: ${(result.stderr || result.stdout || result.error).trim()}`);
    }
    return Object.freeze({ status: result.status, stdout: result.stdout, stderr: result.stderr });
  }
}
