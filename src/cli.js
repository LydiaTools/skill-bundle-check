#!/usr/bin/env node
import path from 'node:path';
import { checkBundle } from './check.js';

const HELP = `skill-bundle-check — verify links survive a real skill install

Usage:
  skill-bundle-check check <source-skill-dir> <installed-skill-dir> [--format text|json]

Example:
  skill-bundle-check check ./skills/my-skill ~/.agents/skills/my-skill

The command reads both directories and does not run or install the skill.`;

async function main(argv) {
	if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
		console.log(HELP);
		return 0;
	}
	const [command, sourceArg, installedArg, ...rest] = argv;
	if (command !== 'check' || !sourceArg || !installedArg) {
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

function printText(result) {
	for (const finding of result.issues) {
		const location = `${finding.root}/${finding.file}:${finding.line}`;
		console.error(`${finding.code}  ${location}  ${finding.message}`);
	}
	console.log(`\n${result.ok ? 'PASS' : 'FAIL'}  ${result.referencesChecked} local references checked`);
	console.log(`source: ${result.sourceMarkdownFiles} Markdown files · installed: ${result.installedMarkdownFiles} Markdown files`);
}

main(process.argv.slice(2)).then((code) => {
	process.exitCode = code;
}).catch((error) => {
	console.error(`ERROR  ${error.message}`);
	process.exitCode = 2;
});
