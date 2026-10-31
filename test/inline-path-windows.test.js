import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checkBundle } from '../src/check.js';

test('root-relative inline asset and missing installed copy', async () => {
	const temporary = await mkdtemp(path.join(os.tmpdir(), 'skill-inline-'));
	try {
		const source = path.join(temporary, 'source');
		const installed = path.join(temporary, 'installed');
		for (const root of [source, installed]) {
			await mkdir(path.join(root, 'references'), { recursive: true });
			await mkdir(path.join(root, 'assets'));
			await writeFile(path.join(root, 'SKILL.md'), '# Skill\n');
			await writeFile(path.join(root, 'references', 'guide.md'), 'Edit `assets/layout.html`.\n');
			await writeFile(path.join(root, 'assets', 'layout.html'), 'layout\n');
		}
		assert.equal((await checkBundle(source, installed)).ok, true);
		await rm(path.join(installed, 'assets', 'layout.html'));
		const result = await checkBundle(source, installed);
		assert.ok(result.issues.some((item) => item.code === 'REFERENCE_MISSING_FROM_INSTALL'));
	} finally {
		await rm(temporary, { recursive: true, force: true });
	}
});
