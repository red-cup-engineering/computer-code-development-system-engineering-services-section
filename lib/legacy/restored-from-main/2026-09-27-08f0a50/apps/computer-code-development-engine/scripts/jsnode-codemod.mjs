#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import { applyJsnodeSourceEditPlan, planJsnodeModuleSpecifierRewrite } from "../src/index.mjs";

function usage() {
  return "usage: jsnode-codemod --file <path> --rewrite-module <from> <to> [--write]";
}

const args = process.argv.slice(2);
const value = (flag) => {
  const index = args.indexOf(flag);
  return index < 0 ? undefined : args[index + 1];
};
const file = value("--file");
const rewrite = args.indexOf("--rewrite-module");
if (file === undefined || rewrite < 0 || args[rewrite + 1] === undefined || args[rewrite + 2] === undefined) {
  process.stderr.write(`${usage()}\n`);
  process.exitCode = 2;
} else {
  const source = await readFile(file, "utf8");
  const plan = planJsnodeModuleSpecifierRewrite(source, file, args[rewrite + 1], args[rewrite + 2]);
  const receipt = applyJsnodeSourceEditPlan(source, file, plan);
  if (args.includes("--write") && receipt.editCount > 0) await writeFile(file, receipt.text, "utf8");
  process.stdout.write(`${JSON.stringify({ ...receipt, text: undefined, wrote: args.includes("--write") && receipt.editCount > 0 })}\n`);
}
