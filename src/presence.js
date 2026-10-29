import { lstat, stat } from 'node:fs/promises';
import path from 'node:path';

export async function inspectPath(entry) {
  const absolute = path.resolve(entry);
  const root = path.parse(absolute).root;
  const parts = absolute.slice(root.length).split(path.sep).filter(Boolean);
  let cursor = root;
  for (const part of parts) {
    cursor = path.join(cursor, part);
    try {
      const info = await lstat(cursor);
      if (info.isSymbolicLink()) {
        try { await stat(cursor); }
        catch (e) {
          if (e.code === 'ENOENT' || e.code === 'ENOTDIR') return { status: 'broken-link', at: cursor };
          return { status: 'unavailable', at: cursor, code: e.code || 'UNKNOWN' };
        }
      }
    } catch (e) {
      if (e.code === 'ENOENT' || e.code === 'ENOTDIR') return { status: 'missing', at: cursor };
      return { status: 'unavailable', at: cursor, code: e.code || 'UNKNOWN' };
    }
  }
  try { return {status:(await stat(absolute)).isFile() ? 'found' : 'not-file'}; }
  catch (e) { return {status:'unavailable', at:absolute, code:e.code || 'UNKNOWN'}; }
}
export async function snapshot(skill, targets) {
  if (typeof skill !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(skill) || skill === '.' || skill === '..') throw Error('Invalid skill name');
  if (!Array.isArray(targets) || !targets.length) throw Error('Provide at least one target');
  const names = new Set(); const rows=[];
  for (const target of targets) {
    if (typeof target?.name !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(target.name) || typeof target.root !== 'string' || !target.root.trim() || names.has(target.name)) throw Error('Targets need unique names and roots');
    names.add(target.name);
    const root=path.resolve(target.root); rows.push({name:target.name, root, ...(await inspectPath(path.join(root,skill,'SKILL.md')))});
  }
  return {schema:'skill-presence-snapshot-v1', skill, targets:rows};
}
const statuses = new Set(['found', 'missing', 'broken-link', 'not-file', 'unavailable']);
function validateSnapshot(value) {
  if (!value || value.schema !== 'skill-presence-snapshot-v1' || typeof value.skill !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value.skill) || !Array.isArray(value.targets) || !value.targets.length) throw Error('Invalid snapshot');
  const names = new Set();
  for (const t of value.targets) {
    if (!t || typeof t.name !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(t.name) || typeof t.root !== 'string' || !path.isAbsolute(t.root) || names.has(t.name) || !statuses.has(t.status)) throw Error('Invalid snapshot target');
    names.add(t.name);
  }
}
export function compare(before, after) {
  validateSnapshot(before); validateSnapshot(after);
  if (before.skill !== after.skill) throw Error('Incompatible snapshots');
  const ids = x => x.targets.map(t=>`${t.name}\u0000${t.root}`).sort();
  if (JSON.stringify(ids(before)) !== JSON.stringify(ids(after))) throw Error('Different target sets');
  const prior=new Map(before.targets.map(t=>[t.name,t]));
  return after.targets.map(t=>({name:t.name,root:t.root,before:prior.get(t.name).status,after:t.status,location:t.at || null}));
}
