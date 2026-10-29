import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

// This demonstration uses only a new disposable directory, never installed Skills.
const cli = fileURLToPath(new URL('../src/cli.js', import.meta.url));
const work = await mkdtemp(path.join(os.tmpdir(), 'skill-bundle-demo-'));
const claude = path.join(work, 'claude', 'skills');
const codex = path.join(work, 'codex', 'skills');
const name = 'demo-skill';
function run(args, expected) {
  const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== expected) throw new Error(`Unexpected exit ${result.status}: ${result.stderr}`);
  return JSON.parse(result.stdout);
}
try {
  for (const root of [claude, codex]) {
    await mkdir(path.join(root, name), { recursive: true });
    await writeFile(path.join(root, name, 'SKILL.md'), '# Fictional demo skill\n');
  }
  const targetArgs = [name, `claude=${claude}`, `codex=${codex}`];
  const before = run(['snapshot', ...targetArgs], 0);
  await rm(path.join(codex, name), { recursive: true }); // Simulate one missing copy.
  const after = run(['snapshot', ...targetArgs], 1);
  const beforeFile = path.join(work, 'before.json');
  const afterFile = path.join(work, 'after.json');
  await writeFile(beforeFile, JSON.stringify(before));
  await writeFile(afterFile, JSON.stringify(after));
  const comparison = run(['compare', beforeFile, afterFile], 1);
  const observed = comparison.targets.map(t => `${t.name}: ${t.before} -> ${t.after}`);
  if (observed.join('\n') !== 'claude: found -> found\ncodex: found -> missing') {
    throw new Error('Unexpected demo result');
  }
  console.log('Fictional update check:');
  console.log(observed.join('\n'));
  console.log('Compare exit: 1 (a named target is missing)');
  console.log('Only the temporary demo directory was used.');
} finally {
  await rm(work, { recursive: true, force: true });
}
