const TYPE_KINDS = new Set(["class", "interface", "type-alias"]);
const typeId = (name) => `type:${name}`;
const fnId = (name) => `fn:${name}`;
// Pull the identifier tokens out of a type expression. `readonly Foo[]` →
// ["readonly","Foo"]; `Map<string, Bar>` → ["Map","string","Bar"]. Intersecting
// these with the package's own type names is how a structured type reference is
// resolved back to an internal object without a full type parser.
const IDENT = /[A-Za-z_$][A-Za-z0-9_$]*/g;
const identsOf = (typeExpr) => typeExpr.match(IDENT) ?? [];
/** Project the type index onto one package's internal symbol graph. */
export function packageSymbolGraph(index, pkg) {
    // Type objects, deduplicated by name (the index attributes a name once per
    // declaring file; a re-export can list it twice). First kind seen wins.
    const typeKind = new Map();
    for (const t of index.types) {
        if (t.pkg !== pkg || !TYPE_KINDS.has(t.kind))
            continue;
        if (!typeKind.has(t.name))
            typeKind.set(t.name, t.kind);
    }
    const fnInfo = new Map();
    for (const f of index.functions) {
        if (f.pkg !== pkg || fnInfo.has(f.name))
            continue;
        fnInfo.set(f.name, f.codomain === undefined ? { domain: f.domain } : { domain: f.domain, codomain: f.codomain });
    }
    const sourceByName = new Map();
    for (const value of [...index.types, ...index.functions]) {
        if (value.pkg === pkg && value.source && !sourceByName.has(value.name))
            sourceByName.set(value.name, value.source);
    }
    const evidence = (name) => {
        const source = sourceByName.get(name);
        return source ? { source } : {};
    };
    const nodes = [];
    for (const [name, kind] of typeKind)
        nodes.push({ id: typeId(name), name, kind, ...evidence(name) });
    for (const [name, info] of fnInfo) {
        const dom = info.domain.map((d) => d.replace(/\s+/g, " ").trim()).join(", ");
        const sig = `${name}(${dom})${info.codomain ? ` → ${info.codomain.replace(/\s+/g, " ").trim()}` : ""}`;
        nodes.push({ id: fnId(name), name, kind: "function", signature: sig, ...evidence(name) });
    }
    // Edges, deduplicated by (from, to, kind).
    const seen = new Set();
    const edges = [];
    const add = (from, to, kind) => {
        if (from === to)
            return;
        const key = `${from}|${to}|${kind}`;
        if (seen.has(key))
            return;
        seen.add(key);
        edges.push({ from, to, kind });
    };
    for (const [name, info] of fnInfo) {
        for (const d of info.domain) {
            for (const id of identsOf(d))
                if (typeKind.has(id))
                    add(typeId(id), fnId(name), "param");
        }
        if (info.codomain) {
            for (const id of identsOf(info.codomain))
                if (typeKind.has(id))
                    add(fnId(name), typeId(id), "returns");
        }
    }
    for (const s of index.subtypes) {
        if (s.pkg !== pkg)
            continue;
        if (typeKind.has(s.sub) && typeKind.has(s.base))
            add(typeId(s.sub), typeId(s.base), "extends");
    }
    return { pkg, nodes, edges, populated: nodes.length > 0 };
}
