import path from 'node:path';
import { checkBundle } from './check.js';

const sourceInput = process.env.INPUT_SOURCE;
const installedInput = process.env.INPUT_INSTALLED;

try {
	if (!sourceInput || !installedInput) throw new Error('Both `source` and `installed` inputs are required.');
	const source = path.resolve(process.cwd(), sourceInput);
	const installed = path.resolve(process.cwd(), installedInput);
	const result = await checkBundle(source, installed);
	for (const finding of result.issues) {
		const findingRoot = finding.root === 'installed' ? installed : source;
		const file = path.relative(process.cwd(), path.join(findingRoot, finding.file)).split(path.sep).join('/');
		const title = escapeCommand(finding.code);
		const message = escapeCommand(`${finding.root}: ${finding.message}`);
		console.log(`::error file=${escapeCommand(file)},line=${finding.line},title=${title}::${message}`);
	}
	console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.referencesChecked} local references checked.`);
	if (!result.ok) process.exitCode = 1;
} catch (error) {
	console.log(`::error title=Skill Bundle Check::${escapeCommand(error.message)}`);
	process.exitCode = 2;
}

function escapeCommand(value) {
	return String(value).replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A').replaceAll(':', '%3A').replaceAll(',', '%2C');
}
