import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,symlink} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import os from 'node:os';import path from 'node:path';
const run=(...args)=>spawnSync(process.execPath,['src/cli.js',...args],{encoding:'utf8'});
test('CLI compares two named installations and reports missing or dangling paths',async()=>{
  const d=await mkdtemp(path.join(os.tmpdir(),'skill-presence-cli-'));
  try {
    const a=path.join(d,'claude'),b=path.join(d,'codex');
    for (const root of [a,b]) { await mkdir(path.join(root,'demo'),{recursive:true});await writeFile(path.join(root,'demo','SKILL.md'),'# demo\n'); }
    const before=run('snapshot','demo',`claude=${a}`,`codex=${b}`);assert.equal(before.status,0,before.stderr);await writeFile(path.join(d,'before.json'),before.stdout);
    await rm(path.join(b,'demo'),{recursive:true});await symlink(path.join(d,'missing-target'),path.join(b,'demo'));
    const after=run('snapshot','demo',`claude=${a}`,`codex=${b}`);assert.equal(after.status,1,after.stderr);assert.deepEqual(JSON.parse(after.stdout).targets.map(t=>t.status),['found','broken-link']);await writeFile(path.join(d,'after.json'),after.stdout);
    const diff=run('compare',path.join(d,'before.json'),path.join(d,'after.json'));assert.equal(diff.status,1,diff.stderr);assert.deepEqual(JSON.parse(diff.stdout).targets.map(t=>[t.before,t.after]),[['found','found'],['found','broken-link']]);
    assert.equal(run('snapshot','demo','x=').status,2);assert.equal(run('snapshot','../demo',`x=${a}`).status,2);
    await writeFile(path.join(d,'broken.json'),'{broken');assert.equal(run('compare',path.join(d,'before.json'),path.join(d,'broken.json')).status,2);
    const unavailable=JSON.parse(before.stdout);unavailable.targets[0].status='unavailable';await writeFile(path.join(d,'unavailable.json'),JSON.stringify(unavailable));assert.equal(run('compare',path.join(d,'unavailable.json'),path.join(d,'after.json')).status,2);
  } finally { await rm(d,{recursive:true,force:true}); }
});
