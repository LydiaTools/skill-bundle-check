import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checkBundle } from '../src/check.js';

async function makeTree(root, files) {
	for (const [relative, content] of Object.entries(files)) {
		const file = path.join(root, relative);
		await mkdir(path.dirname(file), { recursive: true });
		await writeFile(file, content, 'utf8');
	}
}

async function withBundles(sourceFiles, installedFiles, callback) {
	const temp = await mkdtemp(path.join(os.tmpdir(), 'skill-bundle-check-'));
	const source = path.join(temp, 'source');
	const installed = path.join(temp, 'installed');
	await mkdir(source);
	await mkdir(installed);
	await makeTree(source, sourceFiles);
	await makeTree(installed, installedFiles);
	try {
		await callback(source, installed);
	} finally {
		await rm(temp, { recursive: true, force: true });
	}
}

test('passes when the installed bundle preserves referenced files', async () => {
	await withBundles(
		{
			'SKILL.md': '# Example\n\nRead [the guide](references/guide.md).\n',
			'references/guide.md': 'Use `../scripts/check.js` before shipping.\n',
			'scripts/check.js': 'export {};\n',
		},
		{
			'SKILL.md': '# Example\n\nRead [the guide](references/guide.md).\n',
			'references/guide.md': 'Use `../scripts/check.js` before shipping.\n',
			'scripts/check.js': 'export {};\n',
		},
		async (source, installed) => {
			const result = await checkBundle(source, installed);
			assert.equal(result.ok, true);
			assert.equal(result.issues.length, 0);
		},
	);
});

test('catches a reference that exists in source but was omitted by installation', async () => {
	await withBundles(
		{
			'SKILL.md': '# Example\n\nSee [setup](<references/setup%20guide.md>).\n',
			'references/setup guide.md': 'Setup steps.\n',
		},
		{ 'SKILL.md': '# Example\n\nSee [setup](<references/setup%20guide.md>).\n' },
		async (source, installed) => {
			const result = await checkBundle(source, installed);
			assert.equal(result.ok, false);
			assert.ok(result.issues.some((item) => item.code === 'REFERENCE_MISSING_FROM_INSTALL' && item.target === 'references/setup guide.md'));
		},
	);
});

test('catches source and installed links that escape their bundle roots', async () => {
	await withBundles(
		{ 'SKILL.md': '# Example\n\nRead [outside](../../README.md).\n' },
		{ 'SKILL.md': '# Example\n\nRead [outside](../../README.md).\n' },
		async (source, installed) => {
			const result = await checkBundle(source, installed);
			assert.ok(result.issues.some((item) => item.root === 'source' && item.code === 'LINK_ESCAPES_ROOT'));
			assert.ok(result.issues.some((item) => item.root === 'installed' && item.code === 'LINK_ESCAPES_ROOT'));
		},
	);
});

test('handles HTML links and ignores external links and fenced examples', async () => {
	await withBundles(
		{
			'SKILL.md': '# Example\n\n[site](https://example.com)\n\n<img src="assets/demo.svg">\n\n```md\n[not a real link](missing.md)\n```\n',
			'assets/demo.svg': '<svg/>\n',
		},
		{
			'SKILL.md': '# Example\n\n[site](https://example.com)\n\n<img src="assets/demo.svg">\n\n```md\n[not a real link](missing.md)\n```\n',
			'assets/demo.svg': '<svg/>\n',
		},
		async (source, installed) => {
			const result = await checkBundle(source, installed);
			assert.equal(result.ok, true);
			assert.equal(result.referencesChecked, 2);
		},
	);
});

test('requires separate source and installed directories', async () => {
	await withBundles(
		{ 'SKILL.md': '# Example\n' },
		{ 'SKILL.md': '# Example\n' },
		async (source) => {
			await assert.rejects(() => checkBundle(source, source), /same directory/);
		},
	);
});

test('rejects a symlinked directory that resolves outside a bundle', async () => {
	const temp = await mkdtemp(path.join(os.tmpdir(), 'skill-bundle-check-'));
	const source = path.join(temp, 'source');
	const installed = path.join(temp, 'installed');
	const outside = path.join(temp, 'outside');
	await mkdir(source);
	await mkdir(installed);
	await mkdir(outside);
	await writeFile(path.join(source, 'SKILL.md'), '# Example\n');
	await writeFile(path.join(installed, 'SKILL.md'), '# Example\n\n[secret](assets/secret.txt)\n');
	await writeFile(path.join(outside, 'secret.txt'), 'outside\n');
	await import('node:fs/promises').then(({ symlink }) => symlink(outside, path.join(installed, 'assets'), 'dir'));
	try {
		const result = await checkBundle(source, installed);
		assert.ok(result.issues.some((item) => item.root === 'installed' && item.code === 'SYMLINK_ESCAPES_ROOT'));
	} finally {
		await rm(temp, { recursive: true, force: true });
	}
});
