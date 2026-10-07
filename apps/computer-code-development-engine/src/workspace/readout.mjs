
import path from "node:path";
import { readSelectedSource } from "./source-worker.mjs";
import { createWorkspaceSourceResource } from "./source-resource.mjs";
import { workspaceSourceRequestSchema } from "./source-request.mjs";

import { operation } from "@red-cup-engineering/computer-system-engine/rpc/operation";
import { artifactId } from "@red-cup-engineering/semiotic-eavt-services-section/identity";
import { schemaFrom } from "@red-cup-engineering/json-schema-services-section/contracts";
import { DUTY_LOCUS } from "@red-cup-engineering/feltos/work/provider-delegation-authority";
import { dutyWorktreeAbsence, workspaceRootOf } from "./duty-worktree.mjs";


const MAX_WORKSPACE_REPLACEMENT_BYTES = 256 * 1024;

function inputRecord(input) {
  return input !== null && typeof input === "object" && !Array.isArray(input) ? input : {};
}


export const workspaceFileReplaceRequestSchema = {
  $id: "metroplat/filesystem/workspace-file-replace/request",
  type: "object",
  required: ["path"],
  oneOf: [
    { required: ["content"], not: { required: ["edits"] } },
    { required: ["expected", "edits"], not: { required: ["content"] } },
  ],
  additionalProperties: false,
  properties: {
    [DUTY_LOCUS]: { type: "string", minLength: 1, maxLength: 512 },
    scope: { enum: ["repository", "package"] },
    path: { type: "string", minLength: 1 },
    expected: { type: "string", minLength: 1 },
    content: { type: "string" },
    edits: {
      type: "array", minItems: 1, maxItems: 64,
      items: {
        type: "object", required: ["before", "after"], additionalProperties: false,
        properties: { before: { type: "string", minLength: 1, maxLength: MAX_WORKSPACE_REPLACEMENT_BYTES }, after: { type: "string", maxLength: MAX_WORKSPACE_REPLACEMENT_BYTES } },
      },
    },
  },
};

export const workspaceFileReplaceRequestContract = schemaFrom(workspaceFileReplaceRequestSchema);

export const workspaceFileReplaceResultSchema = {
  $id: "metroplat/filesystem/workspace-file-replace/result",
  oneOf: [
    {
      type: "object",
      required: ["kind", "path", "after", "changed", "evidence"],
      additionalProperties: false,
      properties: {
        kind: { const: "metroplat.filesystem.workspace-file-replace:witness" },
        path: { type: "string", minLength: 1 },
        before: { type: "string", minLength: 1 },
        after: { type: "string", minLength: 1 },
        changed: { type: "boolean" },
        evidence: { type: "array", items: { type: "string", minLength: 1 } },
      },
    },
    {
      type: "object",
      required: ["kind", "path", "reason", "message", "evidence"],
      additionalProperties: false,
      properties: {
        kind: { const: "metroplat.filesystem.workspace-file-replace:obstruction" },
        path: { type: "string", minLength: 1 },
        reason: { enum: ["package-root-unavailable", "repository-root-unavailable", "worktree-absent", "outside-package", "not-file", "non-text", "source-too-large", "replacement-too-large", "stale-source", "edit-not-unique", "write-failed"] },
        message: { type: "string", minLength: 1 },
        actual: { type: "string", minLength: 1 },
        evidence: { type: "array", items: { type: "string", minLength: 1 } },
      },
    },
  ],
};

export const workspaceFileReplaceResultContract = schemaFrom(workspaceFileReplaceResultSchema);


function resolveWithin(root, requested) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.isAbsolute(requested) ? path.resolve(requested) : path.resolve(resolvedRoot, requested);
  const relative = path.relative(resolvedRoot, resolved);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) return resolved;
  return undefined;
}

function workspaceRelative(root, filePath) {
  return path.relative(path.resolve(root), filePath).split(path.sep).join("/");
}

function looksTextual(filePath, options) {
  const head = options.readFileHeadUtf8(filePath, 4096);
  return !head.includes("\u0000");
}

function fileReplaceObstruction(
  requestedPath,
  reason,
  message,
  actual,
) {
  return Object.freeze({
    kind: "metroplat.filesystem.workspace-file-replace:obstruction",
    path: requestedPath,
    reason,
    message,
    ...(actual === undefined ? {} : { actual }),
    evidence: Object.freeze(["boundary:filesystem", "operation:atomic-content-addressed-replace"]),
  });
}

/** Create one new file under the root where none is: the nearest directory above the target that
 *  exists must resolve under the root, so no symbolic link leads the write out of it. */
function createWorkspaceFile(root, requested, request, options) {
  if (root === null || requested === undefined) {
    return fileReplaceObstruction(request.path, "not-file", "workspace creation targets one new file under the root");
  }
  let ancestor = path.dirname(requested);
  while (options.realPathOrNull(ancestor) === null) ancestor = path.dirname(ancestor);
  const target = path.join(options.realPathOrNull(ancestor), path.relative(ancestor, requested));
  const relative = path.relative(root, target);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    return fileReplaceObstruction(request.path, "outside-package", "resolved target is outside the root");
  }
  if (relative.split(path.sep).includes(".git")) return fileReplaceObstruction(request.path, "outside-package", "Git's own files are not workspace files");
  const after = artifactId(request.content);
  try {
    options.writeFileAtomicNew(target, request.content);
  } catch (error) {
    if (error?.code === "EEXIST") return fileReplaceObstruction(request.path, "stale-source", "a file already exists at the path; replace it at its expected address");
    return fileReplaceObstruction(request.path, "write-failed", error instanceof Error ? error.message : String(error));
  }
  return Object.freeze({
    kind: "metroplat.filesystem.workspace-file-replace:witness",
    path: relative.split(path.sep).join("/"),
    after,
    changed: true,
    evidence: Object.freeze(["boundary:filesystem", "operation:atomic-exclusive-create", `after:${after}`]),
  });
}

/** Replace one existing file under the root iff its exact current content address is still the
 * caller's expected address; with no expected address, create the file where none is. The
 * resolved real path must stay under the resolved root, making symlink traversal an obstruction. */
export function replaceWorkspaceFile(
  packageRoot,
  request,
  options,
) {
  if (packageRoot === undefined) {
    return fileReplaceObstruction(request.path, "package-root-unavailable", "workspace replacement requires a bound packageRoot");
  }
  if (request.content !== undefined && Buffer.byteLength(request.content, "utf8") > MAX_WORKSPACE_REPLACEMENT_BYTES) {
    return fileReplaceObstruction(request.path, "replacement-too-large", `replacement exceeds ${MAX_WORKSPACE_REPLACEMENT_BYTES} UTF-8 bytes`);
  }
  const root = options.realPathOrNull(packageRoot);
  const requested = path.isAbsolute(request.path) ? undefined : path.resolve(packageRoot, request.path);
  if (request.expected === undefined) return createWorkspaceFile(root, requested, request, options);
  const absolute = requested === undefined ? null : options.realPathOrNull(requested);
  if (root === null || absolute === null) {
    return fileReplaceObstruction(request.path, "not-file", "workspace replacement targets one existing package file");
  }
  const relative = path.relative(root, absolute);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    return fileReplaceObstruction(request.path, "outside-package", "resolved target is outside packageRoot");
  }
  if (relative.split(path.sep).includes(".git")) return fileReplaceObstruction(request.path, "outside-package", "Git's own files are not workspace files");
  const stat = options.statPathOrNull(absolute);
  if (stat === null || !stat.isFile()) return fileReplaceObstruction(request.path, "not-file", "workspace replacement target is not a file");
  if (stat.size > MAX_WORKSPACE_REPLACEMENT_BYTES) {
    return fileReplaceObstruction(request.path, "source-too-large", `source exceeds ${MAX_WORKSPACE_REPLACEMENT_BYTES} bytes`);
  }
  if (!looksTextual(absolute, options)) return fileReplaceObstruction(request.path, "non-text", "workspace replacement target is not UTF-8 text");
  try {
    const current = options.readFileUtf8(absolute);
    const before = artifactId(current);
    if (before !== request.expected) {
      return fileReplaceObstruction(request.path, "stale-source", "source content no longer matches expected address", before);
    }
    let replacement = request.content ?? current;
    for (const [index, edit] of (request.edits ?? []).entries()) {
      const start = replacement.indexOf(edit.before);
      if (start < 0 || replacement.indexOf(edit.before, start + 1) >= 0) {
        return fileReplaceObstruction(request.path, "edit-not-unique", `edit ${index + 1} must match exactly once; no edits were written`);
      }
      replacement = replacement.slice(0, start) + edit.after + replacement.slice(start + edit.before.length);
      if (Buffer.byteLength(replacement, "utf8") > MAX_WORKSPACE_REPLACEMENT_BYTES) {
        return fileReplaceObstruction(request.path, "replacement-too-large", `replacement exceeds ${MAX_WORKSPACE_REPLACEMENT_BYTES} UTF-8 bytes`);
      }
    }
    const after = artifactId(replacement);
    if (after === before) {
      return Object.freeze({
        kind: "metroplat.filesystem.workspace-file-replace:witness",
        path: relative.split(path.sep).join("/"),
        before,
        after,
        changed: false,
        evidence: Object.freeze(["boundary:filesystem", "operation:atomic-content-addressed-replace", "result:unchanged"]),
      });
    }
    const committed = options.writeFileAtomicIf(absolute, replacement, () => artifactId(options.readFileUtf8(absolute)) === before);
    if (!committed) {
      const actual = artifactId(options.readFileUtf8(absolute));
      return fileReplaceObstruction(request.path, "stale-source", "source changed before atomic replacement", actual);
    }
    return Object.freeze({
      kind: "metroplat.filesystem.workspace-file-replace:witness",
      path: relative.split(path.sep).join("/"),
      before,
      after,
      changed: true,
      evidence: Object.freeze(["boundary:filesystem", "operation:atomic-content-addressed-replace", `before:${before}`, `after:${after}`]),
    });
  } catch (error) {
    return fileReplaceObstruction(request.path, "write-failed", error instanceof Error ? error.message : String(error));
  }
}

/** Finite source algorithms for the owning contained worker. Native calls use
 * workspaceReadOperations and cannot fall back to these filesystem effects. */
export const readWorkspaceFileSlice = (root, options) =>
  readSelectedSource("workspace-file-slice", options, root, artifactId);
export const readWorkspaceTextSearch = (root, options) =>
  readSelectedSource("workspace-text-search", options, root, artifactId);

/** The workspace operations over `binding`'s roots. Each acts in the worktree of the duty its input
 *  names (`locus: "duty"`), else in the root `scope` selects.
 *  Bounded evidence reads are independently installable from workspace mutation. */
export function workspaceReadOperations(binding) {
  const resource = createWorkspaceSourceResource(binding.sourceReadResource);
  return Object.freeze([
    operation({
      verb: "workspace-file-window", locus: DUTY_LOCUS, inputFormat: "json", outputFormat: "json",
      domain: schemaFrom(workspaceSourceRequestSchema("workspace-file-window")),
      summary: "Read a directly sought source window through physical host admission.",
      description: "Domain: { duty?, scope?, path, byteOffset?, byteCount?, expected? }. path is exact and root-relative, never an absolute path; scope selects a held repository, package or data root (default data). The installed host must provide sourceReadResource.context and sourceReadResource.execute. At most 32 KiB is read; expected binds continuation to one revision. No whole-file digest or global line number is invented.",
      run: (input, _arguments, execution) => resource.read("workspace-file-window", input, execution),
    }),
    operation({
      verb: "workspace-file-slice", locus: DUTY_LOCUS, inputFormat: "json", outputFormat: "json",
      domain: schemaFrom(workspaceSourceRequestSchema("workspace-file-slice")),
      summary: "Read lines from one admitted bounded source snapshot.",
      description: "Domain: { duty?, scope?, path?, id?, startLine?, lineCount?, maxFileBytes? }. path or id selects one exact root-relative file in a held root (scope defaults to data). The installed physical host must provide sourceReadResource.context and sourceReadResource.execute. Exact files are at most 256 KiB; larger evidence uses workspace-file-window. No discovery or traversal occurs.",
      run: (input, _arguments, execution) => resource.read("workspace-file-slice", input, execution),
    }),
    operation({
      verb: "workspace-text-search", locus: DUTY_LOCUS, inputFormat: "json", outputFormat: "json",
      domain: schemaFrom(workspaceSourceRequestSchema("workspace-text-search")),
      summary: "Search one exact admitted source snapshot.",
      description: "Domain: { duty?, scope?, query, pathPrefix?, path?, limit?, maxFileBytes? }. pathPrefix or path selects one exact root-relative file, not a directory; scope defaults to data. The installed physical host must provide sourceReadResource.context and sourceReadResource.execute. Snapshots exceed neither the admitted file limit nor 256 KiB. No traversal, ripgrep or per-query index is launched.",
      run: (input, _arguments, execution) => resource.read("workspace-text-search", input, execution),
    }),
  ]);
}

/** The full workspace family retains its existing reads and content-addressed writes. */
export function workspaceReadoutOperations(binding, options = {}) {
  const environment = options.environment ?? process.env;
  return Object.freeze([
    ...workspaceReadOperations(binding, options),
    operation({
      verb: "workspace-file-replace",
      relation: "boundary",
      locus: DUTY_LOCUS,
      inputFormat: "json",
      outputFormat: "json",
      effects: {
        class: "external",
        replay: "idempotency-key",
        coordination: "coordination-free",
        deterministic: "unmeasured",
        totality: "schema-bounded",
      },
      domain: workspaceFileReplaceRequestContract,
      codomain: workspaceFileReplaceResultContract,
      summary: "Replace or deterministically edit one workspace file at an expected content address, or create a new one.",
      description: "Domain: { duty?, scope?, path, expected?, content } or { duty?, scope?, path, expected, edits: [{ before, after }] }. Exact edits run sequentially in memory; each before must match exactly once, including overlapping occurrences. Every edit must succeed before any write. duty writes in that duty's open worktree; else scope repository selects the explicitly bound repositoryRoot, and scope package or absent selects packageRoot. With expected, the real existing target must remain inside the root, be bounded UTF-8 text, and still match expected; without it, the file must not exist yet. Stale, escaping, oversized, or failed writes return typed obstructions.",
      run: (input) => {
        const root = input[DUTY_LOCUS] !== undefined
          ? workspaceRootOf(binding, input, environment)
          : input.scope === "repository" ? binding.repositoryRoot : binding.packageRoot;
        if (root === undefined && input[DUTY_LOCUS] !== undefined) {
          return fileReplaceObstruction(input.path, "worktree-absent", "the duty's worktree is not open; open it first");
        }
        if (root === undefined && input.scope === "repository") {
          return fileReplaceObstruction(input.path, "repository-root-unavailable", "repository scope requires an explicitly bound repositoryRoot");
        }
        const { [DUTY_LOCUS]: _duty, scope: _scope, ...request } = input;
        return replaceWorkspaceFile(root, request, binding);
      },
    }),
  ]);
}
