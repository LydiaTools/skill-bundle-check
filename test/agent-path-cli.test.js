import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, test } from 'node:test';

const temporaryDirectories = [];
const cliPath = fileURLToPath(new URL('../src/cli.js', import.meta.url));

afterEach(async () => {
	await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

test('Claude project check reports the shared project location without claiming it loaded', async () => {
	const project = await mkdtemp(path.join(os.tmpdir(), 'skill-bundle-project-'));
	temporaryDirectories.push(project);
	const shared = path.join(project, '.agents', 'skills', 'probe-skill');
	await mkdir(shared, { recursive: true });
	await writeFile(path.join(shared, 'SKILL.md'), '---\nname: probe-skill\ndescription: Synthetic CLI fixture.\n---\n');
	const args=[cliPath,'check-agent','--agent','claude-code','--skill','probe-skill','--scope','project','--cwd',project];
	const result=spawnSync(process.execPath,args,{encoding:'utf8'});
	assert.equal(result.status,1,result.stderr);
	assert.match(result.stdout,/NOT FOUND/);
	assert.match(result.stdout,/FOUND OTHER ROOT/);
	assert.ok(result.stdout.includes(path.join(shared,'SKILL.md')));
	const json=spawnSync(process.execPath,[...args,'--format','json'],{encoding:'utf8'});
	assert.equal(json.status,1,json.stderr);
	assert.equal(JSON.parse(json.stdout).status,'found-other-root');
});

test('check-agent exits nonzero and names both roots for a misplaced global skill', async () => {
	const home = await mkdtemp(path.join(os.tmpdir(), 'skill-bundle-check-cli-'));
	temporaryDirectories.push(home);
	const sharedDirectory = path.join(home, '.agents', 'skills', 'probe-skill');
	await mkdir(sharedDirectory, { recursive: true });
	await writeFile(path.join(sharedDirectory, 'SKILL.md'), '---\nname: probe-skill\ndescription: Synthetic CLI fixture.\n---\n');

	const result = spawnSync(process.execPath, [
		cliPath,
		'check-agent',
		'--agent', 'antigravity-cli',
		'--skill', 'probe-skill',
		'--scope', 'global',
		'--home', home,
	], {
		encoding: 'utf8',
		env: { ...process.env, HOME: home, USERPROFILE: home },
	});

	assert.equal(result.status, 1, result.stderr);
	assert.match(result.stdout, /NOT FOUND/);
	assert.match(result.stdout, /FOUND OTHER ROOT/);
	assert.match(result.stdout, /antigravity-cli\/skills\/probe-skill\/SKILL\.md/);
});

test('Codex global check accepts custom CODEX_HOME and reports the actual location', async () => {
	const home = await mkdtemp(path.join(os.tmpdir(), 'skill-bundle-check-home-'));
	const codexHome = await mkdtemp(path.join(os.tmpdir(), 'skill-bundle-check-codex-'));
	temporaryDirectories.push(home, codexHome);
	const skillDir = path.join(codexHome, 'skills', 'probe-skill');
	await mkdir(skillDir, { recursive: true });
	await writeFile(path.join(skillDir, 'SKILL.md'), '---\nname: probe-skill\ndescription: Synthetic CLI fixture.\n---\n');
	const args = [cliPath, 'check-agent', '--agent', 'codex-cli', '--skill', 'probe-skill', '--scope', 'global'];
	const env = { ...process.env, HOME: home, USERPROFILE: home, CODEX_HOME: codexHome };
	const text = spawnSync(process.execPath, args, { encoding: 'utf8', env });
	assert.equal(text.status, 0, text.stderr);
	assert.match(text.stdout, /FOUND CODEX HOME/);
	assert.ok(text.stdout.includes(path.join(skillDir, 'SKILL.md')));
	const json = spawnSync(process.execPath, [...args, '--format', 'json'], { encoding: 'utf8', env });
	assert.equal(json.status, 0, json.stderr);
	assert.equal(JSON.parse(json.stdout).status, 'found-codex-home');
	const isolated = spawnSync(process.execPath, [...args, '--home', home], { encoding: 'utf8', env });
	assert.equal(isolated.status, 1, 'Explicit --home must not inspect the process CODEX_HOME');
	const explicit = spawnSync(process.execPath, [...args, '--home', home, '--codex-home', codexHome], { encoding: 'utf8', env });
	assert.equal(explicit.status, 0, explicit.stderr);
});


test('check-agent identifies a broken relative symlink while preserving a healthy link', async (t) => {
  const project = await mkdtemp(path.join(os.tmpdir(), 'skill-bundle-link-'));
  temporaryDirectories.push(project);
  await mkdir(path.join(project, '.agents'));
  const skillDir=path.join(project, 'skills-store', 'probe-skill');
  await mkdir(skillDir, { recursive: true });
  await writeFile(path.join(skillDir, 'SKILL.md'), '---\nname: probe-skill\ndescription: Synthetic fixture.\n---\n');
  const link=path.join(project, '.agents', 'skills');
  try { await symlink('skills-store', link, 'dir'); }
  catch (error) { if (process.platform === 'win32' && ['EPERM','EACCES'].includes(error.code)) return t.skip('Symlink privileges unavailable'); throw error; }
  const args=[cliPath,'check-agent','--agent','codex-cli','--scope','project','--skill','probe-skill','--cwd',project];
  const bad=spawnSync(process.execPath,args,{encoding:'utf8'});
  assert.equal(bad.status,1,bad.stderr);assert.match(bad.stdout,/BROKEN LINK/);assert.ok(bad.stdout.includes(link));
  const json=spawnSync(process.execPath,[...args,'--format','json'],{encoding:'utf8'});
  assert.equal(JSON.parse(json.stdout).brokenLink,link);
  await rm(link);await symlink('../skills-store',link,'dir');
  const good=spawnSync(process.execPath,args,{encoding:'utf8'});
  assert.equal(good.status,0,good.stderr);assert.match(good.stdout,/FOUND/);assert.doesNotMatch(good.stdout,/BROKEN LINK/);
});
