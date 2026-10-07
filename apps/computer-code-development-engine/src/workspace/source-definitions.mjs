/**
 * Trusted source operation definitions over already held source resources.
 * No discovered root or invented runtime cost: the owner supplies its immutable
 * worker image, finite measured image bounds and exact authorized source roots.
 */
import {isAbsolute} from "node:path";
import {MAX_SOURCE_PATH_BYTES} from "./source-request.mjs";
const names=["workspace-file-window","workspace-file-slice","workspace-text-search"];
const dimensions=["memoryBytes","readBytes","writeBytes","processes","cpuMillis"];
export function createWorkspaceSourceDefinitions({roots,image}) {
  if(!(roots instanceof Map) || roots.size===0 || !image || !isAbsolute(image.node)
    || !isAbsolute(image.worker) || !Array.isArray(image.readOnlyMounts)
    || !image.readOnlyMounts.length || !Number.isSafeInteger(image.durationMs)
    || image.durationMs<=0 || image.durationMs>60000
    || dimensions.some(k=>!Number.isSafeInteger(image.cost?.[k])||image.cost[k]<0)
    || !image.cost.processes || !image.cost.memoryBytes || !image.cost.cpuMillis
    || typeof image.receipt!=="string" || !image.receipt)
    throw TypeError("held finite source runtime and its original resource evidence required");
  const held=new Map([...roots].map(([key,root])=>{
    if(typeof key!=="string" || !isAbsolute(root))throw TypeError("held source root required");
    return [key,root];
  }));
  const runtime=JSON.parse(JSON.stringify(image));
  const rootOf=input=>held.get(input.duty?"duty:"+input.duty:input.scope??"data");
  return new Map(names.map(operation=>[operation,Object.freeze({
    validate(input){
      if(!input || !rootOf(input))return false;
      const path=operation==="workspace-text-search"?input.pathPrefix??input.path:input.path??input.id;
      if(typeof path!=="string" || !path || Buffer.byteLength(path,"utf8")>MAX_SOURCE_PATH_BYTES || isAbsolute(path)
        || path.split(/[\\/]/u).includes("..") || path.includes("\0"))return false;
      if(Buffer.byteLength(JSON.stringify(input))>16384)return false;
      for(const key of ["byteOffset","startLine","lineCount","limit","maxFileBytes","byteCount"])
        if(input[key]!==undefined && (!Number.isSafeInteger(input[key])||input[key]<0))return false;
      if(input.maxFileBytes!==undefined && (input.maxFileBytes<1||input.maxFileBytes>262144))return false;
      if(input.byteCount!==undefined && (input.byteCount<4||input.byteCount>32768))return false;
      return operation!=="workspace-text-search" || typeof input.query==="string" && input.query.trim().length>0 && input.query.length<=1024;
    },
    bound(input){
      const bytes=operation==="workspace-file-window"?input.byteCount??32768:input.maxFileBytes??262144;
      if(runtime.cost.readBytes>Number.MAX_SAFE_INTEGER-bytes-1)throw TypeError("source bound overflow");
      return {...runtime.cost,readBytes:runtime.cost.readBytes+bytes+(operation==="workspace-file-window"?0:1)};
    },
    linux(input){
      return {command:runtime.node,args:[runtime.worker,operation,JSON.stringify(input)],
        durationMs:runtime.durationMs,outputBytes:65536,
        readOnlyMounts:[...runtime.readOnlyMounts.map(m=>({...m})),{source:rootOf(input),target:"/input/source"}]};
    },
    evidence:runtime.receipt,
  })]));
}
