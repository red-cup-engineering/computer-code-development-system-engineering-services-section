import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,writeFileSync,rmSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {createWorkspaceSourceResource} from "../src/workspace/source-resource.mjs";
import {createWorkspaceSourceDefinitions} from "../src/workspace/source-definitions.mjs";
import {readSelectedSource,encodeSourceResult} from "../src/workspace/source-worker.mjs";
const address=source=>"fixture-identity:"+source.length;
const identity={id:"original-read",actor:"actor",session:"observed",office:"office",subject:"original-work"};
test("unavailable admission performs no native source work; caller getters are not evaluated",async()=>{
  let touched=0;
  const unsafe={get path(){touched++;throw Error("getter executed");}};
  const r=createWorkspaceSourceResource();
  assert.equal((await r.read("workspace-file-window",{path:"source"})).reason,"physical-host-source-resource-unavailable");
  assert.equal((await r.read("workspace-file-window",unsafe)).reason,"finite-source-request-required");
  assert.equal((await r.read("workspace-file-window",new Proxy({}, {ownKeys(){touched++;}}))).reason,"finite-source-request-required");
  assert.equal(touched,0);
});
test("original receipt alone closes a source read; admission and foreign receipt do not",async()=>{
  let result;
  const r=createWorkspaceSourceResource({context:()=>identity,execute:async wire=>{
    const request=JSON.parse(wire);
    assert.equal(request.actor,identity.actor);
    assert.equal(request.subject,identity.subject);
    return result;
  }});
  result={kind:"host-resource.admitted",id:identity.id};
  assert.equal((await r.read("workspace-file-slice",{path:"source"})).reason,"source-effect-awaiting-receipt");
  result={kind:"host-resource.received",id:identity.id,receipt:{id:"foreign",terminated:true,result:{source:"foreign"}}};
  assert.equal((await r.read("workspace-file-slice",{path:"source"})).reason,"source-effect-awaiting-receipt");
  result={kind:"host-resource.received",id:identity.id,receipt:{id:identity.id,terminated:true,exit:{code:0},output:'{"source":"selected"}'}};
  assert.deepEqual(await r.read("workspace-file-slice",{path:"source"}),{source:"selected"});
  result.receipt.reason="output-budget-exceeded";
  assert.equal((await r.read("workspace-file-slice",{path:"source"})).reason,"source-effect-awaiting-receipt");
});
test("source definitions use held roots and image cost; unheld scopes and raised reads are refused",()=>{
  const ops=createWorkspaceSourceDefinitions({roots:new Map([["repository","/held/source"]]),image:{
    node:"/input/node",worker:"/input/worker/source-worker.mjs",readOnlyMounts:[{source:"/held/image",target:"/input/worker"}],
    durationMs:1000,cost:{memoryBytes:1048576,readBytes:4096,writeBytes:0,processes:1,cpuMillis:1000},receipt:"original-image-receipt"}});
  const op=ops.get("workspace-file-window");
  assert.equal(op.validate({scope:"repository",path:"src/one.mjs",byteCount:32}),true);
  assert.equal(op.validate({scope:"unheld",path:"src/one.mjs"}),false);
  assert.equal(op.validate({scope:"repository",path:"../outside"}),false);
  assert.equal(op.validate({scope:"repository",path:"src/one.mjs",byteCount:32769}),false);
  assert.equal(op.bound({byteCount:32}).readBytes,4128);
  assert.equal(op.linux({scope:"repository",path:"src/one.mjs"}).readOnlyMounts.at(-1).source,"/held/source");
});
test("fixed source worker retains exact lines and literal search; directories and oversized output never become evidence",()=>{
  const root=mkdtempSync(join(tmpdir(),"source-resource-"));
  try{
    writeFileSync(join(root,"selected"),"alpha\nbeta\nalpha\n");
    const slice=readSelectedSource("workspace-file-slice",{path:"selected",startLine:2,lineCount:1},root,address);
    assert.deepEqual(slice.lines,[{number:2,text:"beta"}]);
    assert.equal(slice.readBytes,17);
    const search=readSelectedSource("workspace-text-search",{path:"selected",query:"ALPHA",limit:1},root,address);
    assert.equal(search.matches.length,1);assert.equal(search.truncated,true);
    assert.equal(readSelectedSource("workspace-text-search",{path:".",query:"a"},root,address).kind,"workspace.read:obstruction");
    assert.equal(JSON.parse(encodeSourceResult({source:"a".repeat(65536)})).reason,"source-result-budget-exceeded-use-window");
    writeFileSync(join(root,"invalid"),Buffer.from([65,255]));
    assert.equal(readSelectedSource("workspace-file-slice",{path:"invalid"},root,address).kind,"workspace.read:obstruction");
  }finally{rmSync(root,{recursive:true});}
});
