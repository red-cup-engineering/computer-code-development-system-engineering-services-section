/**
 * @packageDocumentation
 * The Analyze-to-Plan edge of the checkout-health MAPE-K loop: groups a
 * {@link CheckoutHealthRead}'s findings into structured-work-intent task
 * items, in the exact cell-id scheme the prior harness-resident admitter used
 * (so existing duties dedupe). Pure: callers admit the returned intent through
 * metroplat's own `admitStructuredWorkIntent`. No office, character or model is
 * named here: allocation control derives who takes each task from the house's
 * staffing posterior.
 * @metroplatSubject monitoring
 */
import { basename, dirname, relative } from "node:path";

import { slugify } from "@red-cup-engineering/computer-text-content-engineering-services-section/slugify-text";

/** Deterministic task cell id from a finding kind and subject, e.g. `task:exact-deps-<package-name>`. */
export function taskIdFor(kind, subject) {
  return `task:${slugify(kind)}-${slugify(subject)}`;
}

const SOURCE_CATALOG = Object.freeze({
  "roadmap-chain": Object.freeze({ id: "roadmap-chain", kind: "prior-admission", locator: "the caller's own admitted chain" }),
  "checker:data-custody": Object.freeze({ id: "checker:data-custody", kind: "deterministic-checker", locator: "@red-cup-engineering/data-custody-directory-service/check-data-custody-directory#checkDataCustodyDirectory" }),
  "checker:exact-deps": Object.freeze({ id: "checker:exact-deps", kind: "deterministic-checker", locator: "@red-cup-engineering/npm-workspace-publication-service#dependencySpecificationViolations" }),
  "checker:lockfile-registry": Object.freeze({ id: "checker:lockfile-registry", kind: "deterministic-checker", locator: "metroplat/monitoring/checkout-health/checks.mts#houseScopedLockfileRegistryViolations" }),
  "checker:import-stratification": Object.freeze({ id: "checker:import-stratification", kind: "deterministic-checker", locator: "metroplat/monitoring/source-code/policy.mts#evaluateSourceCodePolicies" }),
  "checker:systemd-unit-inventory": Object.freeze({ id: "checker:systemd-unit-inventory", kind: "deterministic-checker", locator: "@red-cup-engineering/systemd-unit-inventory-observation-service#observeUnitInventory" }),
  "checker:checkout-bound-units": Object.freeze({ id: "checker:checkout-bound-units", kind: "deterministic-checker", locator: "@red-cup-engineering/systemd-unit-inventory-observation-service/checkout-bound-units#observeSetOfCheckoutBoundUnits" }),
});

function subjectDirectoryForFinding(finding) {
  return finding.check === "data-custody" || finding.check === "import-stratification" ? finding.path : dirname(finding.path);
}

function subjectForFinding(finding) {
  return basename(subjectDirectoryForFinding(finding));
}

/** One human-readable evidence line for one checker finding, in the checker's own vocabulary. */
export function formatFindingLine(finding) {
  switch (finding.check) {
    case "exact-deps":
      return `exact-deps: ${finding.field ?? "?"}:${finding.name ?? "?"} (${finding.reason}) at ${finding.path}`;
    case "lockfile-registry":
      return `lockfile-registry: ${finding.name ?? "?"} resolved ${finding.resolved ?? "?"} (${finding.reason}) at ${finding.path}`;
    case "data-custody":
      return finding.offenders
        ? `data-custody: offenders=[${finding.offenders.join(", ")}] at ${finding.path}`
        : `data-custody: ${finding.reason ?? "nonconformant"} at ${finding.path}`;
    case "import-stratification":
      return `import-stratification: ${finding.from} -> ${finding.to} (${finding.importerStratum} may not import ${finding.targetStratum}) at ${finding.path}`;
    default:
      return `${(finding).check}: ${JSON.stringify(finding)}`;
  }
}

function pathSuffix(relPath) {
  return relPath === undefined ? "" : ` (path: ${relPath})`;
}

const GROUP_TEXT = Object.freeze({
  "exact-deps": (subject, count, relPath) =>
    `package.json for ${subject} has ${count} dependency specification violation(s) (a workspaces/overrides field, or a dependencies/devDependencies/optionalDependencies/peerDependencies entry that is not one exact semver). Repair: pin every dependency to one exact semver that exists on https://registry.561.group, and remove any workspaces/overrides field.${pathSuffix(relPath)}`,
  "lockfile-registry": (subject, count, relPath) =>
    `package-lock.json for ${subject} resolves ${count} house-scoped package(s) away from https://registry.561.group. Repair: rm -rf node_modules package-lock.json, npm install, and verify every house-scoped resolved URL is https://registry.561.group.${pathSuffix(relPath)}`,
  "data-custody": (subject, _count, relPath) =>
    `data/ under ${subject} does not conform to the logs/records/state trio. Repair: migrate every offending entry into data/logs/, data/records/, or data/state/ (those three only) or purge it.${pathSuffix(relPath)}`,
  "import-stratification": (subject, count, relPath) =>
    `${subject} has ${count} import-stratification violation(s) (a scripts/ module importing an apps/ module). Repair: move the imported logic to a scripts/ or src/ module, or move the caller into apps/.${pathSuffix(relPath)}`,
});

/**
 * Groups checker findings into one work-intent task item per (check,
 * subject) pair -- never one per raw finding, so two violations in the
 * same manifest land as one task rather than colliding on the same
 * deterministic id.
 */
export function groupCheckerFindingsIntoTasks(
  findings,
  root,
) {
  const bySubject = new Map();
  for (const finding of findings) {
    const subject = subjectForFinding(finding);
    const key = `${finding.check}::${subject}`;
    const existing = bySubject.get(key);
    if (existing === undefined) {
      bySubject.set(key, { check: finding.check, subject, findings: [finding], subjectDirectory: subjectDirectoryForFinding(finding) });
    } else {
      existing.findings.push(finding);
    }
  }
  return Object.freeze([...bySubject.values()].map(({ check, subject, findings: group, subjectDirectory }) => {
    const relPath = root === undefined ? undefined : relative(root, subjectDirectory);
    const formatter = GROUP_TEXT[check] ?? ((s, n) => `${n} ${check} violation(s) for ${s}.`);
    return Object.freeze({
      cell: taskIdFor(check, subject),
      parent: "",
      text: formatter(subject, group.length, relPath),
      evidence: Object.freeze(group.map(formatFindingLine)),
      provenance: Object.freeze([Object.freeze({ source: `checker:${check}` })]),
    });
  }));
}

/** One task item per systemd user unit observed with `ActiveState=failed`. */
export function tasksFromFailedUnits(
  failedUnits,
) {
  return Object.freeze(failedUnits.map((entry) => Object.freeze({
    cell: taskIdFor("systemd-failed", `${entry.host}-${entry.unit}`),
    parent: "",
    text: `${entry.unit} on host ${entry.host} is ActiveState=failed (sub=${entry.sub ?? "unknown"}). Repair: journalctl --user -u ${entry.unit} --no-pager to find the root cause, fix it, then systemctl --user reset-failed ${entry.unit}.`,
    evidence: Object.freeze([`systemd: unit=${entry.unit} host=${entry.host} active=failed sub=${entry.sub ?? "unknown"} description=${entry.description ?? ""}`]),
    provenance: Object.freeze([Object.freeze({ source: "checker:systemd-unit-inventory" })]),
  })));
}

/** One task item per not-yet-allowed checkout-bound unit ("the checkout is not a runtime"). */
export function tasksFromCheckoutBoundUnits(
  boundUnits,
) {
  return Object.freeze(boundUnits.filter((entry) => !entry.allowed).map((entry) => Object.freeze({
    cell: taskIdFor("checkout-bound-unit", `${entry.host}-${entry.unit}`),
    parent: "",
    text: `${entry.unit} on host ${entry.host} executes from inside the checkout ("the checkout is not a runtime"). Repair: migrate the unit to run its artifact outside the checkout, or add it to the checkout-bound-units allow list if it is lawful development infrastructure.`,
    evidence: Object.freeze([`checkout-bound-unit: unit=${entry.unit} host=${entry.host}`]),
    provenance: Object.freeze([Object.freeze({ source: "checker:checkout-bound-units" })]),
  })));
}

/**
 * Assembles the full structured work intent: the caller's admitted chain
 * items verbatim, plus one item per health task, with only the referenced
 * provenance sources attached.
 */
export function buildHealthWorkIntent({
  id,
  chain,
  producerId = "metroplat/monitoring/checkout-health",
  tasks,
}) {
  const planCell = chain.at(-1)?.cell;
  if (planCell === undefined) throw new TypeError("buildHealthWorkIntent: chain must carry at least one item");
  const chainItems = chain.map((item) => Object.freeze({ ...item, evidence: Object.freeze([]), provenance: Object.freeze([Object.freeze({ source: "roadmap-chain" })]) }));
  const parentedTasks = tasks.map((task) => Object.freeze({ ...task, parent: task.parent === "" ? planCell : task.parent }));
  const items = Object.freeze([...chainItems, ...parentedTasks]);
  const referencedSourceIds = new Set(["roadmap-chain", ...items.flatMap((item) => item.provenance.map((p) => p.source))]);
  const sources = Object.freeze([...referencedSourceIds].map((sourceId) => SOURCE_CATALOG[sourceId]).filter((entry) => entry !== undefined));
  return Object.freeze({
    kind: "metroplat.work.structured-intent",
    id,
    producer: Object.freeze({ id: producerId }),
    sources,
    items,
  });
}

/**
 * The full checkout-health work-intent plan: task items grouped from every
 * checker finding and the assembled structured intent -- pure composition;
 * the caller admits the intent and allocation control staffs its tasks.
 */
export function healthWorkIntent(health, options) {
  const checkerTasks = groupCheckerFindingsIntoTasks(health.findings, options.root);
  const unitTasks = tasksFromFailedUnits(health.failedUnits);
  const boundUnitTasks = tasksFromCheckoutBoundUnits(health.checkoutBoundUnits);
  const ungoverned = Object.freeze([...checkerTasks, ...unitTasks, ...boundUnitTasks]);
  const tasks = options.work === undefined || options.skill === undefined
    ? ungoverned
    : Object.freeze(ungoverned.map((task) => Object.freeze({ ...task, work: options.work, skill: options.skill })));
  const intent = buildHealthWorkIntent({ id: options.id, chain: options.chain, producerId: options.producerId, tasks });
  return Object.freeze({ intent, tasks });
}
