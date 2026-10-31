import { stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { inspectPath } from './presence.js';

const antigravityDocs = 'https://www.antigravity.google/docs/skills';

const profiles = {
	'claude-code': {
		label: 'Claude Code',
		projectParts: ['.claude', 'skills'],
		globalParts: ['.claude', 'skills'],
		documents: ['https://code.claude.com/docs/en/skills'],
	},
	'codex-cli': {
		label: 'Codex CLI',
		projectParts: ['.agents', 'skills'],
		globalParts: ['.agents', 'skills'],
		documents: ['https://developers.openai.com/codex/skills/'],
	},
	'antigravity-cli': {
		label: 'Antigravity CLI (agy)',
		projectParts: ['.agents', 'skills'],
		globalParts: ['.gemini', 'antigravity-cli', 'skills'],
		documents: [antigravityDocs],
	},
	'antigravity-ide': {
		label: 'Antigravity IDE',
		projectParts: ['.agents', 'skills'],
		globalParts: ['.gemini', 'config', 'skills'],
		legacyGlobalParts: [['.gemini', 'antigravity', 'skills']],
		documents: [antigravityDocs],
	},
	'antigravity-app': {
		label: 'Antigravity App',
		projectParts: ['.agents', 'skills'],
		globalParts: ['.gemini', 'config', 'skills'],
		documents: [antigravityDocs],
	},
};

export function getAgentProfiles() {
	return Object.fromEntries(Object.entries(profiles).map(([id, profile]) => [id, profile.label]));
}

export async function checkAgentPath({ agent, skill, scope, root, home, codexHome, cwd = process.cwd() }) {
	if (!skill || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(skill)) {
		throw new Error('Skill name must be one folder name using letters, numbers, dots, underscores, or hyphens.');
	}
	if (!['global', 'project'].includes(scope)) {
		throw new Error('Scope must be `global` or `project`.');
	}
	if (Boolean(agent) === Boolean(root)) {
		throw new Error('Choose exactly one of `agent` or `root`.');
	}
	if (codexHome && (agent !== 'codex-cli' || scope !== 'global')) {
		throw new Error('`--codex-home` applies only to the global codex-cli profile.');
	}
	const userHome = home ?? os.homedir();

	let profile;
	if (agent) {
		profile = profiles[agent];
		if (!profile) throw new Error(`Unsupported agent profile: ${agent}. Use --root for a custom documented path.`);
	}
	if (!profile && !root) throw new Error('Choose a supported --agent or provide a custom --root.');

	const base = path.resolve(root || path.join(scope === 'global' ? userHome : cwd, ...(scope === 'global' ? profile.globalParts : profile.projectParts)));
	const skillPath = path.join(base, skill);
	const entryPath = path.join(skillPath, 'SKILL.md');
	const expectedPresent = await isFile(entryPath);
	const pathDiagnostic = expectedPresent ? null : await inspectPath(entryPath);
	const otherLocations = [];
	if (agent === 'codex-cli' && scope === 'global') {
		// An explicit home isolates test fixtures from the caller's CODEX_HOME.
		const codexRoot = path.resolve(codexHome || (home === undefined ? process.env.CODEX_HOME : undefined) || path.join(userHome, '.codex'), 'skills');
		const codexEntry = path.join(codexRoot, skill, 'SKILL.md');
		if (codexRoot !== base && await isFile(codexEntry)) {
			otherLocations.push({ kind: 'codex-home', root: codexRoot, entry: codexEntry });
		}
	}

	if (!expectedPresent && scope === 'global') {
		if (profile?.legacyGlobalParts) {
			for (const parts of profile.legacyGlobalParts) {
				const legacyRoot = path.resolve(userHome, ...parts);
				const legacyEntry = path.join(legacyRoot, skill, 'SKILL.md');
				if (await isFile(legacyEntry)) otherLocations.push({ kind: 'documented-legacy', root: legacyRoot, entry: legacyEntry });
			}
		}
	}
	// Claude's project path differs from the shared project root used by other agents.
	// This is only a location hint, not evidence that Claude loaded the skill.
	if (!expectedPresent && (scope === 'global' || scope === 'project' && agent === 'claude-code')) {
		const sharedRoot = path.resolve(scope === 'global' ? userHome : cwd, '.agents', 'skills');
		if (path.resolve(sharedRoot) !== path.resolve(base)) {
			const sharedEntry = path.join(sharedRoot, skill, 'SKILL.md');
			if (await isFile(sharedEntry)) otherLocations.push({ kind: 'shared-default', root: sharedRoot, entry: sharedEntry });
		}
	}

	const legacy = otherLocations.find((location) => location.kind === 'documented-legacy');
	const shared = otherLocations.find((location) => location.kind === 'shared-default');
	const codex = otherLocations.find((location) => location.kind === 'codex-home');
	const status = expectedPresent ? 'found' : codex ? 'found-codex-home' : legacy ? 'found-legacy' : shared ? 'found-other-root' : 'not-found';

	return {
		agent: agent || 'custom',
		label: profile?.label || 'Custom agent path',
		scope,
		skill,
		expectedRoot: base,
		expectedEntry: entryPath,
		expectedPresent,
		...(pathDiagnostic?.status === 'broken-link' ? { brokenLink: pathDiagnostic.at } : {}),
		status,
		otherLocations,
		documents: profile?.documents || [],
	};
}

async function isFile(filePath) {
	try {
		return (await stat(filePath)).isFile();
	} catch (error) {
		if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return false;
		throw error;
	}
}
