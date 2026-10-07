import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { readCodingContext } from "../src/coding-context/read-coding-context.mjs";

function fixture(t) { const root = mkdtempSync(join(tmpdir(), "source-context-")); t.after(() => rmSync(root, {recursive:true,force:true})); return root; }
test("source evidence includes applicable authored instructions and actual requested bytes without admission", (t) => {
  const root = fixture(t); mkdirSync(join(root,"src")); writeFileSync(join(root,"AGENTS.md"),"Obey the user.\n"); writeFileSync(join(root,"src/AGENTS.md"),"Keep exports stable.\n"); writeFileSync(join(root,"src/λ.mjs"),"export const λ = 2;\n");
  const context = readCodingContext({root,paths:["src/λ.mjs"],intent:"change λ",identity:{task:"t",session:"s"},constraints:["preserve API"]});
  assert.deepEqual(context.evidence.map(({path})=>path),["AGENTS.md","src/AGENTS.md","src/λ.mjs"]); assert.equal(context.complete,true); assert.equal(context.evidence[2].text,"export const λ = 2;\n"); assert.equal(context.evidence[2].endLine,1); assert.equal(context.identity.session,"s"); assert.deepEqual(context.constraints,["preserve API"]);
  assert.equal(context.usedBytes,context.evidence.reduce((n,e)=>n+Buffer.byteLength(e.text),0));
});
test("byte budget covers instructions and reports omitted requests without splitting UTF-8",(t)=>{
  const root=fixture(t);writeFileSync(join(root,"AGENTS.md"),"abc😀rest");writeFileSync(join(root,"work.mjs"),"hello");
  const context=readCodingContext({root,paths:["work.mjs"],maxBytes:5}); assert.equal(context.evidence[0].text,"abc"); assert.equal(context.evidence[0].digestScope,"excerpt"); assert.equal(context.evidence[0].truncated,true); assert.equal(context.usedBytes,5); assert.equal(context.evidence[1].text,"he"); assert.equal(context.complete,false);
  const exact=readCodingContext({root,paths:["work.mjs"],maxBytes:5,instructions:false});assert.equal(exact.complete,true);assert.equal(exact.evidence[0].digestScope,"file");
  const blocked=readCodingContext({root,paths:["work.mjs"],maxBytes:3,requireComplete:true});assert.equal(blocked.evidence.length,0);assert.equal(blocked.omitted[0].reason,"complete-artifact-exceeds-budget");
});
test("outside symlinks, binary bytes, missing paths, and file limits remain visible",(t)=>{
  const root=fixture(t),outside=fixture(t);writeFileSync(join(outside,"secret"),"SECRET");symlinkSync(join(outside,"secret"),join(root,"leak"));writeFileSync(join(root,"binary"),Buffer.from([0,1]));writeFileSync(join(root,"a"),"a");writeFileSync(join(root,"b"),"b");
  const context=readCodingContext({root,paths:["leak","binary","absent","a","b"],maxFiles:1});assert.equal(context.evidence.length,1);assert.equal(context.evidence[0].path,"a");assert.deepEqual(context.omitted.map(({reason})=>reason),["unreadable-or-outside-root","binary","missing","file-budget"]);assert.doesNotMatch(JSON.stringify(context),/SECRET/);assert.throws(()=>readCodingContext({root,paths:["../outside"]}),/escapes root/);
});
test("direct CLI emits evidence with no journal or fold",(t)=>{
 const root=fixture(t);writeFileSync(join(root,"note.md"),"underlying capability\n");const result=spawnSync(process.execPath,[new URL("../scripts/read-coding-context.mjs",import.meta.url).pathname],{input:JSON.stringify({root,paths:["note.md"]}),encoding:"utf8"});assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).evidence[0].text,"underlying capability\n");
});

test("definition ranges skip large prefixes without spending the evidence budget",(t)=>{
 const root=fixture(t),prefix="prefix ".repeat(20000)+"\r\n";
 writeFileSync(join(root,"module.mjs"),prefix+"export const λ = 1;\r\n"+"export const other = 2;\n");
 const context=readCodingContext({root,paths:[{path:"module.mjs",line:2,endLine:2,role:"definition"}],maxBytes:30});
 assert.equal(context.complete,true);assert.equal(context.evidence[0].text,"export const λ = 1;\r\n");assert.equal(context.evidence[0].line,2);assert.equal(context.evidence[0].endLine,2);assert.equal(context.evidence[0].byteOffset,Buffer.byteLength(prefix));assert.equal(context.evidence[0].digestScope,"excerpt");assert.equal(context.evidence[0].truncated,false);assert.ok(context.evidence[0].omittedBytes>140000);assert.deepEqual(context.requestedPaths,[{path:"module.mjs",line:2,endLine:2}]);
});
test("multiple definitions in one file retain separate ranges and truthful clipping",(t)=>{
 const root=fixture(t);writeFileSync(join(root,"module.mjs"),"first\nsecond😀\nlast");
 const context=readCodingContext({root,paths:[{path:"module.mjs",line:1,endLine:1},{path:"module.mjs",line:3,endLine:3}],maxBytes:20,requireComplete:true});
 assert.equal(context.complete,true);assert.deepEqual(context.evidence.map(({text,line,endLine})=>({text,line,endLine})),[{text:"first\n",line:1,endLine:1},{text:"last",line:3,endLine:3}]);
 const clipped=readCodingContext({root,paths:[{path:"module.mjs",line:2,endLine:2}],maxBytes:8});assert.equal(clipped.evidence[0].text,"second");assert.equal(clipped.evidence[0].truncated,true);assert.equal(clipped.complete,false);
 const missing=readCodingContext({root,paths:[{path:"module.mjs",line:4,endLine:4}]});assert.equal(missing.evidence.length,0);assert.equal(missing.omitted[0].reason,"line-range-outside-source");
 const overrun=readCodingContext({root,paths:[{path:"module.mjs",line:3,endLine:5}]});assert.equal(overrun.evidence[0].text,"last");assert.equal(overrun.evidence[0].truncated,true);assert.equal(overrun.complete,false);
 assert.throws(()=>readCodingContext({root,paths:[{path:"module.mjs",line:0}]}),/positive integer/);assert.throws(()=>readCodingContext({root,paths:[{path:"module.mjs",line:3,endLine:1}]}),/precedes/);
});

test("UTF-8 BOM bytes remain part of supplied source evidence",(t)=>{
 const root=fixture(t);writeFileSync(join(root,"bom.mjs"),"\uFEFFexport const value = 1;\n");
 const context=readCodingContext({root,paths:["bom.mjs"]});assert.equal(context.evidence[0].text[0],"\uFEFF");assert.equal(context.usedBytes,Buffer.byteLength(context.evidence[0].text));assert.equal(context.complete,true);
});
