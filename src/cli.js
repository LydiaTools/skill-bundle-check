#!/usr/bin/env node
import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { snapshot, compare } from './presence.js';
import { diffContent } from './content-diff.js';
import { inspectMarkdown } from './review-pipes.js';
import { checkAgentPath, getAgentProfiles } from './agent-path.js';
import { checkBundle } from './check.js';

const HELP = `skill-bundle-check — verify links survive a real skill install

Usage:
  skill-bundle-check check <source-skill-dir> <installed-skill-dir> [--format text|json]
  skill-bundle-check check-agent --skill <name> --scope global|project (--agent <id> | --root <path>) [options]
  skill-bundle-check snapshot <skill> <label=skills-root> [label=skills-root ...]
  skill-bundle-check compare <before.json> <after.json>
  skill-bundle-check diff <source-skill-dir> <installed-skill-dir> [--format text|json]
  skill-bundle-check review-pipes <markdown-file> [--format text|json]

Example:
  skill-bundle-check check ./skills/my-skill ~/.agents/skills/my-skill
  skill-bundle-check check-agent --agent antigravity-cli --skill my-skill --scope global
  skill-bundle-check check-agent --root ./custom-agent/skills --skill my-skill --scope global

check reads both bundle directories. check-agent looks for SKILL.md at the documented location.
All checks are read-only; none runs nor installs a skill.
review-pipes offers non-blocking review hints for escaped pipes in inline code within ordinary Markdown tables.
Snapshot and compare output JSON with paths; exit 0 if all targets are found, 1 for a missing/broken target, 2 for unavailable input.
diff exits 0 for matching files, 1 for differences, and 2 when comparison cannot complete.
For Codex global checks, --codex-home overrides CODEX_HOME; --home isolates the default home.

Supported agent profiles:
${Object.entries(getAgentProfiles()).map(([id, label]) => `  ${id.padEnd(18)} ${label}`).join('\n')}`;

async function main(argv) {
	if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
		console.log(HELP);
		return 0;
	}
	const [command, ...args] = argv;
	if (command === 'check') return await runBundleCheck(args);
	if (command === 'check-agent') return await runAgentCheck(args);
	if (command === 'snapshot') return await runPresenceSnapshot(args);
	if (command === 'compare') return await runPresenceCompare(args);
	if (command === 'diff') {
		if (![2,4].includes(args.length) || (args.length === 4 && (args[2] !== '--format' || !['text','json'].includes(args[3])))) throw new Error('Use diff <source-skill-dir> <installed-skill-dir> [--format text|json]');
		const result = await diffContent(args[0], args[1]);
		if (args[3] === 'json') console.log(JSON.stringify(result, null, 2));
		else {
			for (const item of result.changes) console.log(`${item.status.toUpperCase()}  ${JSON.stringify(item.path)}`);
			console.log(`${result.changes.length} file(s) differ; source ${result.files_source}, installed ${result.files_installed}.`);
		}
		return result.changes.length ? 1 : 0;
	}
	if (command === 'review-pipes') return await runPipeReview(args);
	console.error(HELP);
	return 2;
	}

async function runPipeReview(args) {
  const [file, ...rest] = args;
  if (!file || !([0,2].includes(rest.length)) || (rest.length && rest[0] !== '--format')) throw new Error('Use review-pipes <markdown-file> [--format text|json]');
  const format = rest.length ? rest[1] : 'text';
  if (!['text','json'].includes(format)) throw new Error(`Unknown output format: ${format}`);
  const absolute = path.resolve(file);
  const metadata = await stat(absolute);
  if (!metadata.isFile() || metadata.size > 1024 * 1024) throw new Error('Markdown must be a regular file no larger than 1 MiB');
  const found = inspectMarkdown(await readFile(absolute, 'utf8'));
  const truncated = found.length > 1000;
  const findings = found.slice(0, 1000);
  if (format === 'json') {
    console.log(JSON.stringify({schema:'skill-table-pipe-review-v1',file:absolute,truncated,findings},null,2));
  } else {
    for (const finding of findings) console.log(`REVIEW  ${absolute}:${finding.line}:${finding.column}  ${finding.code}`);
    console.log(`\n${findings.length} occurrence(s) to review${truncated ? ' (output truncated; further matches exist)' : ''}. Escapes can be intentional; no command was run or changed.`);
  }
  return 0; // These are review hints, not established failures.
}

async function runPresenceSnapshot(args) {
  const [skill, ...specs] = args;
  const targets = specs.map(spec => {
    const i = spec.indexOf('=');
    if (i < 1 || !spec.slice(i + 1).trim()) throw new Error('Use label=/skills/root');
    return { name: spec.slice(0, i), root: spec.slice(i + 1) };
  });
  const result = await snapshot(skill, targets);
  console.log(JSON.stringify(result, null, 2));
  return result.targets.some(t => t.status === 'unavailable') ? 2 : result.targets.some(t => t.status !== 'found') ? 1 : 0;
}

async function readSnapshot(file) {
  const metadata = await stat(file);
  if (!metadata.isFile() || metadata.size > 1024 * 1024) throw new Error('Snapshot must be a regular file no larger than 1 MiB');
  return JSON.parse(await readFile(file, 'utf8'));
}

async function runPresenceCompare(args) {
  if (args.length !== 2) throw new Error('Use compare <before.json> <after.json>');
  const before = await readSnapshot(args[0]);
  const after = await readSnapshot(args[1]);
  const result = compare(before, after);
  console.log(JSON.stringify({schema:'skill-presence-comparison-v1', skill:after.skill, targets:result}, null, 2));
  if (result.some(t => t.before === 'unavailable' || t.after === 'unavailable')) return 2;
  return result.some(t => t.after !== 'found') ? 1 : 0;
}

async function runBundleCheck(argv) {
	const [sourceArg, installedArg, ...rest] = argv;
	if (!sourceArg || !installedArg) {
		console.error(HELP);
		return 2;
	}
	let format = 'text';
	for (let index = 0; index < rest.length; index++) {
		if (rest[index] === '--format' && rest[index + 1]) {
			format = rest[index + 1];
			index++;
		} else {
			throw new Error(`Unknown option: ${rest[index]}`);
		}
	}
	if (!['text', 'json'].includes(format)) throw new Error(`Unknown output format: ${format}`);

	const source = path.resolve(sourceArg);
	const installed = path.resolve(installedArg);
	const result = await checkBundle(source, installed);
	if (format === 'json') {
		console.log(JSON.stringify(result, null, 2));
	} else {
		printText(result);
	}
	return result.ok ? 0 : 1;
}

async function runAgentCheck(argv) {
	const options = parseOptions(argv, new Set(['agent', 'skill', 'scope', 'root', 'home', 'cwd', 'format', 'codex-home']));
	if (options['codex-home']) {
		options.codexHome = options['codex-home'];
		delete options['codex-home'];
	}
	if (!options.skill || !options.scope) {
		throw new Error('`--skill` and `--scope` are required.');
	}
	if (Boolean(options.agent) === Boolean(options.root)) {
		throw new Error('Choose exactly one of `--agent` or `--root`.');
	}
	if (options.format && !['text', 'json'].includes(options.format)) {
		throw new Error(`Unknown output format: ${options.format}`);
	}
	const result = await checkAgentPath(options);
	if (options.format === 'json') {
		console.log(JSON.stringify(result, null, 2));
	} else {
		printAgentResult(result);
	}
	return result.expectedPresent || ['found-legacy', 'found-codex-home'].includes(result.status) ? 0 : 1;
}

function parseOptions(argv, allowed) {
	const options = {};
	for (let index = 0; index < argv.length; index++) {
		const token = argv[index];
		if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
		const name = token.slice(2);
		if (!allowed.has(name)) throw new Error(`Unknown option: ${token}`);
		const value = argv[index + 1];
		if (!value || value.startsWith('--')) throw new Error(`Missing value for ${token}`);
		options[name] = value;
		index++;
	}
	return options;
}

function printText(result) {
	for (const finding of result.issues) {
		const location = `${finding.root}/${finding.file}:${finding.line}`;
		console.error(`${finding.code}  ${location}  ${finding.message}`);
	}
	console.log(`\n${result.ok ? 'PASS' : 'FAIL'}  ${result.referencesChecked} local references checked`);
	console.log(`source: ${result.sourceMarkdownFiles} Markdown files · installed: ${result.installedMarkdownFiles} Markdown files`);
}

function printAgentResult(result) {
	console.log(`Agent: ${result.label}`);
	console.log(`Scope: ${result.scope}`);
	console.log(`Expected: ${result.expectedEntry}`);
	if (result.expectedPresent) {
		console.log('FOUND  SKILL.md exists at the documented path.');
	} else {
		console.log('NOT FOUND  SKILL.md is missing from the expected root shown above.');
		if (result.brokenLink) console.log(`BROKEN LINK  ${result.brokenLink} points to a missing target.`);
	}
	for (const location of result.otherLocations) {
		const label = location.kind === 'documented-legacy' ? 'FOUND LEGACY' : location.kind === 'codex-home' ? 'FOUND CODEX HOME' : 'FOUND OTHER ROOT';
		console.log(`${label}  ${location.entry}`);
	}
	for (const document of result.documents) console.log(`Docs: ${document}`);
}

main(process.argv.slice(2)).then((code) => {
	process.exitCode = code;
}).catch((error) => {
	console.error(`ERROR  ${error.message}`);
	process.exitCode = 2;
});
