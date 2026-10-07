/** Public source-read contracts. Source paths stay relative to held host roots. */
export const MAX_SOURCE_PATH_BYTES = 4096;

const sourcePath = {
  type: "string", minLength: 1, maxLength: MAX_SOURCE_PATH_BYTES,
  pattern: "^(?![/\\\\]|[A-Za-z]:[/\\\\])(?!.*(?:^|[/\\\\])\\.\\.(?:[/\\\\]|$))[^\\u0000]+$",
  description: "Exact root-relative path, at most 4096 UTF-8 bytes; no absolute path or parent traversal. The host retains authority over the selected root.",
};
const integer = (minimum, maximum) => ({ type: "integer", minimum, maximum });
const common = {
  duty: { type: "string", minLength: 1, maxLength: 512 },
  scope: { enum: ["repository", "package", "data"], default: "data" },
};

export function workspaceSourceRequestSchema(verb) {
  const schema = {
    $id: `metroplat/filesystem/${verb}/request`,
    type: "object", additionalProperties: false,
    properties: { ...common },
  };
  if (verb === "workspace-file-window") {
    schema.required = ["path"];
    Object.assign(schema.properties, {
      path: sourcePath,
      byteOffset: integer(0, Number.MAX_SAFE_INTEGER),
      byteCount: integer(4, 32768),
      expected: { type: "string", pattern: "^[a-f0-9]{64}$" },
    });
  } else if (verb === "workspace-file-slice") {
    schema.anyOf = [{ required: ["path"] }, { required: ["id"] }];
    Object.assign(schema.properties, {
      path: sourcePath, id: sourcePath,
      startLine: { ...integer(0, Number.MAX_SAFE_INTEGER), description: "Defaults to 1; the worker clamps to at least 1." },
      lineCount: { ...integer(0, Number.MAX_SAFE_INTEGER), description: "Defaults to 80; the worker clamps to 1–200 lines." },
      maxFileBytes: integer(1, 262144),
    });
  } else if (verb === "workspace-text-search") {
    schema.required = ["query"];
    schema.anyOf = [{ required: ["path"] }, { required: ["pathPrefix"] }];
    Object.assign(schema.properties, {
      path: sourcePath, pathPrefix: sourcePath,
      query: { type: "string", minLength: 1, maxLength: 1024, pattern: "\\S" },
      limit: { ...integer(0, Number.MAX_SAFE_INTEGER), description: "Defaults to 50; the worker clamps to 1–200 matches." },
      maxFileBytes: integer(1, 262144),
    });
  } else throw new TypeError(`Unknown source read operation: ${verb}`);
  return schema;
}

export function sourceStringWithinLimit(key, value) {
  if (["path", "id", "pathPrefix"].includes(key))
    return Buffer.byteLength(value, "utf8") <= MAX_SOURCE_PATH_BYTES;
  return value.length <= (key === "query" ? 1024 : 512);
}
