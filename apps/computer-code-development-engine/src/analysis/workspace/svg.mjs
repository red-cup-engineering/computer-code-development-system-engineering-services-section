import { layoutGraph, LAYOUT_DEFAULTS } from "./layout.mjs";
// Resolve render options into a full layout geometry, falling back to defaults.
function geometryFrom(opts) {
    return {
        nodeWidth: opts.nodeWidth ?? LAYOUT_DEFAULTS.nodeWidth,
        nodeHeight: opts.nodeHeight ?? LAYOUT_DEFAULTS.nodeHeight,
        hGap: opts.hGap ?? LAYOUT_DEFAULTS.hGap,
        vGap: opts.vGap ?? LAYOUT_DEFAULTS.vGap,
        margin: opts.margin ?? LAYOUT_DEFAULTS.margin,
        sweeps: opts.sweeps ?? LAYOUT_DEFAULTS.sweeps,
    };
}
/** Lay the dependency graph out in the plane. Pure geometry — no SVG. Rank 0
 *  (the roots nothing depends on) forms the canopy at the top; each node's
 *  `depth` is its row from there, so foundations sink to the base and edges flow
 *  downward from dependent to dependency. Thin wrapper over the shared
 *  `layoutGraph`: the dependency edge (dependent → dependency) becomes a layout
 *  edge, so the dependency receives the incoming edge and ranks below. */
export function layoutDependencyGraph(graph, opts = {}) {
    const geom = layoutGraph(graph.nodes.map((n) => n.name), graph.edges, geometryFrom(opts));
    const placed = [];
    for (const node of graph.nodes) {
        const p = geom.points.get(node.name);
        if (p)
            placed.push({ node, depth: p.rank, cx: p.cx, cy: p.cy });
    }
    return {
        nodes: placed,
        edges: graph.edges,
        width: geom.width,
        height: geom.height,
        maxDepth: geom.maxRank,
    };
}
// Per-stratum fill/stroke. The four repo strata get four hues; an unknown
// layer falls back to the lib palette.
const LAYER_FILL = {
    lib: "#1b3a4b",
    apps: "#4b1b3a",
    services: "#3a4b1b",
    sites: "#4b3a1b",
    ops: "#3a3a3a",
};
const LAYER_STROKE = {
    lib: "#3f7d9c",
    apps: "#9c3f7d",
    services: "#7d9c3f",
    sites: "#9c7d3f",
    ops: "#7d7d7d",
};
const xmlEscape = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Truncate a label to fit the box; the full name lives in the <title>.
const fitLabel = (name, nodeWidth) => {
    const max = Math.floor((nodeWidth - 12) / 7); // ~7px per char at 12px mono
    return name.length <= max ? name : name.slice(0, max - 1) + "…";
};
/** Render the dependency graph to a clickable, self-describing SVG string. */
export function dependencyGraphSvg(graph, opts = {}) {
    const nodeWidth = opts.nodeWidth ?? LAYOUT_DEFAULTS.nodeWidth;
    const nodeHeight = opts.nodeHeight ?? LAYOUT_DEFAULTS.nodeHeight;
    const layout = layoutDependencyGraph(graph, opts);
    const pos = new Map(layout.nodes.map((p) => [p.node.name, p]));
    const title = opts.title ?? "workspace dependency DAG";
    const byLayer = layout.nodes.reduce((acc, p) => {
        acc[p.node.layer] = (acc[p.node.layer] ?? 0) + 1;
        return acc;
    }, {});
    const desc = `${layout.nodes.length} packages, ${layout.edges.length} internal dependency edges, ` +
        `${layout.maxDepth + 1} layers. By stratum: ` +
        Object.entries(byLayer).map(([l, n]) => `${l} ${n}`).join(", ") + ".";
    const lines = [];
    lines.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}" ` +
        `width="${layout.width}" height="${layout.height}" font-family="ui-monospace,Menlo,monospace" role="img">`);
    lines.push(`<title>${xmlEscape(title)}</title>`);
    lines.push(`<desc>${xmlEscape(desc)}</desc>`);
    lines.push(`<rect x="0" y="0" width="${layout.width}" height="${layout.height}" fill="#0d1117"/>`);
    lines.push(`<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">` +
        `<path d="M0,0 L10,5 L0,10 z" fill="#3a4452"/></marker></defs>`);
    // Edges first, behind the nodes. Dependent (from) → dependency (to), drawn
    // from the bottom of the dependent to the top of the dependency.
    lines.push(`<g stroke="#3a4452" stroke-width="1" fill="none" opacity="0.55">`);
    for (const e of layout.edges) {
        const a = pos.get(e.from);
        const b = pos.get(e.to);
        if (!a || !b)
            continue;
        const x1 = a.cx, y1 = a.cy + nodeHeight / 2;
        const x2 = b.cx, y2 = b.cy - nodeHeight / 2;
        const my = (y1 + y2) / 2;
        lines.push(`<path d="M${x1.toFixed(1)},${y1.toFixed(1)} C${x1.toFixed(1)},${my.toFixed(1)} ` +
            `${x2.toFixed(1)},${my.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}" ` +
            `data-from="${xmlEscape(e.from)}" data-to="${xmlEscape(e.to)}" marker-end="url(#arrow)"/>`);
    }
    lines.push(`</g>`);
    // Nodes, grouped by layer for legibility in the markup.
    for (let d = layout.maxDepth; d >= 0; d--) {
        const inLayer = layout.nodes.filter((p) => p.depth === d);
        if (!inLayer.length)
            continue;
        lines.push(`<g data-depth="${d}">`);
        for (const p of inLayer) {
            const n = p.node;
            const x = p.cx - nodeWidth / 2;
            const y = p.cy - nodeHeight / 2;
            const fill = LAYER_FILL[n.layer] ?? LAYER_FILL.lib;
            const isFocus = opts.focus !== undefined && n.name === opts.focus;
            // The focus node of an ego graph gets a bright outline so the eye lands on
            // it; data-focus marks it for agents reading the markup.
            const stroke = isFocus ? "#f0f6fc" : (LAYER_STROKE[n.layer] ?? LAYER_STROKE.lib);
            const strokeWidth = isFocus ? 3 : 1.5;
            const titleText = n.description ? `${n.name} — ${n.description}` : n.name;
            const href = opts.href?.(n);
            const open = href ? `<a href="${xmlEscape(href)}" target="_top">` : "";
            const close = href ? `</a>` : "";
            lines.push(`${open}<g class="node" data-name="${xmlEscape(n.name)}" data-layer="${n.layer}" data-deps="${n.dependencies.length}"${isFocus ? ` data-focus="true"` : ""}>` +
                `<title>${xmlEscape(titleText)}</title>` +
                `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${nodeWidth}" height="${nodeHeight}" rx="4" ` +
                `fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>` +
                `<text x="${p.cx.toFixed(1)}" y="${(p.cy + 4).toFixed(1)}" text-anchor="middle" ` +
                `font-size="12" fill="#e6edf3">${xmlEscape(fitLabel(n.name, nodeWidth))}</text>` +
                `</g>${close}`);
        }
        lines.push(`</g>`);
    }
    lines.push(`</svg>`);
    return lines.join("\n");
}
