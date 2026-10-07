/**
 * @packageDocumentation
 * The Monitor half of the checkout-health MAPE-K loop: composes the
 * deterministic checkers (data-custody trio, exact-pin manifests, lockfile
 * registry, builtin-imports audit, the youtube-channel-repository-form
 * gate over the five channel repositories, systemd failed units,
 * checkout-bound units) as exact-pinned dependencies, plus metroplat's own
 * `evaluateSourceCodePolicies` import-stratification rulings, into one
 * bounded checkout-health read.
 * @metroplatSubject monitoring
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { basename, dirname, join, sep } from "node:path";
import { auditNodeBuiltinImports } from "@red-cup-engineering/javascript-node-services-section/audit-node-builtin-imports";
import { checkDataCustodyDirectory } from "@red-cup-engineering/data-custody-directory-service/check-data-custody-directory";
import { dependencySpecificationViolations } from "@red-cup-engineering/npm-workspace-publication-service/dependency-policy";
import { observeUnitInventory } from "@red-cup-engineering/systemd-unit-inventory-observation-service";
import { observeSetOfCheckoutBoundUnits } from "@red-cup-engineering/systemd-unit-inventory-observation-service/checkout-bound-units";
import { checkHandRegisteredOperations } from "@red-cup-engineering/computer-code-development-engine/check-hand-registered-operations";
import { executeJavascriptNodeCommand } from "@red-cup-engineering/execute-javascript-node-command-service";
import { gitRepositoryObservationPlan, readPorcelainStatus } from "@red-cup-engineering/git-services-section/git-command-codec";
import { stepRequest } from "../../workspace/worktree.mjs";
import { walkPosixPathsSync } from "@red-cup-engineering/computer-filepath-engineering-services-section/walk-posix-paths";
import { readModuleTopology } from "../source-code/topology/service.mjs";
import { evaluateSourceCodePolicies } from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/policy";
import { pathExists, readFileUtf8, walkFiles } from "@red-cup-engineering/computer-system-engine/filesystem";
import {
  checkoutHealthReadContract,

} from "@red-cup-engineering/computer-code-development-engine/monitoring/checkout-health/schema";

// ---- the YouTube channel repository form ----
// A channel is data the one production program (public education's
// youtube-production) reads, never a fork of it (2026-09-05 ruling): its own
// repository holds the channel's configuration, publication history,
// production state and artifacts, and no code or package of its own.
const ADMITTED_ROOT_FILES = new Set(["README.md", ".gitignore", "LICENSE", "config.json", "history.json"]);
const ADMITTED_PREFIXES = ["history/", "production/", "artifacts/"];
const VENDORED_DIRECTORY_NAMES = ["vendor", "packages", "lib"];
const PIPELINE_DIRECTORY_NAMES = ["src", "scripts"];
const PACKAGE_FILES = ["package.json", "package-lock.json", "Dockerfile"];

function isAdmittedEntry(entry) {
  return ADMITTED_ROOT_FILES.has(entry) || ADMITTED_PREFIXES.some((prefix) => entry.startsWith(prefix));
}

function pipelineCopyViolations(entries) {
  return entries
    .filter((entry) => !entry.endsWith("/") && PIPELINE_DIRECTORY_NAMES.some((dir) => entry.startsWith(`${dir}/`)))
    .map((entry) => ({ rule: "pipeline-copy", path: entry, message: `${entry} is pipeline source; a channel's behaviour is its config, not its own code` }));
}

function vendoredCodeViolations(entries) {
  return VENDORED_DIRECTORY_NAMES
    .map((name) => `${name}/`)
    .filter((marker) => entries.some((entry) => entry === marker || entry.startsWith(marker)))
    .map((marker) => ({ rule: "vendored-code", path: marker, message: `${marker} is vendored code; the production program reads the channel, the channel carries no code` }));
}

function packageViolations(entries) {
  return PACKAGE_FILES
    .filter((file) => entries.includes(file))
    .map((file) => ({ rule: "channel-package", path: file, message: `${file} makes the channel a package; a channel is data the production program reads` }));
}

function missingSpecViolation(entries) {
  if (entries.includes("config.json")) return null;
  return { rule: "missing-spec", path: "config.json", message: "config.json is absent; a channel's behaviour is the configuration the production program validates" };
}

/**
 * Checks one already-listed YouTube channel repository against the admitted form: a channel is data the production program reads and carries no pipeline copy, vendored code or package of its own.
 * @param {object} request A record with `path` (repository root, repo-relative) and `entries` (relative paths under it, directories carrying a trailing "/", with `node_modules/` and `.git/` already excluded by the caller).
 * @returns {object} A YoutubeChannelRepositoryForm record: `type`, `version: 2`, `path`, `conformant` (boolean), `violations` (array of `{rule, path, message}`), `allowed` (the entries admitted).
 * @throws {TypeError} When `path` is not a non-empty string or `entries` is not an array of strings.
 */
export function checkYoutubeChannelRepositoryForm(request) {
  const path = request?.path;
  if (typeof path !== "string" || path.length === 0) throw new TypeError("path must be a non-empty string");
  const entries = request?.entries;
  if (!Array.isArray(entries) || !entries.every((entry) => typeof entry === "string")) {
    throw new TypeError("entries must be an array of strings");
  }
  const violations = [...pipelineCopyViolations(entries), ...vendoredCodeViolations(entries), ...packageViolations(entries)];
  const missingSpec = missingSpecViolation(entries);
  if (missingSpec !== null) violations.push(missingSpec);
  return {
    type: "YoutubeChannelRepositoryForm",
    version: 2,
    path,
    conformant: violations.length === 0,
    violations,
    allowed: entries.filter(isAdmittedEntry),
  };
}

const HOUSE_SCOPES = Object.freeze([
  "@561-group",
  "@red-cup-engineering",
  "@lenticule-science",
  "@emsenn",
  "@causeway-services",
  "@coesite-operations",
]);
const CANONICAL_REGISTRY = "https://registry.561.group/";
/**
 * The YouTube channel repositories, one per channel, each a submodule at its
 * channel directory under public education (2026-09-30), repo-relative to the
 * checkout root -- the `youtube-channel-repository-form` checker's fixed scan
 * targets, mirroring `HOUSE_SCOPES`'s shape.
 */
const EDUCATION = "lib/emsenn/services/561-group/services/public-services-section/services/public-social-services-section/services/public-education-services-section";
const YOUTUBE_CHANNEL_REPOSITORY_ROOTS = Object.freeze([
  `${EDUCATION}/channels/emsenn0`,
  `${EDUCATION}/services/public-business-education-services-section/channels/modern-business-practices`,
  `${EDUCATION}/services/public-computer-education-services-section/services/artificial-intelligence-education-services-section/services/artificial-intelligence-curriculum-enterprise/channels/machine-learning-history-frontier`,
  `${EDUCATION}/services/public-health-education-services-section/services/health-education-curriculum-services-section/channels/pace-yourself`,
  `${EDUCATION}/services/public-mathematics-education-services-section/channels/mathematics-in-relation`,
  `${EDUCATION}/services/public-science-education-services-section/services/engineering-science-education-services-section/services/ecological-science-education-services-section/services/climate-science-education-services-section/channels/climate-place-by-place`,
]);
/**
 * Repository-relative paths for metroplat's own infograph catalog and this
 * package's hand-registered-operations baseline record -- the `hand-
 * registered-operations` checker's fixed self-check targets, mirroring
 * `YOUTUBE_CHANNEL_REPOSITORY_ROOTS`'s shape.
 */
const METROPLAT_CATALOG_REPOSITORY_PATH = "lib/emsenn/services/561-group/services/engineering-services-section/services/computer-engineering-services-section/services/computer-systems-engineering-services-section/services/agent-computer-system-engineering-services-section/services/multi-agent-computer-system-engineering-services-section/services/multi-agent-computer-platform-engineering-services-section/services/agentic-enterprise-computer-platform-engineering-services-section/apps/metroplat/src/apps/infograph/catalog.mts";
const METROPLAT_HAND_REGISTERED_OPERATIONS_BASELINE_PATH = "lib/emsenn/services/561-group/services/engineering-services-section/services/computer-engineering-services-section/services/computer-systems-engineering-services-section/services/agent-computer-system-engineering-services-section/services/multi-agent-computer-system-engineering-services-section/services/multi-agent-computer-platform-engineering-services-section/services/agentic-enterprise-computer-platform-engineering-services-section/apps/metroplat/data/records/2026-09-05-hand-registered-operations-baseline.json";
export const CHECKOUT_HEALTH_BUDGET_MS = 15000;
const CHECKOUT_HEALTH_GIT_TIMEOUT_MS = 5000;
const CHECKOUT_SCAN_SKIP_DIRS = new Set(["node_modules", ".git"]);
const CUSTODY_SCAN_MARKER = "__custody-scan__";
const CHECKOUT_SOURCE_FILE_PATTERN = /\.(?:mjs|mts)$/u;
const CHECKOUT_SOURCE_DIR_NAMES = new Set(["scripts", "apps", "src"]);
const CHECKOUT_SOURCE_EXCLUDED_DIR_NAMES = new Set(["test", "dist", "node_modules", "legacy"]);

/**
 * True when `path` is a `.mjs`/`.mts` file (never `.d.mts`) under a
 * `scripts/`, `apps/`, or `src/` directory and not under `test/`, `dist/`,
 * `node_modules/`, or `lib/legacy/` -- the builtin-imports checker's scope.
 * @param {string} path
 * @returns {boolean}
 */
export function isCheckoutSourceFile(path) {
  if (path.endsWith(".d.mts")) return false;
  if (!CHECKOUT_SOURCE_FILE_PATTERN.test(path)) return false;
  const segments = path.split(sep);
  if (segments.some((segment) => CHECKOUT_SOURCE_EXCLUDED_DIR_NAMES.has(segment))) return false;
  return segments.some((segment) => CHECKOUT_SOURCE_DIR_NAMES.has(segment));
}

/**
 * Lists the git worktree's changed tracked paths (working tree + index),
 * absolute, from the git codec's porcelain status of tracked files; a rename
 * names its destination. Never throws: a clean tree returns `[]`; any git
 * failure (not a repo, index lock held by a concurrent session, timeout)
 * returns `null` so the caller reports `truncated: true` rather than the
 * misleading "no changed paths".
 * @param {{root: string, execute?: typeof executeJavascriptNodeCommand, timeoutMs?: number}} options
 * @returns {readonly string[]|null}
 */
export function changedPathsFromGitStatus({
  root,
  execute = executeJavascriptNodeCommand,
  timeoutMs = CHECKOUT_HEALTH_GIT_TIMEOUT_MS,
}) {
  try {
    const step = gitRepositoryObservationPlan.status({ untracked: "no" });
    const { result } = execute(stepRequest(step, root), { timeoutMilliseconds: timeoutMs });
    if (!step.ok.includes(result.status)) return null;
    return Object.freeze(readPorcelainStatus(result.stdout).map((entry) => join(root, entry.path)));
  } catch {
    return null;
  }
}

/**
 * Lists every `package.json`, every `package-lock.json`, every
 * `scripts/`/`src/` `.mjs`/`.mts` source file ({@link isCheckoutSourceFile}),
 * and one synthetic marker path per `data/` directory under `root` -- the
 * whole-checkout counterpart to {@link changedPathsFromGitStatus} for a run
 * that must see every manifest, source file, and data-custody root
 * regardless of git status.
 * @param {{root: string, readdirFn?: typeof readdirSync}} options
 * @returns {readonly string[]}
 */
export function checkoutScanPaths({
  root,
  readdirFn = readdirSync,
}) {
  const paths = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    let entries;
    try {
      entries = readdirFn(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (CHECKOUT_SCAN_SKIP_DIRS.has(entry.name)) continue;
        const childDir = join(dir, entry.name);
        if (entry.name === "data") paths.push(join(childDir, CUSTODY_SCAN_MARKER));
        stack.push(childDir);
      } else if (entry.name === "package.json" || entry.name === "package-lock.json") {
        paths.push(join(dir, entry.name));
      } else {
        const filePath = join(dir, entry.name);
        if (isCheckoutSourceFile(filePath)) paths.push(filePath);
      }
    }
  }
  return Object.freeze(paths);
}

/**
 * The publish-gate's own documented check: every house-scoped `resolved`
 * URL in a lockfile must be the canonical registry. A third-party
 * dependency resolving to `registry.npmjs.org` is normal.
 * @param {string} lockfileText
 * @returns {readonly {location: string, name: string, resolved: string, reason: string}[]}
 */
export function houseScopedLockfileRegistryViolations(
  lockfileText,
) {
  let parsed;
  try {
    parsed = JSON.parse(lockfileText);
  } catch {
    return Object.freeze([Object.freeze({ location: "", name: "", resolved: "", reason: "package-lock.json is not valid JSON" })]);
  }
  const record = parsed;
  const packages = record?.["packages"];
  if (packages === undefined || packages === null || typeof packages !== "object") return Object.freeze([]);
  const violations = [];
  for (const [location, entry] of Object.entries(packages)) {
    const entryRecord = entry;
    if (!entryRecord || typeof entryRecord["resolved"] !== "string") continue;
    const resolved = entryRecord["resolved"];
    const name = typeof entryRecord["name"] === "string" ? entryRecord["name"] : location.replace(/^.*node_modules\//u, "");
    if (!HOUSE_SCOPES.some((scope) => name.startsWith(`${scope}/`))) continue;
    if (!resolved.startsWith(CANONICAL_REGISTRY)) {
      violations.push(Object.freeze({ location, name, resolved, reason: `house-scoped resolved URL is not ${CANONICAL_REGISTRY}` }));
    }
  }
  return Object.freeze(violations);
}

/** The section root a changed path under `.../data/...` names: everything before that `data` segment. */
function custodyRootFor(absolutePath) {
  const marker = `${sep}data${sep}`;
  const at = absolutePath.indexOf(marker);
  return at === -1 ? null : absolutePath.slice(0, at);
}

/** @returns parsed cache, `{}` on any read/parse failure. */
export function readChecksCache(cachePath) {
  try {
    return JSON.parse(readFileSync(cachePath, "utf8"));
  } catch {
    return {};
  }
}

/** Best-effort write; a cache write failure never blocks a checkout-health read. */
export function writeChecksCache(cachePath, cache) {
  try {
    mkdirSync(dirname(cachePath), { recursive: true });
    writeFileSync(cachePath, JSON.stringify(cache));
  } catch {
    /* the cache is a speed optimization, never a correctness requirement */
  }
}

function cachedFileFindings(
  path,
  cache,
  computeFn,
  statFn,
) {
  let mtimeMs;
  try {
    mtimeMs = statFn(path).mtimeMs;
  } catch {
    return [];
  }
  const hit = cache[path];
  if (hit && hit.mtimeMs === mtimeMs) return hit.findings;
  const findings = computeFn(path);
  cache[path] = Object.freeze({ mtimeMs, findings });
  return findings;
}

/** One package directory's worth of import-stratification findings: local
 * imports whose stratum edge `evaluateSourceCodePolicies` judges `denied`. */
function importStratificationFindingsForPackage(packageDir) {
  const topology = readModuleTopology(packageDir, { pathExists, readFileUtf8, walkFiles });
  const evaluation = evaluateSourceCodePolicies(topology);
  const findings = [];
  for (const ruling of evaluation.rulings) {
    if (ruling.kind !== "metroplat.monitoring.source-code.import-stratification-ruling") continue;
    if (ruling.judgement !== "denied") continue;
    findings.push(Object.freeze({
      check: "import-stratification",
      path: packageDir,
      from: ruling.from,
      to: ruling.to,
      importerStratum: ruling.importerStratum,
      targetStratum: ruling.targetStratum,
    }));
  }
  return Object.freeze(findings);
}

/**
 * Lists one directory's relative entries -- files as their own path,
 * directories with a trailing "/" -- excluding `node_modules/` and
 * `.git/`, exactly the shape `checkYoutubeChannelRepositoryForm`'s
 * `entries` request field requires.
 */
export function channelRepositoryEntries(
  absoluteRoot,
  walkFn = walkPosixPathsSync,
) {
  const entries = [];
  walkFn({
    root: absoluteRoot,
    excludes: ["node_modules", ".git"],
    inspectEntry: (entry) => {
      if (entry.path === "") return;
      entries.push(entry.kind === "directory" ? `${entry.path}/` : entry.path);
    },
  });
  return Object.freeze(entries);
}

/**
 * Runs `checkYoutubeChannelRepositoryForm` over every existing root in
 * {@link YOUTUBE_CHANNEL_REPOSITORY_ROOTS}, one finding per violation row
 * (path joined to the channel root so it names the offending file/dir),
 * unconditionally on every read (not gated by `changedOnly`/git status --
 * several channel roots are git submodules, whose internal file changes
 * do not show as ordinary porcelain lines at the checkout root).
 */
export function youtubeChannelRepositoryFormFindings(
  root,
  options

 = {},
) {
  const { existsFn = existsSync, walkFn = walkPosixPathsSync } = options;
  const findings = [];
  let checked = 0;
  for (const relativeRoot of YOUTUBE_CHANNEL_REPOSITORY_ROOTS) {
    const absoluteRoot = join(root, relativeRoot);
    // A checkout that does not hold the channel submodule has nothing to check.
    if (!existsFn(join(absoluteRoot, ".git"))) continue;
    checked += 1;
    const entries = channelRepositoryEntries(absoluteRoot, walkFn);
    try {
      const record = checkYoutubeChannelRepositoryForm({ path: relativeRoot, entries });
      for (const violation of record.violations) {
        findings.push(Object.freeze({
          check: "youtube-channel-repository-form",
          path: `${relativeRoot}/${violation.path}`,
          rule: violation.rule,
          message: violation.message,
        }));
      }
    } catch (error) {
      findings.push(Object.freeze({
        check: "youtube-channel-repository-form",
        path: relativeRoot,
        rule: "malformed-request",
        message: error instanceof Error ? error.message : String(error),
      }));
    }
  }
  return Object.freeze({ checked, findings: Object.freeze(findings) });
}

/**
 * Runs `checkHandRegisteredOperations` against metroplat's own infograph
 * catalog under `root`, ratcheting its hand-imported-family count against
 * the baseline recorded at this package's own `data/records/2026-09-05-
 * hand-registered-operations-baseline.json`. Async (the composed check
 * reads its subject file through `@red-cup-engineering/file-services`) --
 * callers await this before passing its result into {@link readCheckoutHealth}'s
 * synchronous `handRegisteredOperations` option, since `readCheckoutHealth`
 * itself stays synchronous for its many existing callers. Reports no
 * finding, `{checked: 0, findings: []}`, when `root` is undefined or either
 * file is absent -- an installed-package or non-checkout `root`.
 */
export async function handRegisteredOperationsFindings(
  root,
  options

 = {},
) {
  const { existsFn = existsSync, readFileFn = readFileSync, checkFn = checkHandRegisteredOperations } = options;
  if (root === undefined) return Object.freeze({ checked: 0, findings: Object.freeze([]) });
  const catalogPath = join(root, METROPLAT_CATALOG_REPOSITORY_PATH);
  const baselinePath = join(root, METROPLAT_HAND_REGISTERED_OPERATIONS_BASELINE_PATH);
  if (!existsFn(catalogPath) || !existsFn(baselinePath)) return Object.freeze({ checked: 0, findings: Object.freeze([]) });
  let baseline;
  try {
    baseline = (JSON.parse(readFileFn(baselinePath, "utf8")))["baseline"];
  } catch {
    return Object.freeze({ checked: 0, findings: Object.freeze([]) });
  }
  if (typeof baseline !== "number") return Object.freeze({ checked: 0, findings: Object.freeze([]) });
  let result;
  try {
    result = await checkFn({ catalogPath, baseline });
  } catch {
    return Object.freeze({ checked: 0, findings: Object.freeze([]) });
  }
  if (result.ok) return Object.freeze({ checked: 1, findings: Object.freeze([]) });
  return Object.freeze({
    checked: 1,
    findings: Object.freeze([Object.freeze({
      check: "hand-registered-operations",
      path: catalogPath,
      count: result.count,
      baseline: result.baseline,
      families: Object.freeze([...result.families]),
    })]),
  });
}

/**
 * Runs every wired checker against exactly the given candidate paths,
 * never past `budgetMs` of wall time. Package directories are derived from
 * the candidate `package.json` paths for both the exact-deps and the
 * import-stratification checkers, so the two always agree on which
 * packages were in scope for this run.
 */
function runCheckoutChecks(
  paths,
  options

,
) {
  const { cache, budgetMs, now, statFn, readFileFn } = options;
  const startedAt = now();
  const findings = [];
  const custodyRoots = new Set();
  const packageDirs = new Set();
  let checked = 0;
  let truncated = false;
  for (const path of paths) {
    if (now() - startedAt > budgetMs) { truncated = true; break; }
    const base = basename(path);
    if (base === "package.json") {
      checked += 1;
      packageDirs.add(dirname(path));
      for (const finding of cachedFileFindings(path, cache, (p) => {
        try {
          return dependencySpecificationViolations(JSON.parse(readFileFn(p, "utf8")))
            .map((violation) => Object.freeze({ check: "exact-deps", path, ...violation }));
        } catch (error) {
          return [Object.freeze({ check: "exact-deps", path, field: null, name: null, specification: null, reason: error instanceof Error ? error.message : String(error) })];
        }
      }, statFn)) findings.push(finding);
    } else if (base === "package-lock.json") {
      checked += 1;
      for (const finding of cachedFileFindings(path, cache, (p) => {
        try {
          return houseScopedLockfileRegistryViolations(readFileFn(p, "utf8"))
            .map((violation) => Object.freeze({ check: "lockfile-registry", path, ...violation }));
        } catch (error) {
          return [Object.freeze({ check: "lockfile-registry", path, reason: error instanceof Error ? error.message : String(error) })];
        }
      }, statFn)) findings.push(finding);
    } else if (isCheckoutSourceFile(path)) {
      checked += 1;
      for (const finding of cachedFileFindings(path, cache, (p) => {
        try {
          return auditNodeBuiltinImports({ path: p, text: readFileFn(p, "utf8") }).findings
            .map((builtinFinding) => Object.freeze({
              check: "builtin-imports",
              path,
              line: builtinFinding.line,
              builtin: builtinFinding.builtin,
              houseService: builtinFinding.houseService,
            }));
        } catch {
          return [];
        }
      }, statFn)) findings.push(finding);
    }
    const custodyRoot = custodyRootFor(path);
    if (custodyRoot) custodyRoots.add(custodyRoot);
  }
  if (!truncated) {
    for (const custodyRoot of custodyRoots) {
      if (now() - startedAt > budgetMs) { truncated = true; break; }
      checked += 1;
      try {
        const result = checkDataCustodyDirectory(custodyRoot);
        if (!result.conformant) findings.push(Object.freeze({ check: "data-custody", path: custodyRoot, offenders: result.offenders }));
      } catch (error) {
        findings.push(Object.freeze({ check: "data-custody", path: custodyRoot, reason: error instanceof Error ? error.message : String(error) }));
      }
    }
  }
  if (!truncated) {
    for (const packageDir of packageDirs) {
      if (now() - startedAt > budgetMs) { truncated = true; break; }
      checked += 1;
      try {
        for (const finding of importStratificationFindingsForPackage(packageDir)) findings.push(finding);
      } catch (error) {
        findings.push(Object.freeze({
          check: "import-stratification",
          path: packageDir,
          from: packageDir,
          to: packageDir,
          importerStratum: "unknown",
          targetStratum: error instanceof Error ? error.message : String(error),
        }));
      }
    }
  }
  return Object.freeze({ truncated, checked, findings: Object.freeze(findings) });
}

/** ssh wrapper enforcing the house's batch-mode/connect-timeout discipline for a remote host observation. */
function safeRun(command, args) {
  if (command === "ssh") {
    const [host, ...rest] = args;
    return execFileSync("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=8", host, ...rest], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 15000 });
  }
  return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 15000 });
}

/**
 * Observes `ActiveState=failed` systemd user units across `hosts`, skipping
 * any host that is not reachable.
 */
export function observeFailedUnitsAcrossHosts({
  hosts = ["local"],
  observeFn = observeUnitInventory,
  runFn = safeRun,
}

 = {})

 {
  const failedUnits = [];
  let unitsObserved = 0;
  const hostsReached = [];
  const hostsUnreachable = [];
  for (const host of hosts) {
    let inventory;
    try {
      inventory = observeFn(host, { run: runFn });
    } catch (error) {
      hostsUnreachable.push(Object.freeze({ host, error: error instanceof Error ? error.message : String(error) }));
      continue;
    }
    hostsReached.push(host);
    unitsObserved += inventory.units.length;
    for (const unit of inventory.units) {
      if (unit.active === "failed") {
        failedUnits.push(Object.freeze({
          host,
          unit: unit.unit,
          ...(unit.sub === undefined ? {} : { sub: unit.sub }),
          ...(unit.description === undefined ? {} : { description: unit.description }),
        }));
      }
    }
  }
  return Object.freeze({ failedUnits: Object.freeze(failedUnits), unitsObserved, hostsReached: Object.freeze(hostsReached), hostsUnreachable: Object.freeze(hostsUnreachable) });
}

/**
 * Observes checkout-bound units ("the checkout is not a runtime") for
 * `root` across `hosts`, tolerating an unreachable host the same way
 * {@link observeFailedUnitsAcrossHosts} does.
 */
export function observeCheckoutBoundUnitsAcrossHosts({
  root,
  allow = [],
  hosts = ["local"],
  observeFn = observeSetOfCheckoutBoundUnits,
  runFn = safeRun,
}

)

 {
  const bound

 = [];
  for (const host of hosts) {
    let observation;
    try {
      observation = observeFn(host, { root, allow, run: runFn });
    } catch {
      continue;
    }
    for (const entry of observation.bound) bound.push(Object.freeze({ host, ...entry }));
  }
  return Object.freeze(bound);
}

/**
 * Composes every wired checker into one bounded checkout-health read:
 * the data-custody/exact-deps/lockfile-registry/import-stratification/
 * builtin-imports findings, systemd failed units, and checkout-bound units.
 * @param options root (undefined omits the checkout-scoped checkers
 *   entirely -- there is no implicit repo-root discovery), changedOnly
 *   (defaults false: scan the whole checkout so a periodic run over a
 *   clean git tree still finds committed violations), budgetMs, an
 *   optional mtime cache path (omitted: no caching), the systemd/
 *   checkout-bound-units hosts, and the checkout-bound-units allow list.
 */
export function readCheckoutHealth({
  root,
  changedOnly = false,
  budgetMs = CHECKOUT_HEALTH_BUDGET_MS,
  cachePath,
  hosts = ["local"],
  checkoutBoundUnitsAllow = [],
  now = () => Date.now(),
  gitFn = changedPathsFromGitStatus,
  scanFn = checkoutScanPaths,
  observeFailedUnitsFn = observeFailedUnitsAcrossHosts,
  observeCheckoutBoundUnitsFn = observeCheckoutBoundUnitsAcrossHosts,
  youtubeChannelRepositoryFormFn = youtubeChannelRepositoryFormFindings,
  handRegisteredOperations = Object.freeze({ checked: 0, findings: Object.freeze([]) }),
}

) {
  let checksResult =
    Object.freeze({ truncated: false, checked: 0, findings: Object.freeze([]) });
  if (root !== undefined) {
    const paths = changedOnly ? gitFn({ root }) : scanFn({ root });
    if (paths === null) {
      checksResult = Object.freeze({ truncated: true, checked: 0, findings: Object.freeze([]) });
    } else {
      const cache = cachePath === undefined ? {} : readChecksCache(cachePath);
      checksResult = runCheckoutChecks(paths, { cache, budgetMs, now, statFn: statSync, readFileFn: readFileSync });
      if (cachePath !== undefined) writeChecksCache(cachePath, cache);
    }
  }
  const { failedUnits, unitsObserved, hostsReached, hostsUnreachable } = observeFailedUnitsFn({ hosts });
  const checkoutBoundUnits = root === undefined
    ? Object.freeze([])
    : observeCheckoutBoundUnitsFn({ root, allow: checkoutBoundUnitsAllow, hosts });
  const channelFormResult = root === undefined
    ? Object.freeze({ checked: 0, findings: Object.freeze([]) })
    : youtubeChannelRepositoryFormFn(root);
  const findings = Object.freeze([...checksResult.findings, ...channelFormResult.findings, ...handRegisteredOperations.findings]);
  const violations = findings.length + failedUnits.length + checkoutBoundUnits.filter((entry) => !entry.allowed).length;
  const checked = checksResult.checked + unitsObserved + channelFormResult.checked + handRegisteredOperations.checked;
  return checkoutHealthReadContract.assert(Object.freeze({
    kind: "metroplat.monitoring.checkout-health.read",
    checked,
    violations,
    truncated: checksResult.truncated,
    findings,
    failedUnits,
    unitsObserved,
    hostsReached,
    hostsUnreachable,
    checkoutBoundUnits,
  }), "checkout health read");
}
