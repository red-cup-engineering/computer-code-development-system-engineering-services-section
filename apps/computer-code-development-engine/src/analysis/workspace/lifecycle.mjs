const LIFECYCLES = ["active", "maintenance", "deprecated", "abandoned"];
const MATURITIES = ["experimental", "alpha", "beta", "stable"];
export function workspaceLifecycle(graph) {
    const lifeOf = new Map();
    const matOf = new Map();
    const dependents = new Map();
    for (const n of graph.nodes) {
        lifeOf.set(n.name, n.lifecycle);
        matOf.set(n.name, n.maturity);
        dependents.set(n.name, []);
    }
    for (const e of graph.edges) {
        if (dependents.has(e.to))
            dependents.get(e.to).push(e.from);
    }
    const byLifecycle = Object.fromEntries(LIFECYCLES.map((l) => [l, []]));
    const byMaturity = Object.fromEntries(MATURITIES.map((m) => [m, []]));
    for (const n of graph.nodes) {
        byLifecycle[n.lifecycle].push(n.name);
        byMaturity[n.maturity].push(n.name);
    }
    for (const l of LIFECYCLES)
        byLifecycle[l].sort();
    for (const m of MATURITIES)
        byMaturity[m].sort();
    const memberOf = (name) => {
        const deps = (dependents.get(name) ?? []).slice().sort();
        return {
            name,
            lifecycle: lifeOf.get(name) ?? "active",
            maturity: matOf.get(name) ?? "experimental",
            dependents: Object.freeze(deps),
            activeDependents: Object.freeze(deps.filter((d) => (lifeOf.get(d) ?? "active") === "active")),
        };
    };
    const deprecated = byLifecycle.deprecated
        .map(memberOf)
        .sort((a, b) => b.activeDependents.length - a.activeDependents.length || a.name.localeCompare(b.name));
    const abandoned = byLifecycle.abandoned
        .map(memberOf)
        .sort((a, b) => b.dependents.length - a.dependents.length || a.name.localeCompare(b.name));
    const deprecatedSet = new Set(byLifecycle.deprecated);
    const migrationDebt = [];
    for (const e of graph.edges) {
        if (deprecatedSet.has(e.to) && (lifeOf.get(e.from) ?? "active") === "active") {
            migrationDebt.push({ from: e.from, to: e.to });
        }
    }
    migrationDebt.sort((a, b) => a.to.localeCompare(b.to) || a.from.localeCompare(b.from));
    return {
        kind: "jsnode.lifecycle",
        packageCount: graph.nodes.length,
        byLifecycle: Object.freeze(Object.fromEntries(LIFECYCLES.map((l) => [l, Object.freeze(byLifecycle[l])]))),
        byMaturity: Object.freeze(Object.fromEntries(MATURITIES.map((m) => [m, Object.freeze(byMaturity[m])]))),
        deprecated: Object.freeze(deprecated),
        abandoned: Object.freeze(abandoned),
        migrationDebt: Object.freeze(migrationDebt),
        activeCount: byLifecycle.active.length,
    };
}
