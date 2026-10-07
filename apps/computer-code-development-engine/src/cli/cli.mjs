#!/usr/bin/env node
import { eachWorkspacePackageDir, workspaceTypeIndex } from "@red-cup-engineering/javascript-computer";
/**
 * jsnode-engineering-cli — read the package ecosystem from the command line.
 *
 *   workspace [--format json|names|descriptions]   list every package
 *   search <term>                                  rank packages by name>tag>description
 *   describe <name> [--api]                        one package's coordinates (+ API surface)
 *   find-type <substring>                          types across the ecosystem whose name matches
 *   functions-taking <type>                        functions whose domain mentions a type
 *   functions-producing <type>                     functions whose codomain mentions a type
 *   consumers <pkg> [symbol]                        who imports a package (or one symbol of it)
 *   uses <pkg>                                     what a package consumes, as typed uses-* edges
 *   unused-exports <pkg>                           exported functions/classes nothing imports
 *   deprecated-unused                              sweep deprecated packages for unused exports
 *   duplication [scope] [--limit N] [--compact] [--cache-dir dir] [--progress]
 *                                                    rank semantic executable duplication
 *   duplication-migration (--fingerprint <fp> | --rank N) [--owner <pkg>] [--within-package] [--canonical-file <file> --canonical-name <name>] [--apply]
 *                                                    plan/apply migrating one duplication candidate
 *   duplication-migration --batch [--scope <substring>] [--minimum-bytes N] [--limit N] [--apply] [--cache-dir <dir>]
 *                                                    plan/apply every candidate from one scan, package by package
 *
 * All commands accept --root <dir>; it defaults to the repo root above cwd.
 * All commands accept --exclude <name-pattern> (repeatable) to drop packages
 * from every view — exact names, or `*` wildcards (`@scope/*-experimental`).
 * The type queries read current authored source — no build is needed to make
 * them legible. Type matching is substring (so `JsType` also finds
 * `JsType | undefined`), which keeps compound types visible at the cost of
 * exactness.
 */
import process from "node:process";
import path from "node:path";
import { discoverWorkspace, readJSNodePackage, auditPackageBoundary, workspaceConsumptionIndex, discoverPackageDirs, consumersOfSymbol, coarseConsumersOfPackage, exportedFunctionsAndClasses, classifyUnusedExports, resolveConsumptionEdges, } from "@red-cup-engineering/computer-code-development-engine/analysis/workspace/index";
// Find a package's directory by exact name, honouring the run's exclusions.
function locatePackageDir(root, name, exclude) {
    for (const pkg of eachWorkspacePackageDir(root, { exclude })) {
        if (pkg.name === name)
            return pkg.dir;
    }
    return undefined;
}
// Resolve a user-typed package operand (full `@scope/name` or the unscoped tail)
// to the canonical workspace package name, plus its directory.
function resolvePackage(root, operand, exclude) {
    const packages = discoverPackageDirs(root, { exclude });
    return (packages.find((p) => p.name === operand) ??
        packages.find((p) => p.name.endsWith(`/${operand}`)));
}
/** The workspace root is a declared input (`--root`), defaulting to the working directory; the
 *  repository carries no root workspace file to discover (org-layering: repo root stays lean). */
function findRepoRoot(from) {
    return path.resolve(from);
}
function usage() {
    return [
        "usage: jsnode-engineering-cli <command> [--root <dir>] [--exclude <name-pattern>]...",
        "  workspace [--format json|names|descriptions]",
        "  search <term>",
        "  describe <name> [--api]",
        "  find-type <substring>",
        "  functions-taking <type>",
        "  functions-producing <type>",
        "  consumers <pkg> [symbol]",
        "  uses <pkg>",
        "  unused-exports <pkg>",
        "  deprecated-unused",
        "  duplication [scope] [--limit N] [--compact] [--cache-dir dir] [--progress]",
        "                                                semantic duplication ranked by removable bytes",
        "                                                --limit requires a positive integer; --compact omits candidate arrays",
        "                                                --cache-dir persists only content-addressed per-file AST results",
        "  duplication-migration (--fingerprint <fp> | --rank N) [--owner <pkg>] [--within-package] [--canonical-file <file> --canonical-name <name>] [--apply]",
        "                                                plan migrating one cross-package, consumer-backed",
        "                                                duplication candidate onto a canonical owner package;",
        "                                                a single-package candidate (or one restricted to --owner",
        "                                                via --within-package) canonicalizes within that package;",
        "                                                --apply performs the plan as AST edits (exits 2 if refused)",
        "  duplication-migration --batch [--scope <substring>] [--minimum-bytes N] [--limit N] [--apply] [--cache-dir dir] [--progress]",
        "                                                plan (or, with --apply, apply) every candidate from one scan:",
        "                                                cross-package candidates with a discoverable owner first, then",
        "                                                within-package ones; --apply commits/reverts per package behind",
        "                                                that package's own tests and never touches lockfiles",
        "  duplication-migration --batch --apply --promote-owners [--scope ...] [--minimum-bytes N] [--limit N]",
        "                                                apply ONLY the planned owner-export-promotion edits (never the",
        "                                                site migrations): for every candidate refused because the owner",
        "                                                already has a matching but unexported implementation, edit that",
        "                                                owner to export it, gated on the owner's own tests",
        "  boundary [dir]                                 audit direct Node package entrypoints (default: cwd)",
        "",
    ].join("\n");
}
export function parseArgs(argv) {
    let command = "";
    let operand;
    let operand2;
    let root;
    let format = "json";
    let api = false;
    let help = false;
    let limit;
    let compact = false;
    let cacheDir;
    const exclude = [];
    let fingerprint;
    let rank;
    let owner;
    let canonicalFile;
    let canonicalName;
    let apply = false;
    let withinPackage = false;
    let batch = false;
    let promoteOwners = false;
    let scope;
    let minimumBytes;
    let progress = false;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i] ?? "";
        if (arg === "--help" || arg === "-h")
            help = true;
        else if (arg === "--api")
            api = true;
        else if (arg === "--compact")
            compact = true;
        else if (arg === "--apply")
            apply = true;
        else if (arg === "--progress")
            progress = true;
        else if (arg === "--within-package")
            withinPackage = true;
        else if (arg === "--batch")
            batch = true;
        else if (arg === "--promote-owners")
            promoteOwners = true;
        else if (arg === "--scope") {
            const value = argv[++i];
            if (value === undefined || value === "")
                throw new Error("--scope needs a value");
            scope = value;
        }
        else if (arg === "--minimum-bytes") {
            const value = argv[++i];
            if (value === undefined || !/^[1-9]\d*$/u.test(value)) {
                throw new Error(`--minimum-bytes must be a positive integer; got: ${String(value)}`);
            }
            minimumBytes = Number(value);
            if (!Number.isSafeInteger(minimumBytes)) {
                throw new Error(`--minimum-bytes must be a safe positive integer; got: ${value}`);
            }
        }
        else if (arg === "--cache-dir") {
            const value = argv[++i];
            if (value === undefined || value === "")
                throw new Error("--cache-dir needs a directory");
            cacheDir = value;
        }
        else if (arg === "--limit") {
            const value = argv[++i];
            if (value === undefined || !/^[1-9]\d*$/u.test(value)) {
                throw new Error(`--limit must be a positive integer; got: ${String(value)}`);
            }
            limit = Number(value);
            if (!Number.isSafeInteger(limit)) {
                throw new Error(`--limit must be a safe positive integer; got: ${value}`);
            }
        }
        else if (arg === "--rank") {
            const value = argv[++i];
            if (value === undefined || !/^[1-9]\d*$/u.test(value)) {
                throw new Error(`--rank must be a positive integer; got: ${String(value)}`);
            }
            rank = Number(value);
            if (!Number.isSafeInteger(rank)) {
                throw new Error(`--rank must be a safe positive integer; got: ${value}`);
            }
        }
        else if (arg === "--fingerprint") {
            const value = argv[++i];
            if (value === undefined || value === "")
                throw new Error("--fingerprint needs a value");
            fingerprint = value;
        }
        else if (arg === "--owner") {
            const value = argv[++i];
            if (value === undefined || value === "")
                throw new Error("--owner needs a package name");
            owner = value;
        }
        else if (arg === "--canonical-file" || arg === "--canonical-name") {
            const value = argv[++i];
            if (value === undefined || value === "") throw new Error(`${arg} needs a value`);
            if (arg === "--canonical-file") canonicalFile = value;
            else canonicalName = value;
        }
        else if (arg === "--root")
            root = argv[++i];
        else if (arg === "--exclude") {
            const p = argv[++i];
            if (p !== undefined && p !== "")
                exclude.push(p);
        }
        else if (arg === "--format") {
            const f = argv[++i];
            if (f === "json" || f === "names" || f === "descriptions")
                format = f;
            else
                throw new Error(`--format must be json, names, or descriptions; got: ${String(f)}`);
        }
        else if (!arg.startsWith("--")) {
            if (command === "")
                command = arg;
            else if (operand === undefined)
                operand = arg;
            else if (operand2 === undefined)
                operand2 = arg;
        }
    }
    if ((canonicalFile === undefined) !== (canonicalName === undefined)) {
        throw new Error("--canonical-file and --canonical-name must be supplied together");
    }
    if (batch && canonicalFile !== undefined) throw new Error("an explicit canonical selects one family, not a batch");
    return {
        command, operand, operand2, root, format, api, help, limit, compact, cacheDir, exclude,
        fingerprint, rank, owner, canonicalFile, canonicalName, apply, withinPackage, batch, promoteOwners, scope, minimumBytes, progress,
    };
}
export function formatDuplicationReport(report, compact) {
    if (!compact)
        return JSON.stringify(report, null, 2) + "\n";
    return JSON.stringify({
        ...report,
        returnedCandidateCount: report.candidates.length,
        // implementationCount already lives on `candidate` itself (the true
        // total, uncapped even when detail:false capped `implementations`);
        // this CLI-only compact view goes further and drops the arrays entirely
        // in favor of packageCount/consumerCount, for a human skimming a shell.
        candidates: report.candidates.map(({ implementations, packages, consumers, ...candidate }) => ({
            ...candidate,
            packageCount: packages.length,
            consumerCount: consumers.length,
        })),
    }, null, 2) + "\n";
}
function formatWorkspace(workspace, format) {
    if (format === "names")
        return workspace.packages.map((p) => p.name).join("\n") + "\n";
    if (format === "descriptions") {
        return workspace.packages.map((p) => `${p.name}\t${p.description}`).join("\n") + "\n";
    }
    return JSON.stringify(workspace.packages, null, 2) + "\n";
}
function requireOperand(parsed) {
    if (parsed.operand === undefined || parsed.operand === "") {
        throw new Error(`${parsed.command} needs an argument\n${usage()}`);
    }
    return parsed.operand;
}
export async function runCli(argv = process.argv.slice(2), io = {}) {
    const out = io.stdout ?? process.stdout;
    const err = io.stderr ?? process.stderr;
    try {
        const parsed = parseArgs(argv);
        if (parsed.help || parsed.command === "") {
            out.write(usage());
            return parsed.help ? 0 : 1;
        }
        const cwd = io.cwd ?? process.cwd();
        const root = parsed.root !== undefined ? path.resolve(cwd, parsed.root) : findRepoRoot(cwd);
        const exclude = parsed.exclude;
        const scope = parsed.scope ?? (parsed.command === "duplication" ? parsed.operand : undefined);
        const duplicationOptions = {
            exclude,
            ...(scope !== undefined ? { scope } : {}),
            ...(parsed.minimumBytes !== undefined ? { minimumBytes: parsed.minimumBytes } : {}),
            ...(parsed.cacheDir !== undefined ? { cacheDir: path.resolve(cwd, parsed.cacheDir) } : {}),
            progress: parsed.progress,
        };
        switch (parsed.command) {
            case "duplication": {
                const { workspaceDuplication } = await import("@red-cup-engineering/javascript-deduplication-services-section/duplication");
                const report = workspaceDuplication(root, {
                    ...duplicationOptions,
                    ...(parsed.limit !== undefined ? { limit: parsed.limit } : {}),
                    // The CLI's own --compact flag already reduces implementations/
                    // packages/consumers to bare counts in formatDuplicationReport
                    // below; that reduction needs the complete arrays to count, so
                    // this call always asks for full detail regardless of --compact.
                    // (The API/MCP-level `detail: false` default that caps these
                    // arrays is a distinct, additive concern for the MCP surface.)
                    detail: true,
                });
                out.write(formatDuplicationReport(report, parsed.compact));
                return 0;
            }
            case "duplication-migration": {
                const { planDuplicationMigration, applyDuplicationMigrationPlan, planDuplicationMigrationBatch, applyDuplicationMigrationBatch, applyOwnerExportPromotions } = await import("@red-cup-engineering/javascript-deduplication-services-section/duplication-migration");
                if (parsed.batch) {
                    const batch = await planDuplicationMigrationBatch(root, {
                        ...duplicationOptions,
                        ...(parsed.limit !== undefined ? { limit: parsed.limit } : {}),
                    });
                    if (!parsed.apply) {
                        out.write(JSON.stringify(batch, null, 2) + "\n");
                        return 0;
                    }
                    if (parsed.promoteOwners) {
                        const promoted = applyOwnerExportPromotions(root, batch);
                        out.write(JSON.stringify(promoted.ownersPromoted, null, 2) + "\n");
                        out.write("publish these owners, then re-run the batch\n");
                        return 0;
                    }
                    const applied = applyDuplicationMigrationBatch(root, batch, { progress: parsed.progress });
                    out.write(JSON.stringify(applied, null, 2) + "\n");
                    return 0;
                }
                const plan = await planDuplicationMigration(root, {
                    ...(parsed.fingerprint !== undefined ? { fingerprint: parsed.fingerprint } : {}),
                    ...(parsed.rank !== undefined ? { rank: parsed.rank } : {}),
                }, {
                    ...duplicationOptions,
                    ...(parsed.owner !== undefined ? { owner: parsed.owner } : {}),
                    ...(parsed.withinPackage ? { withinPackage: true } : {}),
                    ...(parsed.canonicalFile === undefined ? {} : { canonical: { file: parsed.canonicalFile, name: parsed.canonicalName } }),
                });
                if (!parsed.apply) {
                    out.write(JSON.stringify(plan, null, 2) + "\n");
                    return 0;
                }
                if (!plan.applicable) {
                    out.write(JSON.stringify(plan, null, 2) + "\n");
                    return 2;
                }
                const applied = applyDuplicationMigrationPlan(root, plan);
                out.write(JSON.stringify(applied, null, 2) + "\n");
                // Every affected package's own test gate reverted its edits: the plan
                // was "applicable" by fingerprint match alone, but nothing was
                // actually kept — a real failure, never silently reported as success.
                const results = applied.packageResults ?? [];
                if (results.length > 0 && results.every((result) => "reverted" in result))
                    return 2;
                return 0;
            }
            case "boundary": {
                const dir = path.resolve(cwd, parsed.operand ?? ".");
                const result = await auditPackageBoundary(dir);
                if (result.ok) {
                    out.write(`${result.name}: package boundary ok\n`);
                    return 0;
                }
                err.write(`${result.name} has package-boundary failures:\n${result.failures.map((f) => `- ${f}`).join("\n")}\n`);
                return 1;
            }
            case "workspace": {
                const workspace = await discoverWorkspace(root, { exclude });
                out.write(formatWorkspace(workspace, parsed.format));
                return 0;
            }
            case "search": {
                const term = requireOperand(parsed);
                const workspace = await discoverWorkspace(root, { exclude });
                const { searchPackages } = await import("@red-cup-engineering/computer-code-development-engine/analysis/topology/index");
                const matches = searchPackages(workspace.packages, term);
                if (matches.length === 0) {
                    out.write(`no package matches "${term}"\n`);
                    return 0;
                }
                for (const m of matches) {
                    const where = m.field === "tag" ? `tag:${m.tag ?? ""}` : m.field;
                    out.write(`[${where}] ${m.package.name}\n    ${m.package.description}\n`);
                }
                return 0;
            }
            case "describe": {
                const name = requireOperand(parsed);
                const workspace = await discoverWorkspace(root, { exclude });
                const found = workspace.packages.find((p) => p.name === name || p.name.endsWith(`/${name}`));
                if (!found) {
                    out.write(`no package named "${name}"\n`);
                    return 1;
                }
                // re-read with introspection when --api is asked, by locating its dir.
                let pkg = found;
                if (parsed.api) {
                    const dir = locatePackageDir(root, found.name, exclude);
                    const detail = dir ? await readJSNodePackage(dir, { introspect: true }) : undefined;
                    if (detail)
                        pkg = detail;
                }
                out.write(`${pkg.name}  (${pkg.layer})\n`);
                out.write(`  ${pkg.description}\n`);
                if (pkg.tags.length)
                    out.write(`  tags: ${pkg.tags.join(", ")}\n`);
                out.write(`  exports: ${pkg.exports.join(", ") || "(none)"}\n`);
                out.write(`  depends-on: ${pkg.dependencies.join(", ") || "(none)"}\n`);
                if (pkg.api) {
                    out.write(`  types (${pkg.api.types.length}): ${pkg.api.types.map((t) => `${t.name}:${t.kind}`).join(", ")}\n`);
                    out.write(`  functions (${pkg.api.functions.length}): ${pkg.api.functions.map((f) => f.name).join(", ")}\n`);
                }
                else if (parsed.api) {
                    out.write(`  (no API surface found in authored source)\n`);
                }
                return 0;
            }
            case "find-type": {
                const needle = requireOperand(parsed).toLowerCase();
                const index = workspaceTypeIndex(root, { exclude });
                const hits = index.types.filter((t) => t.name.toLowerCase().includes(needle));
                if (hits.length === 0) {
                    out.write(`no exported type matches "${needle}"\n`);
                    return 0;
                }
                for (const t of hits)
                    out.write(`${t.pkg} : ${t.name} (${t.kind})\n`);
                return 0;
            }
            case "functions-taking":
            case "functions-producing": {
                const needle = requireOperand(parsed);
                const index = workspaceTypeIndex(root, { exclude });
                const taking = parsed.command === "functions-taking";
                const hits = index.functions.filter((f) => taking
                    ? f.domain.some((d) => d.includes(needle))
                    : f.codomain !== undefined && f.codomain.includes(needle));
                if (hits.length === 0) {
                    out.write(`no function ${taking ? "takes" : "produces"} a type matching "${needle}"\n`);
                    return 0;
                }
                for (const f of hits) {
                    const cod = f.codomain !== undefined ? ` -> ${f.codomain}` : "";
                    out.write(`${f.pkg} : ${f.name}(${f.domain.join(", ")})${cod}\n`);
                }
                return 0;
            }
            case "consumers": {
                const operand = requireOperand(parsed);
                const resolved = resolvePackage(root, operand, exclude);
                if (!resolved) {
                    out.write(`no package named "${operand}"\n`);
                    return 1;
                }
                const index = workspaceConsumptionIndex(root, { exclude });
                const symbol = parsed.operand2;
                if (symbol !== undefined && symbol !== "") {
                    const consumers = consumersOfSymbol(index, resolved.name, symbol);
                    if (consumers.length === 0) {
                        out.write(`nothing imports ${resolved.name}:${symbol}\n`);
                    }
                    else {
                        out.write(`${consumers.length} package(s) import ${resolved.name}:${symbol}\n`);
                        for (const c of consumers) {
                            out.write(`  ${c.consumer}${c.typeOnly ? " (type-only)" : ""}\n`);
                        }
                    }
                    const coarse = coarseConsumersOfPackage(index, resolved.name);
                    if (coarse.length > 0) {
                        out.write(`  + ${coarse.length} package(s) reach ${resolved.name} via namespace/star/dynamic import — usage of ${symbol} indeterminate\n`);
                    }
                    return 0;
                }
                // No symbol: every named symbol consumed, plus coarse reaches.
                const named = new Map();
                for (const e of index.edges) {
                    if (e.provider !== resolved.name || e.name === undefined)
                        continue;
                    let s = named.get(e.name);
                    if (!s)
                        named.set(e.name, (s = new Set()));
                    s.add(e.consumer);
                }
                const coarse = coarseConsumersOfPackage(index, resolved.name);
                if (named.size === 0 && coarse.length === 0) {
                    out.write(`nothing in the workspace imports ${resolved.name}\n`);
                    return 0;
                }
                for (const [name, consumers] of [...named].sort((a, b) => a[0].localeCompare(b[0]))) {
                    out.write(`${name}: ${[...consumers].sort().join(", ")}\n`);
                }
                if (coarse.length > 0) {
                    out.write(`(coarse) ${coarse.map((c) => `${c.consumer}:${c.mode}`).join(", ")}\n`);
                }
                return 0;
            }
            case "uses": {
                const operand = requireOperand(parsed);
                const resolved = resolvePackage(root, operand, exclude);
                if (!resolved) {
                    out.write(`no package named "${operand}"\n`);
                    return 1;
                }
                // The demand half of the graph, classified against the supply half:
                // each edge is the same uses-function/uses-type/uses-package utterance
                // the topology settles, rendered as `consumer  predicate  provider:name`.
                const index = workspaceConsumptionIndex(root, { exclude });
                const typeIndex = workspaceTypeIndex(root, { exclude });
                const edges = resolveConsumptionEdges(index, typeIndex).filter((e) => e.consumer === resolved.name);
                if (edges.length === 0) {
                    out.write(`${resolved.name} consumes nothing from the workspace\n`);
                    return 0;
                }
                const { usesFunctionPredicate, usesTypePredicate, usesPackagePredicate } = await import("@red-cup-engineering/computer-code-development-engine/analysis/topology/index");
                const lines = new Set();
                for (const e of edges) {
                    const predicate = e.kind === "function" ? usesFunctionPredicate() : e.kind === "type" ? usesTypePredicate() : usesPackagePredicate();
                    const object = e.name !== undefined ? `${e.provider}:${e.name}` : e.provider;
                    lines.add(`${predicate}  ${object}`);
                }
                for (const line of [...lines].sort())
                    out.write(`${line}\n`);
                return 0;
            }
            case "unused-exports": {
                const operand = requireOperand(parsed);
                const resolved = resolvePackage(root, operand, exclude);
                if (!resolved) {
                    out.write(`no package named "${operand}"\n`);
                    return 1;
                }
                const index = workspaceConsumptionIndex(root, { exclude });
                const typeIndex = workspaceTypeIndex(root, { exclude });
                const exports = exportedFunctionsAndClasses(typeIndex, resolved.name);
                const report = classifyUnusedExports(index, resolved.name, exports, true);
                if (report.indeterminate) {
                    const coarse = coarseConsumersOfPackage(index, resolved.name);
                    out.write(`${resolved.name}: usage-indeterminate — reached by ${coarse.map((c) => `${c.consumer}:${c.mode}`).join(", ")}\n`);
                    out.write(`  cannot certify any of its ${exports.length} export(s) unused\n`);
                    return 0;
                }
                if (exports.length === 0) {
                    out.write(`${resolved.name} exports no functions or classes\n`);
                    return 0;
                }
                if (report.unused.length === 0) {
                    out.write(`${resolved.name}: all ${exports.length} exported functions/classes are imported somewhere\n`);
                    return 0;
                }
                out.write(`${resolved.name}: ${report.unused.length}/${exports.length} exported functions/classes have no importer\n`);
                for (const s of report.unused)
                    out.write(`  ${s.kind} ${s.name}\n`);
                return 0;
            }
            case "deprecated-unused": {
                const workspace = await discoverWorkspace(root, { exclude });
                const deprecated = workspace.packages.filter((p) => p.tags.includes("deprecated"));
                if (deprecated.length === 0) {
                    out.write(`no package carries the "deprecated" keyword\n`);
                    return 0;
                }
                const index = workspaceConsumptionIndex(root, { exclude });
                const typeIndex = workspaceTypeIndex(root, { exclude });
                out.write(`${deprecated.length} deprecated package(s):\n\n`);
                for (const pkg of deprecated) {
                    const exports = exportedFunctionsAndClasses(typeIndex, pkg.name);
                    const report = classifyUnusedExports(index, pkg.name, exports, true);
                    if (report.indeterminate) {
                        const coarse = coarseConsumersOfPackage(index, pkg.name);
                        out.write(`${pkg.name} — usage-indeterminate (reached by ${coarse.map((c) => `${c.consumer}:${c.mode}`).join(", ")}); cannot certify unused\n\n`);
                        continue;
                    }
                    if (report.unused.length === 0) {
                        out.write(`${pkg.name} — every exported function/class still has an importer\n\n`);
                        continue;
                    }
                    out.write(`${pkg.name} — ${report.unused.length}/${exports.length} exports importable for removal:\n`);
                    for (const s of report.unused)
                        out.write(`  ${s.kind} ${s.name}\n`);
                    out.write("\n");
                }
                return 0;
            }
            default:
                throw new Error(usage());
        }
    }
    catch (error) {
        err.write(`${error instanceof Error ? error.message : String(error)}\n`);
        return 1;
    }
}
if (import.meta.main) {
    runCli().then((code) => { process.exitCode = code; }, (error) => {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
    });
}
