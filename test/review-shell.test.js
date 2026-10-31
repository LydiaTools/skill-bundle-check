import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { reviewShell } from '../src/review-shell.js';
import { spawnSync } from 'node:child_process';

test('reports shell-fence script candidates as hints with root-relative status', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'shell-review-'));
  try {
    const source = path.join(temp, 'source'), installed = path.join(temp, 'installed');
    await mkdir(path.join(source, 'scripts'), { recursive:true });
    await mkdir(path.join(installed, 'scripts'), { recursive:true });
    await writeFile(path.join(source, 'SKILL.md'), '# Test\n```bash\n./scripts/exists.sh aws\npython3 ./scripts/missing.py\n# ./scripts/comment.sh\n```\n```text\n./scripts/no.sh\n```\n');
    await writeFile(path.join(source, 'scripts/exists.sh'), 'unused');
    await writeFile(path.join(installed, 'scripts/exists.sh'), 'unused');
    const result = await reviewShell(source, installed);
    assert.deepEqual(result.findings, [
      { line:3, commandPath:'./scripts/exists.sh', sourceRoot:'file', installedRoot:'file' },
      { line:4, commandPath:'./scripts/missing.py', sourceRoot:'missing', installedRoot:'missing' },
    ]);
    assert.equal(result.truncated, false);
    await rm(path.join(installed, 'scripts/exists.sh'));
    const changed = await reviewShell(source, installed);
    assert.equal(changed.findings[0].installedRoot, 'missing');
    // A missing root-relative path is a review hint; the runtime cwd is unknown.
    assert.equal(changed.findings[0].sourceRoot, 'file');
  } finally { await rm(temp, { recursive:true, force:true }); }
});

test('does not treat outside-root links as in-bundle files', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'shell-review-'));
  try {
    const source=path.join(temp,'source'), installed=path.join(temp,'installed'), outside=path.join(temp,'outside');
    await mkdir(path.join(source,'scripts'),{recursive:true}); await mkdir(path.join(installed,'scripts'),{recursive:true}); await mkdir(outside);
    await writeFile(path.join(source,'SKILL.md'),'```sh\n./scripts/check.sh\n```\n');
    await writeFile(path.join(outside,'check.sh'),'unused');
    await symlink(path.join(outside,'check.sh'),path.join(source,'scripts/check.sh'));
    const result=await reviewShell(source,installed);
    assert.equal(result.findings[0].sourceRoot,'outside-root');
    assert.equal(result.findings[0].installedRoot,'missing');
    await assert.rejects(() => reviewShell(source, source), /separate/);
  } finally { await rm(temp,{recursive:true,force:true}); }
});

test('CLI fictional example reports a hint without failing or executing the script', () => {
  const result = spawnSync(process.execPath, ['src/cli.js','review-shell','examples/shell-source','examples/shell-installed','--format','json'], {encoding:'utf8'});
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.findings, [{line:6,commandPath:'./scripts/list-resources.sh',sourceRoot:'file',installedRoot:'missing'}]);
  assert.equal(report.truncated, false);
});
