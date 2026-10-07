/**
 * @packageDocumentation
 *
 * The code-development engine's streaming reads of repository history: revisions a pathspec
 * names across refs, the ref tips a later pass excludes, and one long-lived `cat-file --batch`
 * process reading object bodies. Arguments and output decoding are the git codec's; this module
 * owns the processes, so memory stays bounded by one log line or one pending body.
 */
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

import { gitHistoryPlan, readRawChange, takeBatchRecord } from "@red-cup-engineering/git-services-section/git-command-codec";

function spawnInRepository(repository, plan, stdio) {
  return spawn(plan.command, ["-C", repository, ...plan.arguments], { stdio, env: { ...process.env, ...plan.environment } });
}

/**
 * Every revision of the files a pathspec names, across the refs of one repository, in one
 * streaming pass over `git log --raw`: each added, modified or deleted blob with its path, the
 * commit that made the change and when. `exclude` tips skip history an earlier pass has read.
 */
export async function* gitRevisions(repository, request = {}) {
  const child = spawnInRepository(repository, gitHistoryPlan.revisions(request), ["ignore", "pipe", "pipe"]);
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const exited = new Promise((resolve) => child.on("close", resolve));
  let commit, at;
  try {
    for await (const line of createInterface({ input: child.stdout, crlfDelay: Infinity })) {
      if (line.startsWith("@")) { [commit, at] = line.slice(1).split(" "); continue; }
      const change = readRawChange(line);
      if (change === undefined) continue;
      const deleted = change.status === "D";
      yield Object.freeze({ blob: deleted ? change.before : change.after, path: change.path, commit, at, deleted });
    }
  } finally {
    if (child.exitCode === null) child.kill();
  }
  const code = await exited;
  if (code !== 0 && code !== null) throw new Error(`git log exited ${code}: ${stderr.trim()}`);
}

/** The tips of every ref in a repository: what a later pass passes as `exclude`. */
export async function gitRefTips(repository) {
  const child = spawnInRepository(repository, gitHistoryPlan.refTips(), ["ignore", "pipe", "inherit"]);
  const tips = new Set();
  for await (const line of createInterface({ input: child.stdout, crlfDelay: Infinity })) if (line) tips.add(line);
  return [...tips];
}

/**
 * One `git cat-file --batch` process reading object bodies by id, in request order. `read`
 * resolves to the bytes, or undefined for an id the repository lacks.
 */
export function gitBlobReader(repository) {
  const child = spawnInRepository(repository, gitHistoryPlan.blobStream(), ["pipe", "pipe", "inherit"]);
  const waiting = [];
  let buffer = Buffer.alloc(0);
  const fail = (error) => { for (const entry of waiting.splice(0)) entry.reject(error); child.kill(); };
  child.stdout.on("data", (chunk) => {
    buffer = buffer.length === 0 ? chunk : Buffer.concat([buffer, chunk]);
    while (waiting.length > 0) {
      let record;
      try { record = takeBatchRecord(buffer); } catch (error) { fail(error); return; }
      if (record === undefined) return;
      buffer = record.rest;
      waiting.shift().resolve(record.body === undefined ? undefined : Buffer.from(record.body));
    }
  });
  child.on("close", () => { for (const entry of waiting.splice(0)) entry.reject(new Error("git cat-file closed")); });
  return Object.freeze({
    read: (blob) => new Promise((resolve, reject) => { waiting.push({ resolve, reject }); child.stdin.write(`${blob}\n`); }),
    close: () => new Promise((resolve) => { child.on("close", resolve); child.stdin.end(); }),
  });
}
