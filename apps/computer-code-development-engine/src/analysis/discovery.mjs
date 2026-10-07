import { readMarkdownSource, projectMarkdownStructure } from "@red-cup-engineering/markdown-engineering-services-section/read-markdown-structure";
/**
 * discovery — three tree-wide indices `service.mts` builds lazily off
 * `config.root`, mirroring `ensureAtlas`'s held-cache pattern: the glossary
 * index (`jsnode_term`), the section index (`jsnode_section`), and the
 * fabrication-records graph (`jsnode_fabrication_records`, reusing
 * `listFabricationRecords`, joined to the package graph). Each walk is
 * pruned to the directories that can hold what it looks for.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { readMarkdownFrontmatter } from "@red-cup-engineering/markdown-engineering-services-section/read-markdown-frontmatter";
import { recognizeTermMarkdown } from "@red-cup-engineering/term-engineering-services-section/carrier";
import { listFabricationRecords } from "@red-cup-engineering/jsnode-package-services-section/fabrication-records";
const GLOSSARY_KIND_BY_DIR = { terms: "term", concepts: "concept", topics: "topic" };
// Never present under lib/scripts/src/data/apps/test; pruning these keeps the
// walk to directories a glossary or a nested section can actually live
// under, instead of re-reading the whole tree.
const GLOSSARY_PRUNE = new Set(["node_modules", "src", "scripts", "apps", "test", "data"]);
function readGlossaryEntry(absPath, kind) {
    const filename = basename(absPath);
    const identity = filename.slice(0, -3);
    let text = "";
    try {
        text = readFileSync(absPath, "utf8");
    }
    catch {
        // Unreadable carrier: still indexed by filename identity, every other field absent.
    }
    let frontmatter = {};
    try {
        const parsed = readMarkdownFrontmatter(text, { absentFrontmatter: "empty" });
        frontmatter = (parsed.frontmatter ?? {});
    }
    catch {
        // Malformed frontmatter: fall through with an empty record.
    }
    const name = typeof frontmatter["name"] === "string" ? frontmatter["name"] : undefined;
    const description = typeof frontmatter["description"] === "string" ? frontmatter["description"] : undefined;
    const aliasesRaw = frontmatter["aliases"];
    const aliases = Array.isArray(aliasesRaw) ? Object.freeze(aliasesRaw.filter((a) => typeof a === "string")) : Object.freeze([]);
    let admitted = null;
    let findings = null;
    try {
        const recognized = recognizeTermMarkdown({ text, filename });
        admitted = recognized.admitted;
        findings = recognized.findings.length;
    }
    catch {
        // Recognizer refused to run over this carrier (may not be a term at all); leave both null.
    }
    return Object.freeze({
        path: absPath, kind, identity, name, description, aliases,
        underLegacy: absPath.includes("/lib/legacy/"),
        admitted, findings,
    });
}
function collectGlossaryCategoryDir(absDir, kind, out) {
    let entries;
    try {
        entries = readdirSync(absDir, { withFileTypes: true });
    }
    catch {
        return;
    }
    for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith(".md"))
            out.push(readGlossaryEntry(join(absDir, entry.name), kind));
    }
}
// The fixed shapes a glossary sits at beneath a section's content/: the
// current content/text/glossary/<kind> and the legacy-seat
// content/glossary/<kind> (pre-dating the text/ reorganisation).
function collectContentGlossaries(contentDir, out) {
    for (const base of ["text/glossary", "glossary"]) {
        for (const [dirName, kind] of Object.entries(GLOSSARY_KIND_BY_DIR)) {
            const candidate = join(contentDir, base, dirName);
            if (existsSync(candidate))
                collectGlossaryCategoryDir(candidate, kind, out);
        }
    }
}
/** Walks `root` for every glossary carrier in the tree, pruned to the
 *  directories a glossary or a nested section can live under. */
export function buildGlossaryIndex(root) {
    const out = [];
    const pending = [resolve(root)];
    while (pending.length > 0) {
        const dir = pending.pop();
        let entries;
        try {
            entries = readdirSync(dir, { withFileTypes: true });
        }
        catch {
            continue;
        }
        for (const entry of entries) {
            if (!entry.isDirectory() || entry.name.startsWith("."))
                continue;
            if (GLOSSARY_PRUNE.has(entry.name))
                continue;
            const childPath = join(dir, entry.name);
            if (entry.name === "content") {
                collectContentGlossaries(childPath, out);
                continue; // glossaries sit at a fixed shallow depth; no need to walk the rest of content/
            }
            pending.push(childPath);
        }
    }
    return Object.freeze(out);
}
/** Resolves `name` against a built glossary index by identity, then
 *  frontmatter name, then alias (case-insensitive exact match on each), with
 *  `lib/legacy` carriers excluded unless `includeLegacy` is set. */
export function resolveGlossaryTerm(index, name, { includeLegacy = false } = {}) {
    const needle = name.trim().toLowerCase();
    const pool = includeLegacy ? index : index.filter((entry) => !entry.underLegacy);
    const matches = [];
    for (const entry of pool) {
        if (entry.identity.toLowerCase() === needle)
            matches.push({ ...entry, matchedBy: "identity" });
        else if (entry.name !== undefined && entry.name.toLowerCase() === needle)
            matches.push({ ...entry, matchedBy: "name" });
        else if (entry.aliases.some((alias) => alias.toLowerCase() === needle))
            matches.push({ ...entry, matchedBy: "alias" });
    }
    return Object.freeze(matches);
}
// Directories a *-services-section can never nest beneath (only services/
// nests one section under another), pruned the same way the glossary walk
// prunes content/'s interior.
const SECTION_PRUNE = new Set(["node_modules", "content", "data", "src", "scripts", "apps", "test"]);
const SECTION_SKIP_ALWAYS = new Set(["node_modules", ".git", ".tmp", "dist"]);
// services/ and lib/ are where a section nests its children and its legacy
// seat; a section's OWN entries stop one level into each, never descending
// into a child section's own subtree (folded separately when that child is
// itself indexed).
const SECTION_OWN_ENTRIES_ONE_LEVEL = new Set(["services", "lib"]);
function firstMarkdownParagraph(markdown) {
    const source = readMarkdownSource(markdown);
    const excluded = new Set();
    for (const heading of projectMarkdownStructure(source).headings) {
        for (let line = heading.line; line <= heading.declarationEndLine; line += 1)
            excluded.add(line);
    }
    for (const range of source.codeRanges) {
        if (range.type !== "fenced-code")
            continue;
        for (let line = range.startLine; line <= range.endLine; line += 1)
            excluded.add(line);
    }
    const paragraph = [];
    for (const [index, line] of source.lines.entries()) {
        if (index < source.bodyStartLine - 1)
            continue;
        if (excluded.has(index + 1) || line.trim() === "") {
            if (paragraph.length > 0)
                return paragraph.join(" ").replace(/\s+/gu, " ");
        }
        else
            paragraph.push(line.trim());
    }
    if (paragraph.length > 0)
        return paragraph.join(" ").replace(/\s+/gu, " ");
    return undefined;
}
function walkFully(dir, prefix, out) {
    let entries;
    try {
        entries = readdirSync(dir, { withFileTypes: true });
    }
    catch {
        return;
    }
    for (const entry of entries) {
        if (SECTION_SKIP_ALWAYS.has(entry.name))
            continue;
        const rel = prefix + entry.name;
        if (entry.isDirectory()) {
            out.push(`${rel}/`);
            walkFully(join(dir, entry.name), `${rel}/`, out);
        }
        else {
            out.push(rel);
        }
    }
}
/** The relative entries a section OWNS directly: its own README/package.json
 *  and the full interior of its own content/data/src/scripts/apps/test, but
 *  only the immediate child names under services/ and lib/ (those lead into
 *  other sections' own subtrees, indexed separately). Directories carry a
 *  trailing "/". */
function listSectionOwnEntries(absSectionPath) {
    const entries = [];
    let top;
    try {
        top = readdirSync(absSectionPath, { withFileTypes: true });
    }
    catch {
        return Object.freeze(entries);
    }
    for (const entry of top) {
        if (SECTION_SKIP_ALWAYS.has(entry.name))
            continue;
        if (entry.isFile()) {
            entries.push(entry.name);
            continue;
        }
        if (!entry.isDirectory())
            continue;
        entries.push(`${entry.name}/`);
        if (SECTION_OWN_ENTRIES_ONE_LEVEL.has(entry.name)) {
            let children;
            try {
                children = readdirSync(join(absSectionPath, entry.name), { withFileTypes: true });
            }
            catch {
                children = [];
            }
            for (const child of children) {
                if (SECTION_SKIP_ALWAYS.has(child.name))
                    continue;
                entries.push(`${entry.name}/${child.name}${child.isDirectory() ? "/" : ""}`);
            }
            continue;
        }
        walkFully(join(absSectionPath, entry.name), `${entry.name}/`, entries);
    }
    return Object.freeze(entries);
}
function sectionEntryFor(absSectionPath) {
    const entries = listSectionOwnEntries(absSectionPath);
    const packageJsonPath = join(absSectionPath, "package.json");
    let packageJson = null;
    if (existsSync(packageJsonPath)) {
        try {
            const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8"));
            if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed))
                packageJson = parsed;
        }
        catch {
            packageJson = null;
        }
    }
    let readmeFirstParagraph;
    const readmePath = join(absSectionPath, "README.md");
    if (existsSync(readmePath)) {
        try {
            readmeFirstParagraph = firstMarkdownParagraph(readFileSync(readmePath, "utf8"));
        }
        catch {
            readmeFirstParagraph = undefined;
        }
    }
    const children = entries.filter((entry) => entry.endsWith("/") && !entry.slice(0, -1).includes("/")).map((entry) => entry.slice(0, -1));
    return Object.freeze({
        path: absSectionPath,
        name: basename(absSectionPath),
        readmeFirstParagraph,
        children: Object.freeze(children),
        entries,
        packageJson: packageJson === null ? null : Object.freeze(packageJson),
    });
}
/** Walks `root` for every `*-services-section` directory, pruned to the
 *  directories a section can nest beneath (only `services/`), excluding
 *  `node_modules` and any `lib/legacy` subtree. */
export function buildSectionIndex(root) {
    const sectionPaths = [];
    const pending = [resolve(root)];
    while (pending.length > 0) {
        const dir = pending.pop();
        let entries;
        try {
            entries = readdirSync(dir, { withFileTypes: true });
        }
        catch {
            continue;
        }
        for (const entry of entries) {
            if (!entry.isDirectory() || entry.name.startsWith("."))
                continue;
            if (SECTION_PRUNE.has(entry.name))
                continue;
            if (entry.name === "legacy" && basename(dir) === "lib")
                continue;
            const childPath = join(dir, entry.name);
            if (entry.name.endsWith("-services-section"))
                sectionPaths.push(childPath);
            pending.push(childPath);
        }
    }
    return Object.freeze(sectionPaths.map(sectionEntryFor));
}
/** Splits a `*-services-section` directory name into its significant words:
 *  hyphen-split, minus the trailing `services`/`section` boilerplate. */
function significantNameWords(name) {
    return Object.freeze(name.replace(/-services-section$/u, "").split("-").filter((word) => word.length > 0));
}
function scoreSectionEntry(entry, queryWords) {
    const significant = significantNameWords(entry.name).map((word) => word.toLowerCase());
    const matchedCount = queryWords.filter((word) => significant.includes(word)).length;
    const ratio = significant.length > 0 ? matchedCount / significant.length : 0;
    const exact = significant.join(" ") === queryWords.join(" ");
    const readmeText = (entry.readmeFirstParagraph ?? "").toLowerCase();
    const readmeMatchCount = queryWords.filter((word) => readmeText.includes(word)).length;
    return (exact ? 1_000_000 : 0) + matchedCount * 1000 + ratio * 100 + readmeMatchCount * 10;
}
/** Scores every section in `index` against `query`'s words (name match >
 *  README first-paragraph match), returning the ranked hits. `limit`
 *  defaults to 10 and caps `sections`; `count` is the full match total. */
export function searchSections(index, query, limit = 10) {
    const words = query.toLowerCase().split(/\s+/u).filter((word) => word.length > 0);
    const scored = index
        .map((entry) => ({ entry, score: scoreSectionEntry(entry, words) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score || a.entry.path.localeCompare(b.entry.path));
    return Object.freeze({
        count: scored.length,
        sections: Object.freeze(scored.slice(0, limit).map(({ entry, score }) => Object.freeze({ ...entry, score }))),
    });
}
// ---------------------------------------------------------------------------
// jsnode_fabrication_records — the fabrication graph, joined to packages
// ---------------------------------------------------------------------------
// listFabricationRecords's own default (200) is well under the tree's real
// work-order-plus-receipt count; this tool trades that walk's own cap for
// the whole graph by default, still overridable by an explicit limit.
const DEFAULT_FABRICATION_RECORDS_LIMIT = 5000;
/** `listFabricationRecords`'s own walk (work orders under `specifications/`,
 *  receipts under `data/records/*fabrication-receipt.json`), joined to the
 *  package graph by each receipt's birthed `packageName`. */
export function fabricationRecordsGraph(root, packages, limit) {
    const walked = listFabricationRecords(root, { limit: limit ?? DEFAULT_FABRICATION_RECORDS_LIMIT });
    const packageByName = new Map(packages.map((pkg) => [pkg.name, pkg]));
    const receipts = walked.receipts.map((receipt) => {
        const packageName = receipt["packageName"];
        const pkg = typeof packageName === "string" ? packageByName.get(packageName) : undefined;
        return Object.freeze({ ...receipt, package: pkg === undefined ? null : Object.freeze({ name: pkg.name, version: pkg.version, layer: pkg.layer }) });
    });
    return Object.freeze({
        kind: walked.kind,
        root: walked.root,
        receipts: Object.freeze(receipts),
        workOrders: walked.workOrders,
        joinedCount: receipts.filter((receipt) => receipt.package !== null).length,
    });
}
//# sourceMappingURL=discovery.mjs.map
