export const LAYOUT_DEFAULTS = {
    nodeWidth: 184,
    nodeHeight: 26,
    hGap: 22,
    vGap: 78,
    margin: 32,
    sweeps: 6,
};
// Longest path along incoming edges. Memoized, with an on-stack guard so a
// cycle can't recurse forever — a back-edge contributes no rank.
function rankByLongestPath(ids, edges) {
    const incoming = new Map(); // node -> nodes with an edge into it
    for (const id of ids)
        incoming.set(id, []);
    for (const e of edges)
        incoming.get(e.to)?.push(e.from);
    const rank = new Map();
    const onStack = new Set();
    const visit = (id) => {
        const cached = rank.get(id);
        if (cached !== undefined)
            return cached;
        if (onStack.has(id))
            return 0; // cycle edge — no contribution
        onStack.add(id);
        let r = 0;
        for (const m of incoming.get(id) ?? [])
            r = Math.max(r, 1 + visit(m));
        onStack.delete(id);
        rank.set(id, r);
        return r;
    };
    for (const id of ids)
        visit(id);
    return rank;
}
// Group ids into rows by rank, preserving input order within a row.
function rowsByRank(ids, rank, maxRank) {
    const rows = Array.from({ length: maxRank + 1 }, () => []);
    for (const id of ids)
        rows[rank.get(id) ?? 0].push(id);
    return rows;
}
// Barycenter ordering: alternately sweep down and up, reordering each row so a
// node sits near the average slot of its neighbours in the adjacent row. The
// adjacency is undirected — an adjacent row only ever holds one edge direction,
// so slot-filtering against the neighbour row picks the right neighbours either
// way. Cheap crossing-reduction, good enough at this scale.
function orderRows(rows, edges, sweeps) {
    const adj = new Map();
    const link = (a, b) => {
        (adj.get(a) ?? adj.set(a, []).get(a)).push(b);
    };
    for (const e of edges) {
        link(e.from, e.to);
        link(e.to, e.from);
    }
    const slotOf = (row) => new Map(row.map((id, i) => [id, i]));
    const sweep = (neighbourRow, row) => {
        const slot = slotOf(neighbourRow);
        const bary = new Map();
        row.forEach((id, i) => {
            const ns = (adj.get(id) ?? []).map((m) => slot.get(m)).filter((v) => v !== undefined);
            bary.set(id, ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : i);
        });
        row.sort((a, b) => bary.get(a) - bary.get(b) || a.localeCompare(b));
    };
    for (let s = 0; s < sweeps; s++) {
        if (s % 2 === 0) {
            for (let d = 1; d < rows.length; d++)
                sweep(rows[d - 1], rows[d]);
        }
        else {
            for (let d = rows.length - 2; d >= 0; d--)
                sweep(rows[d + 1], rows[d]);
        }
    }
}
/** Lay a graph out in the plane. Pure geometry — no SVG, no node payloads.
 *  Rank 0 (sources) sits at the top; rows centre horizontally; the caller maps
 *  its own nodes onto the returned points by id. */
export function layoutGraph(ids, edges, geom = LAYOUT_DEFAULTS) {
    const { nodeWidth, nodeHeight, hGap, vGap, margin, sweeps } = geom;
    const rank = rankByLongestPath(ids, edges);
    const maxRank = ids.reduce((m, id) => Math.max(m, rank.get(id) ?? 0), 0);
    const rows = rowsByRank(ids, rank, maxRank);
    orderRows(rows, edges, sweeps);
    const stepX = nodeWidth + hGap;
    const stepY = nodeHeight + vGap;
    const widest = rows.reduce((m, r) => Math.max(m, r.length), 1);
    const innerWidth = widest * stepX - hGap;
    const points = new Map();
    for (let d = 0; d <= maxRank; d++) {
        const row = rows[d];
        const rowWidth = row.length * stepX - hGap;
        const startX = margin + (innerWidth - rowWidth) / 2;
        const cy = margin + d * stepY + nodeHeight / 2;
        row.forEach((id, i) => {
            points.set(id, { rank: d, cx: startX + i * stepX + nodeWidth / 2, cy });
        });
    }
    const width = innerWidth + 2 * margin;
    const height = (maxRank + 1) * stepY - vGap + 2 * margin;
    return { points, maxRank, width, height };
}
