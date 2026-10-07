#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import process from "node:process";
import { readJsnodeModuleExports, readJsnodeModuleRequests, readJsnodeSourceRecord, readJsnodeSyntax, readJsnodeTokens } from "../src/index.mjs";

const args = process.argv.slice(2);
const fileIndex = args.indexOf("--file");
const file = fileIndex < 0 ? undefined : args[fileIndex + 1];
const formatIndex = args.indexOf("--format");
const format = formatIndex < 0 ? "syntax" : args[formatIndex + 1];
if (file === undefined || !new Set(["syntax", "tokens", "modules", "exports"]).has(format)) {
  process.stderr.write("usage: jsnode-inspect --file <path> [--format syntax|tokens|modules|exports]\n");
  process.exitCode = 2;
} else {
  const text = await readFile(file, "utf8");
  const value = format === "tokens" ? readJsnodeTokens(text, file)
    : format === "modules" ? { source: readJsnodeSourceRecord(text, file), requests: readJsnodeModuleRequests(text, file) }
      : format === "exports" ? { source: readJsnodeSourceRecord(text, file), exports: readJsnodeModuleExports(text, file) }
        : readJsnodeSyntax(text, file);
  process.stdout.write(`${JSON.stringify(value)}\n`);
}
