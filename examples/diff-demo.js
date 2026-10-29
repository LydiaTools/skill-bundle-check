import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

// A fictional example in a new temporary directory; no installed skill is touched.
const work = await mkdtemp(path.join(os.tmpdir(), 'skill-diff-demo-'));
const cli = fileURLToPath(new URL('../src/cli.js', import.meta.url));
try {
  const source = path.join(work, 'source'), installed = path.join(work, 'installed');
  await mkdir(source); await mkdir(installed);
  await writeFile(path.join(source, 'SKILL.md'), '# Demo v2\n');
  await writeFile(path.join(installed, 'SKILL.md'), '# Demo v1\n');
  const result = spawnSync(process.execPath, [cli, 'diff', source, installed], { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 1 || !result.stdout.includes('CHANGED  "SKILL.md"')) throw new Error('Unexpected result: ' + result.stderr);
  console.log('Fictional stale-copy example:');
  process.stdout.write(result.stdout);
  console.log('Diff exit: 1 (the selected copies differ).');
  console.log('Only a temporary directory was used.');
} finally {
  await rm(work, { recursive: true, force: true });
}
