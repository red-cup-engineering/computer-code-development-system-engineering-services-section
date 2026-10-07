import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import * as workspaceMonitor from "@red-cup-engineering/computer-code-development-engine/monitoring/source-code/workspace";
import { workspaceGraphOperations, workspacePackageConformanceOfFlatfileObservation } from "@red-cup-engineering/computer-code-development-engine/monitoring/operations";
import { assembleDefaultService } from "@red-cup-engineering/metroplat/catalog";
import {
  workspaceDependencyGraphDiagram,
  workspaceDependencyGraphTurtle,
} from "@red-cup-engineering/metroplat/presentation/workspace";
import { scanPackagePublicationStatus } from "@red-cup-engineering/computer-code-development-engine/workspace/scanner/service";

function write(root, relative, value) {
  const target = path.join(root, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, value, "utf8");
}

function manifest(name, dependencies = {}) {
  return `${JSON.stringify({ name, version: "1.0.0", type: "module", dependencies }, null, 2)}\n`;
}

test("workspace monitoring keeps pure graph material separate from its host adapter", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "metroplat-workspace-monitor-"));
  try {
    write(root, "package.json", manifest("@test/root", { "@test/a": "workspace:*" }));
    write(root, "pnpm-workspace.yaml", "packages:\n  - packages/*\n");
    write(root, "src/index.mts", 'import "@test/a";\n');
    write(root, "packages/a/package.json", manifest("@test/a", { "@test/b": "workspace:*" }));
    write(root, "packages/a/src/index.mts", 'import "@test/b";\n');
    write(root, "packages/b/package.json", manifest("@test/b"));
    write(root, "packages/b/src/index.mts", "export const b = true;\n");

    assert.equal("workspaceGraphOperations" in workspaceMonitor, false);
    assert.equal(typeof workspaceMonitor.workspaceDependencyGraphOf, "function");
    assert.equal(typeof workspaceMonitor.workspaceImportAuditOf, "function");

    const operations = workspaceGraphOperations({ dataRoot: root, packageRoot: root });
    const graphOperation = operations.find((operation) => operation.verb === "workspace-graph");
    const auditOperation = operations.find((operation) => operation.verb === "workspace-import-audit");
    assert.ok(graphOperation);
    assert.ok(auditOperation);

    const graph = await graphOperation.execute({}, {});
    assert.deepEqual(graph.nodes.map((node) => node.name), ["@test/root", "@test/a", "@test/b"]);
    assert.deepEqual(graph.edges.map((edge) => [edge.from, edge.to]), [
      ["@test/root", "@test/a"],
      ["@test/a", "@test/b"],
    ]);
    assert.deepEqual(graph.buildOrder.tiers, [["@test/b"], ["@test/a"], ["@test/root"]]);

    const audit = await auditOperation.execute({}, {});
    assert.deepEqual(audit.phantomImports, []);
    assert.deepEqual(audit.staleDependencies, []);
    assert.deepEqual(audit.crossPackageRelativeImports, []);

    const diagram = workspaceDependencyGraphDiagram(graph);
    assert.match(diagram.title, /workspace dependency graph/u);
    assert.match(workspaceDependencyGraphTurtle(graph), /schema:softwareRequirements/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the default catalog exposes flatfile package conformance for clean and failing packages", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "metroplat-package-conformance-"));
  try {
    write(root, "packages/clean/package.json", manifest("@example/clean"));
    write(root, "packages/bad/package.json", manifest("@example/bad", { "@example/clean": "file:../clean" }));
    const authorityRoot = mkdtempSync(path.join(tmpdir(), "metroplat-package-authority-"));
    write(authorityRoot, "package.json", manifest("@authority/unchanged"));
    const operation = assembleDefaultService({ packageRoot: process.cwd(), dataRoot: authorityRoot })
      .catalog.byVerb.get("workspace-package-conformance");
    assert.ok(operation, "the workspace graph catalog carries package conformance");
    const report = await operation.execute({ root }, {});
    assert.equal(report.kind, "metroplat.workspace-graph.package-conformance");
    assert.equal(report.deviationCount, 1);
    assert.deepEqual(report.diagnostics, []);
    assert.deepEqual(report.packages.map((entry) => [entry.name, entry.deviations.map((deviation) => deviation.code)]), [
      ["@example/clean", []],
      ["@example/bad", ["local-dependency-specifier"]],
    ]);
    assert.equal(JSON.parse(readFileSync(path.join(authorityRoot, "package.json"), "utf8")).name, "@authority/unchanged");
    rmSync(authorityRoot, { recursive: true, force: true });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("package conformance rejects a missing flatfile review rather than reporting a clean package", () => {
  assert.throws(() => workspacePackageConformanceOfFlatfileObservation("/workspace", {
    resources: [{ resource: "urn:fars:flatfile:package.json", focus: "@example/missing", cells: [] }],
    diagnostics: [],
  }), /has no package review/u);
});

test("package publication status distinguishes source authority from an installable Node projection", () => {
  const root = mkdtempSync(path.join(tmpdir(), "metroplat-package-publication-"));
  try {
    write(root, "src/index.mts", "export const value: number = 1;\n");
    write(root, "src/feature/a.mts", "export const feature: number = 1;\n");
    write(root, "src/cli.mts", "#!/usr/bin/env node\nconsole.log(1);\n");
    chmodSync(path.join(root, "src/cli.mts"), 0o755);
    write(root, "src/feature/a.mts", "export const feature: number = 1;\n");
    write(root, "src/cli.mts", "#!/usr/bin/env node\nconsole.log(1);\n");
    chmodSync(path.join(root, "src/cli.mts"), 0o755);
    write(root, "dist/index.mjs", "export const value = 1;\n");
    write(root, "dist/index.d.mts", "export declare const value: number;\n");
    write(root, "dist/feature/a.mjs", "export const feature = 1;\n");
    write(root, "dist/feature/a.d.mts", "export declare const feature: number;\n");
    write(root, "dist/cli.mjs", "#!/usr/bin/env node\nconsole.log(1);\n");
    chmodSync(path.join(root, "dist/cli.mjs"), 0o755);

    const packageManifest = {
      name: "@test/publication",
      version: "1.0.0",
      type: "module",
      files: ["dist"],
      scripts: { build: "tsc" },
      exports: {
        ".": { types: "./src/index.mts", import: "./src/index.mts" },
        "./feature/*": { types: "./src/feature/*.mts", import: "./src/feature/*.mts" },
      },
      bin: { probe: "./src/cli.mts" },
    };
    write(root, "package.json", `${JSON.stringify(packageManifest, null, 2)}\n`);

    const sourceFacing = scanPackagePublicationStatus(root);
    assert.equal(sourceFacing.proof.ok, true, "working-tree existence is only one part of publication proof");
    assert.equal(sourceFacing.policy.localArtifactOk, false);
    assert.equal(sourceFacing.policy.npmPublishable, false);
    assert.ok(sourceFacing.policy.obligations.some((obligation) => obligation.includes("files allowlist excludes")));
    assert.ok(sourceFacing.policy.obligations.some((obligation) => obligation.includes("cannot execute TypeScript runtime targets")));

    packageManifest.exports = {
      ".": { types: "./dist/index.d.mts", import: "./dist/index.mjs" },
      "./feature/*": { types: "./dist/feature/*.d.mts", import: "./dist/feature/*.mjs" },
    };
    packageManifest.bin = { probe: "./dist/cli.mjs" };
    write(root, "package.json", `${JSON.stringify(packageManifest, null, 2)}\n`);

    const emittedFacing = scanPackagePublicationStatus(root);
    assert.equal(emittedFacing.proof.ok, true);
    assert.equal(emittedFacing.policy.localArtifactOk, true);
    assert.equal(emittedFacing.policy.npmPublishable, true);
    assert.deepEqual(emittedFacing.policy.obligations, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("workspace import audit finds a script reaching a sibling's app by relative path, and leaves a clean package alone", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "metroplat-import-audit-stratification-"));
  try {
    write(root, "pnpm-workspace.yaml", "packages:\n  - packages/*\n");
    write(root, "packages/scripty/package.json", manifest("@test/scripty"));
    write(root, "packages/scripty/scripts/do-thing.mjs", 'import "../../appy/apps/entry.mjs";\n');
    write(root, "packages/appy/package.json", manifest("@test/appy"));
    write(root, "packages/appy/apps/entry.mjs", "export const thing = 1;\n");
    write(root, "packages/clean/package.json", manifest("@test/clean"));
    write(root, "packages/clean/src/index.mjs", "export const clean = true;\n");

    const operations = workspaceGraphOperations({ dataRoot: root, packageRoot: root });
    const auditOperation = operations.find((operation) => operation.verb === "workspace-import-audit");
    const audit = await auditOperation.execute({}, {});

    assert.deepEqual(audit.packagesAudited, ["@test/appy", "@test/clean", "@test/scripty"]);
    assert.deepEqual(audit.crossPackageRelativeImports, [{
      consumer: "@test/scripty",
      file: "scripts/do-thing.mjs",
      target: "../appy/apps/entry.mts",
      resolvesInto: "@test/appy",
    }]);
    assert.ok(
      !audit.crossPackageRelativeImports.some((violation) => violation.consumer === "@test/clean"),
      "the clean package carries no cross-package relative import findings",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("workspace import audit scopes to explicit paths, auditing only the named package directories", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "metroplat-import-audit-paths-"));
  try {
    write(root, "packages/inscope/package.json", manifest("@test/inscope"));
    write(root, "packages/inscope/src/index.mjs", "export const inscope = true;\n");
    write(root, "packages/outofscope/package.json", manifest("@test/outofscope"));
    write(root, "packages/outofscope/src/index.mjs", "export const outofscope = true;\n");

    const operations = workspaceGraphOperations({ dataRoot: undefined, packageRoot: root });
    const auditOperation = operations.find((operation) => operation.verb === "workspace-import-audit");
    const audit = await auditOperation.execute({ root, paths: [path.join(root, "packages/inscope")] },
      {},
    );

    assert.deepEqual(audit.packagesAudited, ["@test/inscope"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("workspace import audit refuses an empty resolved root rather than reporting a vacuous clean audit", async () => {
  const emptyRoot = mkdtempSync(path.join(tmpdir(), "metroplat-import-audit-empty-"));
  try {
    const operations = workspaceGraphOperations({ dataRoot: undefined, packageRoot: emptyRoot });
    const auditOperation = operations.find((operation) => operation.verb === "workspace-import-audit");
    assert.throws(
      () => auditOperation.execute({ root: emptyRoot }, {}),
      (error) => error.code === "WORKSPACE_ROOT_EMPTY" && error.root === path.resolve(emptyRoot) && /admits no package\.json/u.test(error.message),
    );
  } finally {
    rmSync(emptyRoot, { recursive: true, force: true });
  }
});
