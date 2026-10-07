const KIND_ORDER = ["runtime", "dev", "peer", "optional"];
const kindRank = (k) => KIND_ORDER.indexOf(k);
/** Read every declared dependency across the workspace into one report: who
 *  declares what, at which ranges, and where those ranges diverge. Convention
 *  agnostic — it reads `pkg.deps`, nothing about names. */
export function workspaceDependencies(workspace) {
    const internalNames = new Set(workspace.packages.map((p) => p.name));
    const byName = new Map();
    for (const pkg of workspace.packages) {
        for (const d of pkg.deps) {
            (byName.get(d.name) ?? byName.set(d.name, []).get(d.name)).push({
                by: pkg.name,
                range: d.range,
                kind: d.kind,
            });
        }
    }
    const entries = [...byName.entries()].map(([name, uses]) => {
        uses.sort((a, b) => kindRank(a.kind) - kindRank(b.kind) || a.by.localeCompare(b.by));
        const ranges = [...new Set(uses.map((u) => u.range))].sort();
        const kinds = [...new Set(uses.map((u) => u.kind))].sort((a, b) => kindRank(a) - kindRank(b));
        return {
            name,
            internal: internalNames.has(name),
            uses: Object.freeze(uses),
            usedBy: new Set(uses.map((u) => u.by)).size,
            ranges: Object.freeze(ranges),
            drift: ranges.length > 1,
            kinds: Object.freeze(kinds),
        };
    });
    // External first (the registry surface a reader cares about most), then
    // internal; within each band, most-used first then alphabetical.
    entries.sort((a, b) => Number(a.internal) - Number(b.internal) ||
        b.usedBy - a.usedBy ||
        a.name.localeCompare(b.name));
    const drift = entries
        .filter((e) => e.drift)
        .sort((a, b) => b.ranges.length - a.ranges.length || a.name.localeCompare(b.name));
    return {
        kind: "jsnode.dependencies",
        entries: Object.freeze(entries),
        externalCount: entries.filter((e) => !e.internal).length,
        internalCount: entries.filter((e) => e.internal).length,
        drift: Object.freeze(drift),
        total: entries.length,
    };
}
