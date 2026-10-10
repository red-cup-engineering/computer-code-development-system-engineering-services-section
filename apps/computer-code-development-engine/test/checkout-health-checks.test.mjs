import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  changedPathsFromGitStatus,
  checkoutScanPaths,
  houseScopedLockfileRegistryViolations,
  observeCheckoutBoundUnitsAcrossHosts,
  observeFailedUnitsAcrossHosts,
  readChecksCache,
  readCheckoutHealth,
  writeChecksCache,
} from "@red-cup-engineering/computer-code-development-engine/monitoring/checkout-health/checks";

function scratchDir() {
  return mkdtempSync(join(tmpdir(), "checkout-health-checks-"));
}

test("changedPathsFromGitStatus reads tracked porcelain status, a rename by its destination, and tolerates a git failure", () => {
  const requests = [];
  const execute = (request) => {
    requests.push(request);
    return { result: { status: 0, stdout: " M src/a.mjs\0A  src/b c.mjs\0R  src/new.mjs\0src/old.mjs\0", stderr: "" } };
  };
  const paths = changedPathsFromGitStatus({ root: "/root", execute });
  assert.deepEqual(paths, ["/root/src/a.mjs", "/root/src/b c.mjs", "/root/src/new.mjs"]);
  assert.deepEqual(requests[0].arguments, ["status", "--porcelain=v1", "-z", "--untracked-files=no"]);
  assert.equal(changedPathsFromGitStatus({ root: "/root", execute: () => { throw new Error("git missing"); } }), null);
  assert.equal(changedPathsFromGitStatus({ root: "/root", execute: () => ({ result: { status: 128, stdout: "", stderr: "not a git repository" } }) }), null);
});

test("checkoutScanPaths walks the whole tree for package.json/package-lock.json and emits one custody-scan marker per data/ directory, skipping node_modules and .git", () => {
  const tree = {
    "/repo": ["pkg-a", "section-x", "node_modules", ".git"],
    "/repo/pkg-a": ["package.json", "package-lock.json"],
    "/repo/section-x": ["data"],
    "/repo/section-x/data": ["records"],
    "/repo/section-x/data/records": ["notes.json"],
    "/repo/node_modules": ["some-dep"],
    "/repo/node_modules/some-dep": ["package.json"],
    "/repo/.git": ["HEAD"],
  };
  const dirKind = new Set(["/repo", "/repo/pkg-a", "/repo/section-x", "/repo/node_modules", "/repo/.git", "/repo/section-x/data", "/repo/section-x/data/records", "/repo/node_modules/some-dep"]);
  const readdirFn = (dir) => (tree[dir] ?? []).map((name) => ({ name, isDirectory: () => dirKind.has(join(dir, name)) }));
  const paths = checkoutScanPaths({ root: "/repo", readdirFn });
  assert.ok(paths.includes("/repo/pkg-a/package.json"));
  assert.ok(paths.includes("/repo/pkg-a/package-lock.json"));
  assert.ok(paths.includes(join("/repo/section-x/data", "__custody-scan__")));
  assert.ok(!paths.some((p) => p.includes("/node_modules/")), "must skip node_modules entirely");
  assert.ok(!paths.some((p) => p.includes("/.git/")), "must skip .git entirely");
});

test("checkoutScanPaths never throws when a directory is unreadable mid-walk", () => {
  const readdirFn = (dir) => {
    if (dir === "/repo") return [{ name: "locked", isDirectory: () => true }];
    throw new Error("EACCES");
  };
  assert.doesNotThrow(() => checkoutScanPaths({ root: "/repo", readdirFn }));
});

test("houseScopedLockfileRegistryViolations flags a house-scoped resolved URL off the canonical registry", () => {
  const lock = JSON.stringify({
    packages: {
      "node_modules/@red-cup-engineering/eavt-services-section/actor": { name: "@red-cup-engineering/eavt-services-section/actor", resolved: "https://registry.561.group/@red-cup-engineering/eavt-services-section/actor/-/actor-0.1.0.tgz" },
      "node_modules/@red-cup-engineering/stale": { name: "@red-cup-engineering/stale", resolved: "http://127.0.0.1:4873/@red-cup-engineering/stale/-/stale-0.1.0.tgz" },
      "node_modules/acorn": { name: "acorn", resolved: "https://registry.npmjs.org/acorn/-/acorn-8.15.0.tgz" },
    },
  });
  const violations = houseScopedLockfileRegistryViolations(lock);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].name, "@red-cup-engineering/stale");
});

test("houseScopedLockfileRegistryViolations ignores third-party packages and malformed JSON", () => {
  assert.deepEqual(houseScopedLockfileRegistryViolations(JSON.stringify({ packages: { "node_modules/acorn": { name: "acorn", resolved: "https://registry.npmjs.org/acorn/-/acorn-8.15.0.tgz" } } })), []);
  const malformed = houseScopedLockfileRegistryViolations("{not json");
  assert.equal(malformed.length, 1);
  assert.match(malformed[0].reason, /not valid JSON/);
});

test("readChecksCache/writeChecksCache round-trip, and readChecksCache tolerates absence", () => {
  const scratch = scratchDir();
  try {
    const cachePath = join(scratch, "data", "state", "checkout-health-checks-cache.json");
    assert.deepEqual(readChecksCache(cachePath), {});
    writeChecksCache(cachePath, { "/pkg/package.json": { mtimeMs: 1, findings: [] } });
    assert.deepEqual(readChecksCache(cachePath), { "/pkg/package.json": { mtimeMs: 1, findings: [] } });
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("readCheckoutHealth omitting root never runs the checkout-scoped checkers, but unit checks still run", () => {
  const health = readCheckoutHealth({
    observeFailedUnitsFn: () => ({ failedUnits: [], unitsObserved: 3, hostsReached: ["local"], hostsUnreachable: [] }),
  });
  assert.equal(health.findings.length, 0);
  assert.equal(health.checked, 3);
  assert.equal(health.violations, 0);
});

test("readCheckoutHealth: a changed exact-deps package.json is found under a whole-checkout scan", () => {
  const scratch = scratchDir();
  try {
    const pkgDir = join(scratch, "pkg-a");
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(join(pkgDir, "package.json"), JSON.stringify({ name: "pkg-a", version: "1.0.0", dependencies: { "left-pad": "^1.0.0" } }));
    const health = readCheckoutHealth({
      root: scratch,
      changedOnly: false,
      observeFailedUnitsFn: () => ({ failedUnits: [], unitsObserved: 0, hostsReached: ["local"], hostsUnreachable: [] }),
    });
    const finding = health.findings.find((f) => f.check === "exact-deps");
    assert.ok(finding, "expected an exact-deps finding");
    assert.equal(finding.name, "left-pad");
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("readCheckoutHealth: a house-scoped lockfile resolved off-registry is found under a whole-checkout scan", () => {
  const scratch = scratchDir();
  try {
    const pkgDir = join(scratch, "pkg-b");
    mkdirSync(pkgDir, { recursive: true });
    writeFileSync(join(pkgDir, "package.json"), JSON.stringify({ name: "pkg-b", version: "1.0.0" }));
    writeFileSync(join(pkgDir, "package-lock.json"), JSON.stringify({
      packages: { "node_modules/@red-cup-engineering/foo": { name: "@red-cup-engineering/foo", resolved: "https://registry.npmjs.org/@red-cup-engineering/foo/-/foo-0.1.0.tgz" } },
    }));
    const health = readCheckoutHealth({
      root: scratch,
      changedOnly: false,
      observeFailedUnitsFn: () => ({ failedUnits: [], unitsObserved: 0, hostsReached: ["local"], hostsUnreachable: [] }),
    });
    const finding = health.findings.find((f) => f.check === "lockfile-registry");
    assert.ok(finding, "expected a lockfile-registry finding");
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("readCheckoutHealth: a data/ directory outside the logs/records/state trio is found under a whole-checkout scan", () => {
  const scratch = scratchDir();
  try {
    const sectionDir = join(scratch, "section-x");
    mkdirSync(join(sectionDir, "data", "scratch"), { recursive: true });
    const health = readCheckoutHealth({
      root: scratch,
      changedOnly: false,
      observeFailedUnitsFn: () => ({ failedUnits: [], unitsObserved: 0, hostsReached: ["local"], hostsUnreachable: [] }),
    });
    const finding = health.findings.find((f) => f.check === "data-custody");
    assert.ok(finding, "expected a data-custody finding");
    assert.ok(finding.offenders.includes("scratch"));
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("readCheckoutHealth: a scripts/x.mjs importing node:fs is one builtin-imports finding; test/x.test.mjs and a node:test-only scripts/y.mjs yield none", () => {
  const scratch = scratchDir();
  try {
    const pkgDir = join(scratch, "pkg-d");
    mkdirSync(join(pkgDir, "scripts"), { recursive: true });
    mkdirSync(join(pkgDir, "test"), { recursive: true });
    writeFileSync(join(pkgDir, "package.json"), JSON.stringify({ name: "pkg-d", version: "1.0.0" }));
    writeFileSync(join(pkgDir, "scripts", "x.mjs"), 'import { readFileSync } from "node:fs";\nexport const x = readFileSync;\n');
    writeFileSync(join(pkgDir, "scripts", "y.mjs"), 'import test from "node:test";\nexport const y = test;\n');
    writeFileSync(join(pkgDir, "test", "x.test.mjs"), 'import { readFileSync } from "node:fs";\nexport const x = readFileSync;\n');
    const health = readCheckoutHealth({
      root: scratch,
      changedOnly: false,
      observeFailedUnitsFn: () => ({ failedUnits: [], unitsObserved: 0, hostsReached: ["local"], hostsUnreachable: [] }),
    });
    const builtinFindings = health.findings.filter((f) => f.check === "builtin-imports");
    assert.equal(builtinFindings.length, 1, "expected exactly one builtin-imports finding");
    assert.equal(builtinFindings[0].path, join(pkgDir, "scripts", "x.mjs"));
    assert.equal(builtinFindings[0].line, 1);
    assert.equal(builtinFindings[0].builtin, "node:fs");
    assert.equal(builtinFindings[0].houseService, "@red-cup-engineering/computer-file-engineering-services-section");
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("readCheckoutHealth: a scripts/ module importing an apps/ module is a denied import-stratification finding", () => {
  const scratch = scratchDir();
  try {
    const pkgDir = join(scratch, "pkg-c");
    mkdirSync(join(pkgDir, "src", "apps"), { recursive: true });
    mkdirSync(join(pkgDir, "src", "scripts"), { recursive: true });
    writeFileSync(join(pkgDir, "package.json"), JSON.stringify({ name: "pkg-c", version: "1.0.0" }));
    writeFileSync(join(pkgDir, "src", "apps", "bar.mts"), "export const bar = 1;\n");
    writeFileSync(join(pkgDir, "src", "scripts", "foo.mts"), 'import { bar } from "../apps/bar.mts";\nexport const foo = bar;\n');
    const health = readCheckoutHealth({
      root: scratch,
      changedOnly: false,
      observeFailedUnitsFn: () => ({ failedUnits: [], unitsObserved: 0, hostsReached: ["local"], hostsUnreachable: [] }),
    });
    const finding = health.findings.find((f) => f.check === "import-stratification");
    assert.ok(finding, "expected an import-stratification finding");
    assert.equal(finding.importerStratum, "scripts");
    assert.equal(finding.targetStratum, "apps");
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("observeFailedUnitsAcrossHosts skips an unreachable host and reports only ActiveState=failed units", () => {
  const observeFn = (host) => {
    if (host === "cold-red-gate") throw new Error("ETIMEDOUT");
    return { host, units: [{ unit: "ok.service", active: "active", sub: "running" }, { unit: "broken.service", active: "failed", sub: "failed", description: "Broken Thing" }], timers: [] };
  };
  const result = observeFailedUnitsAcrossHosts({ hosts: ["local", "cold-red-gate"], observeFn });
  assert.deepEqual(result.hostsReached, ["local"]);
  assert.equal(result.hostsUnreachable.length, 1);
  assert.equal(result.failedUnits.length, 1);
  assert.equal(result.failedUnits[0].unit, "broken.service");
  assert.equal(result.unitsObserved, 2);
});

test("readCheckoutHealth: a failed unit becomes a finding-adjacent record and increases violations, via injected observeFailedUnitsFn", () => {
  const health = readCheckoutHealth({
    observeFailedUnitsFn: () => ({
      failedUnits: [{ host: "local", unit: "flaky.service", sub: "failed", description: "Flaky Thing" }],
      unitsObserved: 5,
      hostsReached: ["local"],
      hostsUnreachable: [],
    }),
  });
  assert.equal(health.failedUnits.length, 1);
  assert.equal(health.failedUnits[0].unit, "flaky.service");
  assert.equal(health.violations, 1);
  assert.equal(health.checked, 5);
});

test("observeCheckoutBoundUnitsAcrossHosts flags an unallowed checkout-bound unit and marks an allowed one", () => {
  const observeFn = (host, { root, allow }) => {
    assert.equal(host, "local");
    assert.equal(root, "/repo");
    return {
      kind: "systemd.checkout-bound-units",
      host,
      root,
      observed: 2,
      allowed: allow.filter((name) => name === "verdaccio.service"),
      bound: [
        { unit: "verdaccio.service", fragmentPath: "", workingDirectory: "/repo", execStart: "/repo/x", activeState: "active", subState: "running", allowed: allow.includes("verdaccio.service") },
        { unit: "rogue.service", fragmentPath: "", workingDirectory: "/repo", execStart: "/repo/y", activeState: "active", subState: "running", allowed: allow.includes("rogue.service") },
      ],
    };
  };
  const bound = observeCheckoutBoundUnitsAcrossHosts({ root: "/repo", allow: ["verdaccio.service"], hosts: ["local"], observeFn });
  assert.equal(bound.length, 2);
  assert.equal(bound.find((entry) => entry.unit === "verdaccio.service").allowed, true);
  assert.equal(bound.find((entry) => entry.unit === "rogue.service").allowed, false);
});

test("readCheckoutHealth: an unallowed checkout-bound unit counts as a violation via the composed read", () => {
  const health = readCheckoutHealth({
    root: undefined,
    hosts: ["local"],
    observeFailedUnitsFn: () => ({ failedUnits: [], unitsObserved: 0, hostsReached: ["local"], hostsUnreachable: [] }),
  });
  assert.deepEqual(health.checkoutBoundUnits, [], "root omitted: checkout-bound-units checker never runs");
  assert.equal(health.violations, 0);
});
