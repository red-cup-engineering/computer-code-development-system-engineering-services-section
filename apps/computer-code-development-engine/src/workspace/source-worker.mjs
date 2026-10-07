/**
 * Fixed, finite source worker, launched only by the host's contained operation.
 * No shell, network, directory enumeration, index creation or descendant launch.
 */
import {readSourceWindow} from "./source-window.mjs";
import {readSourceSnapshot} from "./source-snapshot.mjs";
import {constants, openSync, closeSync, fstatSync, statSync, readSync, realpathSync} from "node:fs";
import {resolve, relative, isAbsolute, sep} from "node:path";

const obstruction = reason => ({kind:"workspace.read:obstruction",reason});
const revision = s => [s.dev,s.ino,s.size,s.mtimeNs,s.ctimeNs].map(String).join(":");
const within = (root,file) => {
  const p=relative(root,file);
  return p!=="" && p!==".." && !p.startsWith(".."+sep) && !isAbsolute(p);
};
export function readSelectedSource(operation, request, root, contentAddressOf) {
  if (operation==="workspace-file-window") return readSourceWindow(root,request);
  if (!["workspace-file-slice","workspace-text-search"].includes(operation)) return obstruction("unknown-source-operation");
  if(typeof contentAddressOf!=="function")return obstruction("canonical-source-identity-unavailable");
  const selected=operation==="workspace-text-search" ? request.pathPrefix??request.path : request.path??request.id;
  if (typeof selected!=="string" || !selected || isAbsolute(selected)) return obstruction("exact-source-required");
  let fd;
  try {
    root=realpathSync(root);
    const file=realpathSync(resolve(root,selected));
    if (!within(root,file)) return obstruction("outside-workspace");
    const chosen=statSync(file,{bigint:true});
    if (!chosen.isFile()) return obstruction("exact-source-required");
    fd=openSync(file,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
    const before=fstatSync(fd,{bigint:true});
    if (!before.isFile() || before.dev!==chosen.dev || before.ino!==chosen.ino) return obstruction("source-revision-changed");
    const maximum=request.maxFileBytes??262144;
    const snapshot=readSourceSnapshot(file,{
      statPathOrNull:()=>({size:Number(before.size),isFile:()=>before.isFile()}),
      readFileHeadUtf8:(_file,count)=>{
        const bytes=Buffer.alloc(count);let n=0;
        while(n<count){const got=readSync(fd,bytes,n,count-n,n);if(!got)break;n+=got;}
        return new TextDecoder("utf-8",{fatal:true,ignoreBOM:true}).decode(bytes.subarray(0,n));
      },
    },maximum);
    if(snapshot.kind!=="workspace.source-snapshot")return snapshot;
    if(revision(before)!==revision(fstatSync(fd,{bigint:true})))return obstruction("source-revision-changed");
    const source=snapshot.source, parts=source.split("\n");
    if(parts.at(-1)==="")parts.pop();
    const name=relative(root,file).split("\\").join("/");
    if(operation==="workspace-file-slice"){
      const start=Math.min(Math.max(request.startLine??1,1),Number.MAX_SAFE_INTEGER);
      const count=Math.min(Math.max(request.lineCount??80,1),200);
      return {kind:"metroplat.filesystem.workspace-file-slice-readout",path:name,
        contentAddress:contentAddressOf(source),startLine:start,lineCount:count,totalLinesSeen:parts.length,
        truncatedBefore:start>1,truncatedAfter:parts.length>start+count-1,
        readBytes:snapshot.readBytes,lines:parts.slice(start-1,start+count-1).map((text,i)=>({number:start+i,text})),
        evidence:["carrier:bounded-source-snapshot","operation:bounded-line-slice"]};
    }
    if(typeof request.query!=="string" || !request.query.trim())return obstruction("literal-query-required");
    const query=request.query.trim(),needle=query.toLowerCase(),limit=Math.min(Math.max(request.limit??50,1),200),matches=[];
    let truncated=false;
    for(const [i,text]of parts.entries()){
      if(!text.toLowerCase().includes(needle))continue;
      if(matches.length===limit){truncated=true;break;}
      matches.push({path:name,line:i+1,text:text.replace(/\r$/u,"")});
    }
    return {kind:"metroplat.filesystem.workspace-text-search-readout",pathPrefix:name,query,limit,
      matches,truncated,contentAddress:contentAddressOf(source),readBytes:snapshot.readBytes,
      evidence:["carrier:bounded-source-snapshot","operation:literal-text-search"]};
  }catch{return obstruction("source-window-unavailable");}
  finally{if(fd!==undefined)closeSync(fd);}
}
export function encodeSourceResult(result) {
  const text=JSON.stringify(result);
  return Buffer.byteLength(text)<=65536 ? text : JSON.stringify(obstruction("source-result-budget-exceeded-use-window"));
}
if(process.argv[1] && resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
  if(process.argv.length!==4 || Buffer.byteLength(process.argv[3])>16384)process.stdout.write(JSON.stringify(obstruction("finite-source-request-required")));
  else {
    try{
      const request=JSON.parse(process.argv[3]);
      const identity=process.argv[2]==="workspace-file-window"?undefined:
        (await import("@red-cup-engineering/semiotic-eavt-services-section/identity")).artifactId;
      process.stdout.write(encodeSourceResult(readSelectedSource(process.argv[2],request,"/input/source",identity)));
    }
    catch{process.stdout.write(JSON.stringify(obstruction("finite-source-request-required")));}
  }
}
