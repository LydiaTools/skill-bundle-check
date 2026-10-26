import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mdx']);
const SKIPPED_DIRECTORIES = new Set(['.git', 'node_modules']);
const CONVENTIONAL_PATH = /^(?:(?:\.\.?\/)+)?(?:assets|references|scripts)\/[^\s`<>]+$/;

export async function checkBundle(sourcePath, installedPath) {
	const sourceRoot = await resolveDirectory(sourcePath, 'source');
	const installedRoot = await resolveDirectory(installedPath, 'installed');

	if (sourceRoot === installedRoot) {
		throw new Error('Source and installed paths resolve to the same directory. Compare two separate directories.');
	}

	const sourceDocs = await listMarkdownFiles(sourceRoot);
	const installedDocs = await listMarkdownFiles(installedRoot);
	const sourceDocSet = new Set(sourceDocs);
	const installedDocSet = new Set(installedDocs);
	const issues = [];
	let referencesChecked = 0;

	if (!sourceDocSet.has('SKILL.md')) {
		issues.push(issue('SOURCE_ENTRYPOINT_MISSING', 'source', 'SKILL.md', 1, 'SKILL.md', 'Source folder must contain SKILL.md.'));
	}
	if (!installedDocSet.has('SKILL.md')) {
		issues.push(issue('INSTALLED_ENTRYPOINT_MISSING', 'installed', 'SKILL.md', 1, 'SKILL.md', 'Installed bundle is missing SKILL.md.'));
	}

	for (const doc of sourceDocs) {
		const sourceText = await readMarkdown(sourceRoot, doc);
		const refs = extractReferences(sourceText);
		for (const ref of refs) {
			const kind = classifyTarget(ref.target);
			if (kind !== 'local') continue;
			referencesChecked++;

			const sourceTarget = await resolveReference(sourceRoot, doc, ref.target);
			if (sourceTarget.issue) {
				issues.push(issue(sourceTarget.issue.code, 'source', doc, ref.line, ref.target, sourceTarget.issue.message));
				continue;
			}

			const targetRelative = path.relative(sourceRoot, sourceTarget.absolute);
			const installedTarget = path.resolve(installedRoot, targetRelative);
			const installedPathIssue = pathInsideRoot(installedRoot, installedTarget)
				? await checkExistingPath(installedRoot, installedTarget)
				: { code: 'INSTALLED_PATH_ESCAPES_ROOT', message: `Referenced file resolves outside the installed bundle: ${targetRelative}` };

			if (installedPathIssue) {
				issues.push(issue(installedPathIssue.code === 'LINK_MISSING'
					? 'REFERENCE_MISSING_FROM_INSTALL'
					: installedPathIssue.code, 'installed', doc, ref.line, ref.target, installedPathIssue.message));
			}
		}
	}

	for (const doc of installedDocs) {
		const installedText = await readMarkdown(installedRoot, doc);
		for (const ref of extractReferences(installedText)) {
			if (classifyTarget(ref.target) !== 'local') continue;
			referencesChecked++;
			const resolved = await resolveReference(installedRoot, doc, ref.target);
			if (resolved.issue) {
				issues.push(issue(resolved.issue.code, 'installed', doc, ref.line, ref.target, resolved.issue.message));
			}
		}
	}

	const uniqueIssues = deduplicateIssues(issues);
	return {
		source: sourceRoot,
		installed: installedRoot,
		sourceMarkdownFiles: sourceDocs.length,
		installedMarkdownFiles: installedDocs.length,
		referencesChecked,
		issues: uniqueIssues,
		ok: uniqueIssues.length === 0,
	};
}

async function resolveDirectory(input, label) {
	if (!input) throw new Error(`Missing ${label} directory.`);
	const absolute = path.resolve(input);
	let info;
	try {
		info = await lstat(absolute);
	} catch {
		throw new Error(`${label} directory does not exist: ${absolute}`);
	}
	if (!info.isDirectory()) throw new Error(`${label} path is not a directory: ${absolute}`);
	return await realpath(absolute);
}

async function listMarkdownFiles(root) {
	const files = [];
	async function visit(directory, relativeDirectory = '') {
		const entries = await readdir(directory, { withFileTypes: true });
		entries.sort((a, b) => a.name.localeCompare(b.name));
		for (const entry of entries) {
			if (entry.isSymbolicLink()) continue;
			const absolute = path.join(directory, entry.name);
			const relative = path.join(relativeDirectory, entry.name);
			if (entry.isDirectory()) {
				if (!SKIPPED_DIRECTORIES.has(entry.name)) await visit(absolute, relative);
			} else if (entry.isFile() && MARKDOWN_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
				files.push(relative);
			}
		}
	}
	await visit(root);
	return files;
}

async function readMarkdown(root, relativeFile) {
	return await readFile(path.join(root, relativeFile), 'utf8');
}

function stripFencedCode(markdown) {
	let fence = '';
	return markdown.split(/\r?\n/).map((line) => {
		const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
		const marker = match?.[1] ?? '';
		const tail = match?.[2] ?? '';
		if (!fence) {
			if (!marker || (marker[0] === '`' && tail.includes('`'))) return line;
			fence = marker;
			return '';
		}
		if (marker[0] === fence[0] && marker.length >= fence.length && !tail.trim()) fence = '';
		return '';
	}).join('\n');
}

function extractReferences(markdown) {
	const body = stripFencedCode(markdown);
	const found = new Map();
	const add = (target, offset) => {
		const cleaned = cleanTarget(target);
		if (cleaned && !found.has(cleaned)) found.set(cleaned, lineAt(body, offset));
	};

	const inlineLink = /!?\[[^\]]*\]\(\s*(?:<([^>\n]+)>|([^\s)]+))(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g;
	for (const match of body.matchAll(inlineLink)) add(match[1] ?? match[2] ?? '', match.index ?? 0);

	const referenceDefinition = /^[ \t]{0,3}\[[^\]]+\]:[ \t]*(?:<([^>\n]+)>|([^\s]+))/gm;
	for (const match of body.matchAll(referenceDefinition)) add(match[1] ?? match[2] ?? '', match.index ?? 0);

	const htmlLink = /\b(?:href|src)\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi;
	for (const match of body.matchAll(htmlLink)) add(match[1] ?? match[2] ?? match[3] ?? '', match.index ?? 0);

	const inlineCode = /`([^`\n]+)`/g;
	for (const match of body.matchAll(inlineCode)) {
		const value = match[1]?.trim() ?? '';
		if (CONVENTIONAL_PATH.test(value)) add(value, match.index ?? 0);
	}

	return [...found].map(([target, line]) => ({ target, line }));
}

function cleanTarget(target) {
	let value = target.trim();
	if (!value || value.startsWith('#') || value.startsWith('?') || value.startsWith('//')) return '';
	if (/^[a-z][a-z\d+.-]*:\/\//i.test(value) || /^mailto:/i.test(value)) return '';
	value = value.split(/[?#]/, 1)[0] ?? '';
	if (!value) return '';
	try {
		value = decodeURIComponent(value);
	} catch {
		return value;
	}
	return value.replaceAll('\\', '/');
}

function classifyTarget(target) {
	if (!target) return 'ignore';
	if (/^[a-z][a-z\d+.-]*:/i.test(target)) return 'non-portable';
	if (target.startsWith('/') || /^[a-z]:[\\/]/i.test(target)) return 'absolute';
	return 'local';
}

async function resolveReference(root, markdownFile, target) {
	const kind = classifyTarget(target);
	if (kind === 'non-portable') {
		return { issue: { code: 'NON_PORTABLE_LINK', message: `Use a relative path or web URL instead of: ${target}` } };
	}
	if (kind === 'absolute') {
		return { issue: { code: 'ABSOLUTE_LINK', message: `Absolute paths do not travel with a skill bundle: ${target}` } };
	}
	const relativeTarget = target.replaceAll('/', path.sep);
	const absolute = path.resolve(root, path.dirname(markdownFile), relativeTarget);
	if (!pathInsideRoot(root, absolute)) {
		return { issue: { code: 'LINK_ESCAPES_ROOT', message: `Reference leaves the bundle directory: ${target}` } };
	}
	const pathIssue = await checkExistingPath(root, absolute);
	return pathIssue ? { issue: pathIssue } : { absolute };
}

function pathInsideRoot(root, target) {
	const relative = path.relative(root, target);
	return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

async function checkExistingPath(root, target) {
	try {
		await lstat(target);
	} catch {
		return { code: 'LINK_MISSING', message: `Referenced file is missing: ${path.relative(root, target)}` };
	}
	let realTarget;
	try {
		realTarget = await realpath(target);
	} catch {
		return { code: 'LINK_MISSING', message: `Broken symbolic link or inaccessible target: ${path.relative(root, target)}` };
	}
	if (!pathInsideRoot(root, realTarget)) {
		return { code: 'SYMLINK_ESCAPES_ROOT', message: `Path resolves outside the bundle: ${path.relative(root, target)}` };
	}
	return null;
}

function issue(code, root, file, line, target, message) {
	return { code, root, file: file.split(path.sep).join('/'), line, target, message };
}

function deduplicateIssues(issues) {
	const seen = new Set();
	return issues.filter((item) => {
		const key = [item.code, item.root, item.file, item.line, item.target].join('\0');
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function lineAt(text, offset) {
	let line = 1;
	for (let i = 0; i < offset; i++) if (text.charCodeAt(i) === 10) line++;
	return line;
}
