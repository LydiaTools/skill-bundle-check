import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,writeFile,rm,symlink} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {snapshot,compare} from '../src/presence.js';
test('two integrations before and after losing one directory',async()=>{const d=await mkdtemp(path.join(os.tmpdir(),'presence-'));try{const roots=[{name:'claude',root:path.join(d,'.claude/skills')},{name:'codex',root:path.join(d,'.agents/skills')}];for(const x of roots){await mkdir(path.join(x.root,'demo'),{recursive:true});await writeFile(path.join(x.root,'demo','SKILL.md'),'---\nname: demo\n---\n');}const a=await snapshot('demo',roots);assert.deepEqual(a.targets.map(x=>x.status),['found','found']);await rm(path.join(roots[1].root,'demo'),{recursive:true});const b=await snapshot('demo',roots);assert.deepEqual(compare(a,b).map(x=>[x.name,x.before,x.after]),[['claude','found','found'],['codex','found','missing']]);await assert.rejects(snapshot('../bad',roots));assert.throws(()=>compare(a,{...b,targets:[b.targets[0]]}));}finally{await rm(d,{recursive:true,force:true})}});
test('healthy and broken links are different from missing and not-file',async()=>{const d=await mkdtemp(path.join(os.tmpdir(),'presence-'));try{await mkdir(path.join(d,'actual','demo'),{recursive:true});await writeFile(path.join(d,'actual','demo','SKILL.md'),'test');await symlink(path.join(d,'actual'),path.join(d,'root'),'dir');let x=await snapshot('demo',[{name:'test',root:path.join(d,'root')}]);assert.equal(x.targets[0].status,'found');await rm(path.join(d,'actual'),{recursive:true});x=await snapshot('demo',[{name:'test',root:path.join(d,'root')}]);assert.equal(x.targets[0].status,'broken-link');assert.equal(x.targets[0].at,path.join(d,'root'));}finally{await rm(d,{recursive:true,force:true})}});

test('reject empty or invalid inputs and malformed snapshots',async()=>{
  await assert.rejects(snapshot(undefined,[{name:'claude',root:'/tmp/a'}]));
  await assert.rejects(snapshot('demo',[{name:'x',root:''}]));
  await assert.rejects(snapshot('demo',[{name:'x',root:'   '}]));
  await assert.rejects(snapshot('demo',[{name:1,root:'/tmp/a'}]));
  await assert.rejects(snapshot('demo',[{name:'x',root:'/tmp/a'},{name:'x',root:'/tmp/b'}]));
  const v={schema:'skill-presence-snapshot-v1',skill:'demo',targets:[{name:'x',root:'/tmp/a',status:'found'}]};
  assert.throws(()=>compare({...v,targets:[]},v));
  assert.throws(()=>compare({...v,targets:[...v.targets,...v.targets]},v));
  assert.throws(()=>compare(v,{...v,targets:[{...v.targets[0],status:'bogus'}]}));
  assert.throws(()=>compare(v,{...v,targets:[{...v.targets[0],root:'relative'}]}));
  assert.throws(()=>compare(v,{...v,skill:'other'}));
});
