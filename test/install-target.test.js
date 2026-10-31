import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import {mkdtemp, mkdir, writeFile, readFile, symlink, rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {inspectInstallTarget} from '../src/install-target.js';

test('observes exact destinations, including empty directories and symbolic links', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(),'skill-target-'));
  t.after(() => rm(root,{recursive:true,force:true}));
  const target = path.join(root,'unslop');
  assert.equal((await inspectInstallTarget(path.parse(root).root)).status,'present');
  assert.equal((await inspectInstallTarget(target)).status,'missing');
  assert.equal((await inspectInstallTarget(path.join(root,'missing','unslop'))).first_missing,path.join(root,'missing'));
  await mkdir(target);
  assert.deepEqual([(await inspectInstallTarget(target)).status,(await inspectInstallTarget(target)).kind],['present','directory']);
  await writeFile(path.join(target,'notes.txt'),'original');
  assert.equal((await inspectInstallTarget(path.join(target,'notes.txt'))).kind,'file');
  assert.deepEqual([(await inspectInstallTarget(path.join(target,'notes.txt','x'))).status,(await inspectInstallTarget(path.join(target,'notes.txt','x'))).code],['unavailable','NOT_DIRECTORY']);
  try {
    await symlink(path.join(root,'missing-target'),path.join(root,'broken'),'dir');
    assert.equal((await inspectInstallTarget(path.join(root,'broken'))).kind,'symlink');
    assert.equal((await inspectInstallTarget(path.join(root,'broken','unslop'))).status,'unavailable');
  } catch (error) { if (!['EPERM','EACCES','ENOSYS'].includes(error.code)) throw error; t.diagnostic('Symlinks unavailable on this filesystem'); }
  const result = spawnSync(process.execPath,['src/cli.js','check-target',target,'--format','json'],{encoding:'utf8'});
  assert.equal(result.status,1);
  assert.equal(JSON.parse(result.stdout).kind,'directory');
  const unavailable = spawnSync(process.execPath,['src/cli.js','check-target',path.join(target,'notes.txt','x'),'--format','json'],{encoding:'utf8'});
  assert.equal(unavailable.status,2);
  assert.equal(JSON.parse(unavailable.stdout).code,'NOT_DIRECTORY');
  const missing = spawnSync(process.execPath,['src/cli.js','check-target',path.join(root,'new')],{encoding:'utf8'});
  assert.equal(missing.status,0);
  assert.match(missing.stdout,/not a guarantee/);
  assert.equal(await readFile(path.join(target,'notes.txt'),'utf8'),'original');
});
