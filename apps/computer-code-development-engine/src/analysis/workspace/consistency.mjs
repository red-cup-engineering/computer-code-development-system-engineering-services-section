import { workspaceDependencies } from "./dependencies.mjs";
// A script is "common" — worth reporting coverage of — when at least this
// fraction of the packages that have any scripts define it. Keeps the report to
// the scripts a workspace clearly expects of itself, not every one-off task.
const COMMON_SCRIPT_FRACTION = 0.25;
export function workspaceConsistency(workspace) {
    const all = [...workspace.packages].sort((a, b) => a.name.localeCompare(b.name));
    const n = all.length;
    // Hygiene is measured against the *active* set only: a deprecated or abandoned
    // package is not held to the live workspace's standards. Spreads (engines,
    // module systems, lifecycle, maturity) still describe every package.
    const pkgs = all.filter((p) => p.lifecycle === "active");
    const exempt = all.filter((p) => p.lifecycle !== "active").map((p) => p.name);
    // Lifecycle and maturity spreads, over every package.
    const lifecycleCounts = { active: 0, maintenance: 0, deprecated: 0, abandoned: 0 };
    const maturityCounts = { experimental: 0, alpha: 0, beta: 0, stable: 0 };
    for (const p of all) {
        lifecycleCounts[p.lifecycle]++;
        maturityCounts[p.maturity]++;
    }
    // Node engines (spread over all; the gap — no engine — over active only).
    const engineBands = new Map();
    const noNodeEngine = [];
    for (const p of all) {
        const node = p.manifest.engines["node"];
        if (node !== undefined)
            (engineBands.get(node) ?? engineBands.set(node, []).get(node)).push(p.name);
    }
    for (const p of pkgs)
        if (p.manifest.engines["node"] === undefined)
            noNodeEngine.push(p.name);
    const nodeEngines = [...engineBands.entries()]
        .map(([range, packages]) => ({ range, packages: Object.freeze(packages) }))
        .sort((a, b) => b.packages.length - a.packages.length || a.range.localeCompare(b.range));
    // Script coverage over the active set: count each script name, keep the common
    // ones, list which active packages lack them.
    const withScripts = pkgs.filter((p) => p.manifest.scripts.length > 0);
    const noScripts = pkgs.filter((p) => p.manifest.scripts.length === 0).map((p) => p.name);
    const scriptCount = new Map();
    for (const p of withScripts) {
        for (const s of p.manifest.scripts)
            scriptCount.set(s, (scriptCount.get(s) ?? 0) + 1);
    }
    const threshold = Math.max(2, Math.ceil(withScripts.length * COMMON_SCRIPT_FRACTION));
    const scripts = [...scriptCount.entries()]
        .filter(([, c]) => c >= threshold)
        .map(([script, have]) => ({
        script,
        have,
        missing: Object.freeze(withScripts.filter((p) => !p.manifest.scripts.includes(script)).map((p) => p.name)),
    }))
        .sort((a, b) => b.have - a.have || a.script.localeCompare(b.script));
    // Module type spread, over all packages.
    const typeBands = new Map();
    for (const p of all) {
        const t = p.manifest.moduleType ?? "unstated";
        (typeBands.get(t) ?? typeBands.set(t, []).get(t)).push(p.name);
    }
    const moduleTypes = [...typeBands.entries()]
        .map(([type, packages]) => ({ type, count: packages.length, packages: Object.freeze(packages) }))
        .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
    const drift = workspaceDependencies(workspace).drift;
    return {
        kind: "jsnode.consistency",
        packageCount: n,
        activeCount: pkgs.length,
        lifecycleCounts: Object.freeze(lifecycleCounts),
        maturityCounts: Object.freeze(maturityCounts),
        exempt: Object.freeze(exempt),
        nodeEngines: Object.freeze(nodeEngines),
        noNodeEngine: Object.freeze(noNodeEngine),
        scripts: Object.freeze(scripts),
        noScripts: Object.freeze(noScripts),
        moduleTypes: Object.freeze(moduleTypes),
        missingDescription: Object.freeze(pkgs.filter((p) => p.description.trim() === "").map((p) => p.name)),
        missingLicense: Object.freeze(pkgs.filter((p) => p.manifest.license === null).map((p) => p.name)),
        driftCount: drift.length,
        driftNames: Object.freeze(drift.map((d) => d.name)),
    };
}
