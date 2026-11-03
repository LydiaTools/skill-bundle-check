import { lstat, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { inspectPath } from './presence.js';

const MAX_ENTRIES = 2_000;
const ROOT_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

async function inspectRoot(root) {
  const absolute = path.resolve(root);
  let info;
  try {
    info = await lstat(absolute);
  } catch (error) {
    const status = error?.code === 'ENOENT' || error?.code === 'ENOTDIR'
      ? 'missing-root'
      : error?.code === 'ELOOP'
        ? 'broken-link'
        : 'unavailable';
    return { root: absolute, status, code: error?.code || 'UNKNOWN', skills: [], truncated: false };
  }

  if (info.isSymbolicLink()) {
    try {
      info = await stat(absolute);
    } catch (error) {
      const status = error?.code === 'ENOENT' || error?.code === 'ENOTDIR' || error?.code === 'ELOOP'
        ? 'broken-link'
        : 'unavailable';
      return { root: absolute, status, code: error?.code || 'UNKNOWN', skills: [], truncated: false };
    }
  }

  if (!info.isDirectory()) {
    return { root: absolute, status: 'not-directory', skills: [], truncated: false };
  }

  let entries;
  try {
    entries = await readdir(absolute, { withFileTypes: true });
  } catch (error) {
    const status = error?.code === 'ENOENT' || error?.code === 'ENOTDIR'
      ? 'missing-root'
      : 'unavailable';
    return { root: absolute, status, code: error?.code || 'UNKNOWN', skills: [], truncated: false };
  }

  const candidates = entries
    .filter(entry => !entry.name.startsWith('.') && (entry.isDirectory() || entry.isSymbolicLink()))
    .sort((left, right) => left.name.localeCompare(right.name));
  const truncated = candidates.length > MAX_ENTRIES;
  const skills = [];

  for (const entry of candidates.slice(0, MAX_ENTRIES)) {
    const skillPath = path.join(absolute, entry.name);
    if (entry.isSymbolicLink()) {
      try {
        if (!(await stat(skillPath)).isDirectory()) {
          skills.push({ name: entry.name, status: 'not-directory', at: skillPath });
          continue;
        }
      } catch (error) {
        const status = error?.code === 'ENOENT' || error?.code === 'ENOTDIR' || error?.code === 'ELOOP'
          ? 'broken-link'
          : 'unavailable';
        skills.push({ name: entry.name, status, at: skillPath, code: error?.code || 'UNKNOWN' });
        continue;
      }
    }

    const result = await inspectPath(path.join(skillPath, 'SKILL.md'));
    skills.push({
      name: entry.name,
      status: result.status,
      ...(result.at ? { at: result.at } : {}),
      ...(result.code ? { code: result.code } : {}),
    });
  }

  return { root: absolute, status: 'available', skills, truncated };
}

export async function scanSkillRoots(targets) {
  if (!Array.isArray(targets) || targets.length === 0) throw new Error('Provide at least one skills root.');
  const seen = new Set();
  const roots = [];
  for (const target of targets) {
    if (!target || typeof target.name !== 'string' || !ROOT_NAME.test(target.name) ||
        typeof target.root !== 'string' || !target.root.trim() || seen.has(target.name)) {
      throw new Error('Skills roots need unique labels and non-empty paths.');
    }
    seen.add(target.name);
    roots.push({ name: target.name, ...(await inspectRoot(target.root)) });
  }
  return { schema: 'skill-installation-doctor-v1', roots };
}

export function doctorExitCode(report) {
  if (report.roots.some(root => root.status === 'unavailable' || root.truncated || root.skills.some(skill => skill.status === 'unavailable'))) return 2;
  if (report.roots.some(root => root.status !== 'available' || root.skills.some(skill => skill.status !== 'found'))) return 1;
  return 0;
}
