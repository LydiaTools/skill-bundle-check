import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';
import { checkAgentPath } from '../src/agent-path.js';

const temporaryDirectories = [];

afterEach(async () => {
	await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

test('finds an Antigravity CLI skill at its documented global path', async () => {
	const home = await makeTemporaryDirectory();
	await addSkill(path.join(home, '.gemini', 'antigravity-cli', 'skills'), 'probe-skill');

	const result = await checkAgentPath({ agent: 'antigravity-cli', skill: 'probe-skill', scope: 'global', home });

	assert.equal(result.status, 'found');
	assert.equal(result.expectedPresent, true);
	assert.equal(result.otherLocations.length, 0);
});

test('reports a skill found only in the shared root for Antigravity CLI', async () => {
	const home = await makeTemporaryDirectory();
	await addSkill(path.join(home, '.agents', 'skills'), 'probe-skill');

	const result = await checkAgentPath({ agent: 'antigravity-cli', skill: 'probe-skill', scope: 'global', home });

	assert.equal(result.status, 'found-other-root');
	assert.equal(result.expectedPresent, false);
	assert.equal(result.otherLocations[0].kind, 'shared-default');
});

test('accepts the documented legacy global path for Antigravity IDE', async () => {
	const home = await makeTemporaryDirectory();
	await addSkill(path.join(home, '.gemini', 'antigravity', 'skills'), 'probe-skill');

	const result = await checkAgentPath({ agent: 'antigravity-ide', skill: 'probe-skill', scope: 'global', home });

	assert.equal(result.status, 'found-legacy');
	assert.equal(result.expectedPresent, false);
	assert.equal(result.otherLocations[0].kind, 'documented-legacy');
});

test('uses the project skill directory for project scope', async () => {
	const cwd = await makeTemporaryDirectory();
	await addSkill(path.join(cwd, '.agents', 'skills'), 'probe-skill');

	const result = await checkAgentPath({ agent: 'antigravity-cli', skill: 'probe-skill', scope: 'project', cwd });

	assert.equal(result.status, 'found');
	assert.equal(result.expectedRoot, path.join(cwd, '.agents', 'skills'));
});

test('recognizes a Codex skill in the default CODEX_HOME without calling the agent', async () => {
	const home = await makeTemporaryDirectory();
	const codexRoot = path.join(home, '.codex', 'skills');
	await addSkill(codexRoot, 'probe-skill');
	const result = await checkAgentPath({ agent: 'codex-cli', skill: 'probe-skill', scope: 'global', home });
	assert.equal(result.expectedPresent, false);
	assert.equal(result.status, 'found-codex-home');
	assert.deepEqual(result.otherLocations.map((x) => x.entry), [path.join(codexRoot, 'probe-skill', 'SKILL.md')]);
});

test('reports both Codex global locations when both exist', async () => {
	const home = await makeTemporaryDirectory();
	await addSkill(path.join(home, '.agents', 'skills'), 'probe-skill');
	await addSkill(path.join(home, '.codex', 'skills'), 'probe-skill');
	const result = await checkAgentPath({ agent: 'codex-cli', skill: 'probe-skill', scope: 'global', home });
	assert.equal(result.status, 'found');
	assert.equal(result.expectedPresent, true);
	assert.equal(result.otherLocations[0].kind, 'codex-home');
});

test('accepts an explicit Codex home without reading the default', async () => {
	const home = await makeTemporaryDirectory();
	const codexHome = await makeTemporaryDirectory();
	await addSkill(path.join(codexHome, 'skills'), 'probe-skill');
	const result = await checkAgentPath({ agent: 'codex-cli', skill: 'probe-skill', scope: 'global', home, codexHome });
	assert.equal(result.status, 'found-codex-home');
	assert.equal(result.otherLocations[0].root, path.join(codexHome, 'skills'));
	await assert.rejects(checkAgentPath({ agent: 'claude-code', skill: 'probe-skill', scope: 'global', home, codexHome }), /codex-home/);
});

test('checks an explicitly supplied root', async () => {
	const root = await makeTemporaryDirectory();
	await addSkill(root, 'probe-skill');

	const result = await checkAgentPath({ root, skill: 'probe-skill', scope: 'global' });

	assert.equal(result.agent, 'custom');
	assert.equal(result.status, 'found');
});

test('rejects an ambiguous profile and custom root', async () => {
	await assert.rejects(
		checkAgentPath({ agent: 'antigravity-cli', root: './skills', skill: 'probe-skill', scope: 'global' }),
		/Choose exactly one/
	);
});

test('rejects a skill name that could escape its root', async () => {
	await assert.rejects(
		checkAgentPath({ agent: 'antigravity-cli', skill: '../outside', scope: 'global' }),
		/one folder name/
	);
});

async function makeTemporaryDirectory() {
	const directory = await mkdtemp(path.join(os.tmpdir(), 'skill-bundle-check-'));
	temporaryDirectories.push(directory);
	return directory;
}

async function addSkill(root, name) {
	const directory = path.join(root, name);
	await mkdir(directory, { recursive: true });
	await writeFile(path.join(directory, 'SKILL.md'), '---\nname: probe-skill\ndescription: Synthetic test fixture.\n---\n');
}
