import {execFileSync} from 'node:child_process';
import {existsSync,lstatSync,readlinkSync} from 'node:fs';
import {join,resolve,relative,isAbsolute} from 'node:path';
import {gitSync,gitTextSync,treeOfSync,writeBlobSync,replaceInTreeSync,commitTreeSync} from './git-objects.mjs';
export const candidateNameOk=name=>typeof name==='string' && /^[a-z0-9][a-z0-9._-]*(\/[a-z0-9][a-z0-9._-]*)+$/u.test(name) && !name.includes('..') && !name.endsWith('.lock');
const gh=(repository,args)=>String(execFileSync('gh',args,{cwd:repository,encoding:'utf8',maxBuffer:8*1024*1024})).trim();
/** Publish an exact commit for review in this source repository. Never move main. */
export function nameCandidateSync({repository,name,commit,sourceBase,message}){
 if(!candidateNameOk(name))throw new TypeError('candidate name must be owner/slice');
 const sourceCommit=gitTextSync(repository,['rev-parse','--verify',`${commit}^{commit}`]);
 const base=gitTextSync(repository,['rev-parse','--verify',`${sourceBase}^{commit}`]);
 gitSync(repository,['merge-base','--is-ancestor',base,sourceCommit]);
 const repo=JSON.parse(gh(repository,['repo','view','--json','nameWithOwner,defaultBranchRef']));
 // Commit-qualified branches make retries idempotent and never overwrite another contribution.
 const branch=`codex/${name}-${sourceCommit.slice(0,12)}`;
 gitSync(repository,['push','origin',`${sourceCommit}:refs/heads/${branch}`]);
 const existing=JSON.parse(gh(repository,['pr','list','--head',branch,'--state','all','--json','url,headRefOid']));
 const prior=existing.find(p=>p.headRefOid===sourceCommit);
 const text=(message??gitTextSync(repository,['show','-s','--format=%s',sourceCommit])).trim();
 const url=prior?.url??gh(repository,['pr','create','--base',repo.defaultBranchRef.name,'--head',branch,'--title',text.split('\n')[0].slice(0,200),'--body',`${text}\n\nExact source commit: ${sourceCommit}\nSource base: ${base}\nCandidate: ${name}\n\nReview and merge in the owning repository; its machine snapshot CI admits releases.`]);
 return {name,commit:sourceCommit,ref:`refs/heads/${branch}`,pullRequest:url,repository:repo.nameWithOwner,transformation:{sourceBase:base,sourceCommit:sourceCommit,beforeTree:treeOfSync(repository,base),afterTree:treeOfSync(repository,sourceCommit)}};
}
/** Commit only named bytes over fetched main without touching the shared index or HEAD. */
export function landPathsSync({repository,name,paths,message,fetch=true}){
 if(fetch)gitSync(repository,['fetch','--quiet','origin','refs/heads/main:refs/remotes/origin/main']);
 const base=gitTextSync(repository,['rev-parse','--verify','refs/remotes/origin/main^{commit}']);
 const changes={};
 for(const path of paths){
  if(isAbsolute(path)||relative(resolve(repository),resolve(repository,path)).startsWith('..'))throw new TypeError('candidate path escapes source repository');
  const absolute=join(repository,path);let stat;
  try{stat=lstatSync(absolute)}catch(e){if(e.code!=='ENOENT')throw e;changes[path]=null;continue}
  if(stat.isSymbolicLink())changes[path]={mode:'120000',object:writeBlobSync(repository,readlinkSync(absolute))};
  else if(stat.isFile())changes[path]={mode:stat.mode&0o111?'100755':'100644',object:gitTextSync(repository,['hash-object','-w','--',path])};
  else if(stat.isDirectory()&&existsSync(join(absolute,'.git')))changes[path]={mode:'160000',object:gitTextSync(absolute,['rev-parse','--verify','HEAD^{commit}'])};
  else throw new TypeError(`candidate path is not a file or submodule: ${path}`);
 }
 const before=treeOfSync(repository,base),tree=replaceInTreeSync(repository,before,changes);
 if(tree===before)return null;
 const commit=commitTreeSync(repository,tree,[base],`${message.trim()}\n`);
 return nameCandidateSync({repository,name,commit,sourceBase:base,message});
}
