#!/usr/bin/env node
import path from 'node:path';
import { checkAgentPath, getAgentProfiles } from './agent-path.js';
import { checkBundle } from './check.js';

const HELP = `skill-bundle-check — verify links survive a real skill install

Usage:
  skill-bundle-check check <source-skill-dir> <installed-skill-dir> [--format text|json]
  skill-bundle-check check-agent --skill <name> --scope global|project (--agent <id> | --root <path>) [options]

Example:
  skill-bundle-check check ./skills/my-skill ~/.agents/skills/my-skill
  skill-bundle-check check-agent --agent antigravity-cli --skill my-skill --scope global
  skill-bundle-check check-agent --root ./custom-agent/skills --skill my-skill --scope global

check reads both bundle directories. check-agent looks for SKILL.md at the documented location.
Both commands are read-only; neither runs nor installs a skill.

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
	console.error(HELP);
	return 2;
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
	const options = parseOptions(argv, new Set(['agent', 'skill', 'scope', 'root', 'home', 'cwd', 'format']));
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
	return result.expectedPresent || result.status === 'found-legacy' ? 0 : 1;
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
		console.log('NOT FOUND  SKILL.md is missing from the documented path.');
		for (const location of result.otherLocations) {
			if (location.kind === 'documented-legacy') {
				console.log(`FOUND LEGACY  ${location.entry}`);
			} else {
				console.log(`FOUND OTHER ROOT  ${location.entry}`);
			}
		}
	}
	for (const document of result.documents) console.log(`Docs: ${document}`);
}

main(process.argv.slice(2)).then((code) => {
	process.exitCode = code;
}).catch((error) => {
	console.error(`ERROR  ${error.message}`);
	process.exitCode = 2;
});
