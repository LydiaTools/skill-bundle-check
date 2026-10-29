import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
const run=(...args)=>spawnSync(process.execPath,['src/cli.js',...args],{encoding:'utf8'});
test('CLI reports non-blocking hints without running or changing input',async()=>{
  const d=await mkdtemp(path.join(os.tmpdir(),'skill-pipe-test-'));
  try {
    const file=path.join(d,'SKILL.md'), sentinel=path.join(d,'should-not-exist');
    const raw=`| job | command |\n|---|---|\n| example | \`touch ${sentinel} \\| sort\` |\n| literal | \`grep -E 'cat\\|dog'\` |\n`;
    await writeFile(file,raw);
    const result=run('review-pipes',file,'--format','json');assert.equal(result.status,0,result.stderr);
    const data=JSON.parse(result.stdout);assert.equal(data.schema,'skill-table-pipe-review-v1');assert.equal(data.findings.length,2);
    assert.deepEqual(data.findings.map(x=>x.line),[3,4]);
    assert.match(data.findings[1].message,/intentional/);
    assert.equal(await readFile(file,'utf8'),raw);
    await assert.rejects(readFile(sentinel));
    assert.equal(run('review-pipes',path.join(d,'missing.md')).status,2);
    assert.equal(run('review-pipes',file,'--format','unknown').status,2);
    assert.equal(run('review-pipes',file,'extra').status,2);
    const many=path.join(d,'many.md');await writeFile(many,'| A | B |\n|---|---|\n| x | `'+('a\\|'.repeat(1200))+'` |\n');
    const bounded=run('review-pipes',many,'--format','json');assert.equal(bounded.status,0);const parsed=JSON.parse(bounded.stdout);assert.equal(parsed.findings.length,1000);assert.equal(parsed.truncated,true);
    const large=path.join(d,'large.md');await writeFile(large,'a'.repeat(1048577));assert.equal(run('review-pipes',large).status,2);
  } finally {await rm(d,{recursive:true,force:true});}
});
