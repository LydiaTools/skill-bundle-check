import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const actionPath = fileURLToPath(new URL('../src/action.js', import.meta.url));

test('GitHub Action annotates an installed-bundle failure at the installed file path', async () => {
	const temp = await mkdtemp(path.join(os.tmpdir(), 'skill-bundle-action-'));
	const source = path.join(temp, 'source');
	const installed = path.join(temp, 'installed');
	await mkdir(path.join(source, 'references'), { recursive: true });
	await mkdir(installed, { recursive: true });
	await writeFile(path.join(source, 'SKILL.md'), '# Example\n\n[guide](references/guide.md)\n');
	await writeFile(path.join(source, 'references/guide.md'), 'Guide\n');
	await writeFile(path.join(installed, 'SKILL.md'), '# Example\n\n[guide](references/guide.md)\n');
	try {
		const result = spawnSync(process.execPath, [actionPath], {
			cwd: temp,
			encoding: 'utf8',
			env: { ...process.env, INPUT_SOURCE: 'source', INPUT_INSTALLED: 'installed' },
		});
		assert.equal(result.status, 1);
		assert.match(result.stdout, /::error file=installed\/SKILL\.md,line=3,title=REFERENCE_MISSING_FROM_INSTALL::/);
	} finally {
		await rm(temp, { recursive: true, force: true });
	}
});
