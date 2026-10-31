import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink, truncate } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';import path from 'node:path';
const cli=fileURLToPath(new URL('../src/cli.js', import.meta.url));
async function fixture(fn){const d=await mkdtemp(path.join(os.tmpdir(),'skill-diff-'));try{const a=path.join(d,'source'),b=path.join(d,'installed');await mkdir(a);await mkdir(b);await fn({a,b,d});}finally{await rm(d,{recursive:true,force:true})}}
function run(...args){return spawnSync(process.execPath,[cli,'diff',...args],{encoding:'utf8'})}
function runTree(...args){return spawnSync(process.execPath,[cli,'diff-tree',...args],{encoding:'utf8'})}
test('changed, added and removed binary/text files; do not disclose content',async()=>fixture(async({a,b})=>{
 await mkdir(path.join(a,'references'));await mkdir(path.join(b,'references'));
 await writeFile(path.join(a,'SKILL.md'),'PRIVATE-source');await writeFile(path.join(b,'SKILL.md'),'PRIVATE-old');
 await writeFile(path.join(a,'references','new.bin'),Buffer.from([0,255,0]));await writeFile(path.join(b,'extra.bin'),Buffer.from([1,2]));
 let r=run(a,b);assert.equal(r.status,1);assert.doesNotMatch(r.stdout,/PRIVATE/);assert.match(r.stdout,/CHANGED/);
 let j=JSON.parse(run(a,b,'--format','json').stdout);assert.deepEqual(j.changes.map(x=>[x.path,x.status]),[['SKILL.md','changed'],['extra.bin','installed-only'],['references/new.bin','source-only']]);assert.match(j.changes[0].source_sha256,/^[0-9a-f]{64}$/);
 await writeFile(path.join(b,'SKILL.md'),'PRIVATE-source');await writeFile(path.join(b,'references','new.bin'),Buffer.from([0,255,0]));await rm(path.join(b,'extra.bin'));r=run(a,b);assert.equal(r.status,0);assert.match(r.stdout,/0 file\(s\) differ/);
}));
test('reject overlap, absent directories, symlinks and size limits',async t=>fixture(async({a,b,d})=>{
 assert.equal(run(a,a).status,2);assert.equal(run(d,a).status,2);assert.equal(run(a,path.join(d,'missing')).status,2);
 try { await symlink(d,path.join(a,'escape'),'dir'); } catch(e){if(process.platform==='win32'&&['EPERM','EACCES'].includes(e.code))return t.skip('symlink not permitted');throw e}
 let r=run(a,b);assert.equal(r.status,2);assert.match(r.stderr,/Symlinks/);await rm(path.join(a,'escape'));
 await writeFile(path.join(a,'big.bin'),'');await truncate(path.join(a,'big.bin'),8*1024*1024+1);r=run(a,b);assert.equal(r.status,2);assert.match(r.stderr,/limit/);
}));
test('entry cap fails closed instead of treating a partial comparison as a match',async()=>fixture(async({a,b})=>{
 await Promise.all(Array.from({length:2001},(_,i)=>writeFile(path.join(a,`f${String(i).padStart(4,'0')}`),'')));
 const result=run(a,b);assert.equal(result.status,2);assert.match(result.stderr,/entry limit/);assert.equal(result.stdout,'');
}));


test('empty or wrong directories are not reported as a successful Skill comparison',async()=>fixture(async({a,b})=>{
 let r=run(a,b);assert.equal(r.status,2);assert.match(r.stderr,/SKILL\.md/);assert.equal(r.stdout,'');
 await writeFile(path.join(a,'SKILL.md'),'# source');r=run(a,b);assert.equal(r.status,2);assert.match(r.stderr,/SKILL\.md/);
}));

test('compare plugin root and installed skill without masking missing plugin metadata',async()=>fixture(async({a,b})=>{
 await mkdir(path.join(a,'.claude-plugin'));await mkdir(path.join(a,'hooks'));await mkdir(path.join(a,'skills','example'),{recursive:true});
 await writeFile(path.join(a,'.claude-plugin','plugin.json'),'{"name":"example"}');await writeFile(path.join(a,'hooks','hooks.json'),'{"hooks":{}}');
 await writeFile(path.join(a,'skills','example','SKILL.md'),'# Example');await writeFile(path.join(b,'SKILL.md'),'# Example');
 assert.equal(run(path.join(a,'skills','example'),b).status,0);
 assert.equal(run(a,b).status,2);
 const r=runTree(a,b,'--format','json');assert.equal(r.status,1);
 const j=JSON.parse(r.stdout);assert.equal(j.schema,'directory-content-diff-v1');
 assert.deepEqual(j.changes.map(x=>[x.path,x.status]),[['.claude-plugin/plugin.json','source-only'],['SKILL.md','installed-only'],['hooks/hooks.json','source-only'],['skills/example/SKILL.md','source-only']]);
}));
test('tree comparison rejects an empty source and reports an empty installed tree',async()=>fixture(async({a,b})=>{
 assert.equal(runTree(a,b).status,2);await writeFile(path.join(a,'plugin.json'),'{}');assert.equal(runTree(a,b).status,1);
 await writeFile(path.join(b,'plugin.json'),'{}');assert.equal(runTree(a,b).status,0);
}));
