import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, test } from 'node:test';

const temporaryDirectories = [];
const cliPath = fileURLToPath(new URL('../src/cli.js', import.meta.url));

afterEach(async () => {
	await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
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
