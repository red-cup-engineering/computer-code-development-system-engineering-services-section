/**
 * journal — one JSON line per MCP tool call, at
 * `<packageRoot>/data/logs/YYYY/MM/DD/<server>-search-journal.jsonl` (UTC
 * date): `{at, tool, query, results, truncated, durationMs, error}`.
 * Counts only — never carrier content.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
/** Absolute path of the day's journal file (UTC date). */
export function searchJournalPath(packageRoot, server, at = new Date()) {
    if (packageRoot.length === 0)
        throw new TypeError("packageRoot is required");
    if (server.length === 0)
        throw new TypeError("server is required");
    const yyyy = String(at.getUTCFullYear());
    const mm = String(at.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(at.getUTCDate()).padStart(2, "0");
    return join(packageRoot, "data", "logs", yyyy, mm, dd, `${server}-search-journal.jsonl`);
}
/** Appends one search-journal row and returns the file it landed in. */
export function appendSearchJournalRow(params) {
    const { packageRoot, server, tool, query, results, truncated, durationMs } = params;
    const at = params.at ?? new Date();
    const error = params.error ?? null;
    if (tool.length === 0)
        throw new TypeError("tool is required");
    if (!Number.isFinite(results))
        throw new TypeError("results must be a finite number");
    if (!Number.isFinite(durationMs))
        throw new TypeError("durationMs must be a finite number");
    const path = searchJournalPath(packageRoot, server, at);
    mkdirSync(dirname(path), { recursive: true });
    const row = { at: at.toISOString(), tool, query, results, truncated, durationMs, error };
    appendFileSync(path, `${JSON.stringify(row)}\n`, "utf8");
    return path;
}
function readNumber(value, key) {
    if (value === null || typeof value !== "object")
        return undefined;
    const found = value[key];
    return typeof found === "number" ? found : undefined;
}
function readArrayLength(value, key) {
    if (value === null || typeof value !== "object")
        return undefined;
    const found = value[key];
    return Array.isArray(found) ? found.length : undefined;
}
/**
 * Best-effort results/truncated for one jsnode_* payload. Filtered-search
 * tools (search/query/duplication/types/functions/atlas/domains) read the
 * count the payload already reports; a resolved single-record tool
 * (package/typeflow_type) counts 1 (the operation already throws — a miss —
 * when not found, so reaching here means a record was found); the
 * whole-workspace computations (analysis/typeflow/status/refresh) count 1 for
 * their one successful answer.
 */
export function deriveJsnodeResultCount(tool, payload) {
    switch (tool) {
        case "jsnode_search":
            return { results: readNumber(payload, "count") ?? readArrayLength(payload, "matches") ?? 0, truncated: false };
        case "jsnode_query": {
            const count = readNumber(payload, "count") ?? 0;
            const returned = readArrayLength(payload, "packages") ?? count;
            return { results: count, truncated: returned < count };
        }
        case "jsnode_duplication": {
            const count = readNumber(payload, "candidateCount") ?? 0;
            const returned = readArrayLength(payload, "candidates") ?? count;
            return { results: count, truncated: returned < count };
        }
        case "jsnode_types":
        case "jsnode_functions":
            return { results: readNumber(payload, "count") ?? 0, truncated: false };
        case "jsnode_atlas":
            return { results: readNumber(payload, "domainCount") ?? readArrayLength(payload, "domains") ?? 0, truncated: false };
        case "jsnode_domains":
            return { results: readNumber(payload, "order") ?? readArrayLength(payload, "nodes") ?? 0, truncated: false };
        default:
            return { results: 1, truncated: false };
    }
}
/**
 * Records each operation invocation independently of its transport: a successful call
 * derives results/truncated via deriveJsnodeResultCount; a thrown error is
 * journaled with results: 0 and the error message, then rethrown unchanged.
 */
export function journalOperation(name, handler, options) {
    const { packageRoot, server } = options;
    return async (args) => {
        const at = new Date();
        const startedAt = performance.now();
        try {
            const output = await handler(args);
            const { results, truncated } = deriveJsnodeResultCount(name, output);
            appendSearchJournalRow({
                packageRoot, server, tool: name, query: args, results, truncated,
                durationMs: Math.round(performance.now() - startedAt), error: null, at,
            });
            return output;
        }
        catch (error) {
            appendSearchJournalRow({
                packageRoot, server, tool: name, query: args, results: 0, truncated: false,
                durationMs: Math.round(performance.now() - startedAt),
                error: error instanceof Error ? error.message : String(error), at,
            });
            throw error;
        }
    };
}
//# sourceMappingURL=journal.mjs.map
