import { layoutGraph, LAYOUT_DEFAULTS } from "./layout.mjs";
// Per-kind fill/stroke. Four kinds, four hues, distinct from the dependency
// graph's stratum palette so the two pictures never read as the same thing.
const KIND_FILL = {
    class: "#16324a",
    interface: "#143a2e",
    "type-alias": "#3a2e14",
    function: "#2e163a",
};
const KIND_STROKE = {
    class: "#4493c8",
    interface: "#3fae7d",
    "type-alias": "#c89a44",
    function: "#a96fd0",
};
const xmlEscape = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fitLabel = (name, nodeWidth) => {
    const max = Math.floor((nodeWidth - 16) / 7);
    return name.length <= max ? name : name.slice(0, max - 1) + "…";
};
// The shape for a node's kind, as one SVG element. Sharp rect = class; rounded
// dashed = interface; parallelogram = type alias; stadium = function.
function shapeMarkup(kind, x, y, w, h) {
    const fill = KIND_FILL[kind];
    const stroke = KIND_STROKE[kind];
    const base = `fill="${fill}" stroke="${stroke}" stroke-width="1.5"`;
    const X = (n) => n.toFixed(1);
    switch (kind) {
        case "class":
            return `<rect x="${X(x)}" y="${X(y)}" width="${X(w)}" height="${X(h)}" ${base}/>`;
        case "interface":
            return `<rect x="${X(x)}" y="${X(y)}" width="${X(w)}" height="${X(h)}" rx="13" ry="13" stroke-dasharray="5 3" ${base}/>`;
        case "type-alias": {
            const s = Math.min(12, w / 4);
            const pts = `${X(x + s)},${X(y)} ${X(x + w)},${X(y)} ${X(x + w - s)},${X(y + h)} ${X(x)},${X(y + h)}`;
            return `<polygon points="${pts}" ${base}/>`;
        }
        case "function":
            return `<rect x="${X(x)}" y="${X(y)}" width="${X(w)}" height="${X(h)}" rx="${X(h / 2)}" ry="${X(h / 2)}" ${base}/>`;
    }
}
function geometryFrom(opts) {
    return {
        nodeWidth: opts.nodeWidth ?? 150,
        nodeHeight: opts.nodeHeight ?? 30,
        hGap: opts.hGap ?? 26,
        vGap: opts.vGap ?? 64,
        margin: opts.margin ?? LAYOUT_DEFAULTS.margin,
        sweeps: opts.sweeps ?? LAYOUT_DEFAULTS.sweeps,
    };
}
const titleOf = (n) => n.kind === "function" ? (n.signature ?? `${n.name}()`) : `${n.name} — ${n.kind}`;
/** Render a package's symbol graph to a self-describing, shaped SVG string. */
export function symbolGraphSvg(graph, opts = {}) {
    const geom = geometryFrom(opts);
    const { nodeWidth, nodeHeight } = geom;
    const placed = layoutGraph(graph.nodes.map((n) => n.id), graph.edges, geom);
    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    const title = opts.title ?? `${graph.pkg} — symbol graph`;
    const byKind = graph.nodes.reduce((a, n) => ((a[n.kind] = (a[n.kind] ?? 0) + 1), a), {});
    const desc = `${graph.nodes.length} symbols, ${graph.edges.length} relations. ` +
        `By kind: ${Object.entries(byKind).map(([k, n]) => `${k} ${n}`).join(", ")}. ` +
        `Shapes: rectangle = class, rounded-dashed = interface, parallelogram = type alias, ` +
        `pill = function. Edges: type→function = parameter, function→type = return, ` +
        `dashed = subtype extends base.`;
    const lines = [];
    lines.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${placed.width} ${placed.height}" ` +
        `width="${placed.width}" height="${placed.height}" font-family="ui-monospace,Menlo,monospace" role="img">`);
    lines.push(`<title>${xmlEscape(title)}</title>`);
    lines.push(`<desc>${xmlEscape(desc)}</desc>`);
    lines.push(`<rect x="0" y="0" width="${placed.width}" height="${placed.height}" fill="#0d1117"/>`);
    lines.push(`<defs>` +
        `<marker id="sg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">` +
        `<path d="M0,0 L10,5 L0,10 z" fill="#5a6472"/></marker>` +
        `<marker id="sg-tri" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="11" markerHeight="11" orient="auto-start-reverse">` +
        `<path d="M0,0 L12,6 L0,12 z" fill="#0d1117" stroke="#8b949e" stroke-width="1"/></marker>` +
        `</defs>`);
    // Edges first, behind the nodes.
    lines.push(`<g fill="none">`);
    for (const e of graph.edges) {
        const a = placed.points.get(e.from);
        const b = placed.points.get(e.to);
        if (!a || !b)
            continue;
        const x1 = a.cx, y1 = a.cy + nodeHeight / 2;
        const x2 = b.cx, y2 = b.cy - nodeHeight / 2;
        const my = (y1 + y2) / 2;
        const dashed = e.kind === "extends";
        const marker = e.kind === "extends" ? "url(#sg-tri)" : "url(#sg-arrow)";
        const stroke = e.kind === "returns" ? "#7d6fa9" : e.kind === "param" ? "#4f7da0" : "#8b949e";
        lines.push(`<path d="M${x1.toFixed(1)},${y1.toFixed(1)} C${x1.toFixed(1)},${my.toFixed(1)} ${x2.toFixed(1)},${my.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}" ` +
            `stroke="${stroke}" stroke-width="1.2" opacity="0.7"${dashed ? ` stroke-dasharray="5 3"` : ""} ` +
            `data-from="${xmlEscape(e.from)}" data-to="${xmlEscape(e.to)}" data-kind="${e.kind}" marker-end="${marker}"/>`);
    }
    lines.push(`</g>`);
    // Nodes on top.
    for (const n of graph.nodes) {
        const p = placed.points.get(n.id);
        if (!p)
            continue;
        const x = p.cx - nodeWidth / 2;
        const y = p.cy - nodeHeight / 2;
        lines.push(`<g class="symbol" data-name="${xmlEscape(n.name)}" data-kind="${n.kind}">` +
            `<title>${xmlEscape(titleOf(n))}</title>` +
            shapeMarkup(n.kind, x, y, nodeWidth, nodeHeight) +
            `<text x="${p.cx.toFixed(1)}" y="${(p.cy + 4).toFixed(1)}" text-anchor="middle" font-size="12" fill="#e6edf3">` +
            `${xmlEscape(fitLabel(n.name, nodeWidth))}</text>` +
            `</g>`);
    }
    lines.push(`</svg>`);
    return lines.join("\n");
}
