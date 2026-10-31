import { lstat, readdir, realpath, open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

// Strict bounded read: no links inside either tree. Does not execute or modify files.
const MAX_ENTRIES = 2000, MAX_FILE = 8 * 1024 * 1024, MAX_TOTAL = 64 * 1024 * 1024;
async function rootDirectory(input) {
  if (!input) throw new Error('Provide source and installed directories');
  const root = await realpath(input);
  if (!(await lstat(root)).isDirectory()) throw new Error('Both inputs must be directories');
  return root;
}
function inside(parent, child) { const rel = path.relative(parent,child); return rel === '' || (!rel.startsWith('..'+path.sep) && rel !== '..' && !path.isAbsolute(rel)); }
async function inventory(root) {
  let entries = 0, total = 0;
  const files = new Map();
  async function walk(dir, rel = '') {
    if (!inside(root,await realpath(dir))) throw new Error('Directory escaped root');
    for (const name of (await readdir(dir)).sort()) {
      if (++entries > MAX_ENTRIES) throw new Error('Directory entry limit exceeded');
      const relative = rel ? rel + '/' + name : name;
      const abs = path.join(dir,name);
      const info = await lstat(abs);
      if (info.isSymbolicLink()) throw new Error('Symlinks inside either directory are not supported: ' + JSON.stringify(relative));
      if (info.isDirectory()) { await walk(abs,relative); continue; }
      if (!info.isFile()) throw new Error('Non-regular file is not supported: ' + JSON.stringify(relative));
      if (info.size > MAX_FILE) throw new Error('File size limit exceeded: ' + JSON.stringify(relative));
      if (!inside(root,await realpath(abs))) throw new Error('File escaped root: ' + JSON.stringify(relative));
      const handle = await open(abs,constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
      try {
        const before = await handle.stat();
        if (!before.isFile() || before.size > MAX_FILE || before.ino !== info.ino || before.dev !== info.dev) throw new Error('File changed during scan: ' + JSON.stringify(relative));
        total += before.size; if (total > MAX_TOTAL) throw new Error('Total size limit exceeded');
        const hash=createHash('sha256'), buffer=Buffer.alloc(65536); let length=0;
        while (true) {
          const {bytesRead}=await handle.read(buffer,0,buffer.length,null);
          if (!bytesRead) break;
          length += bytesRead;
          if (length > MAX_FILE || length > before.size) throw new Error('File changed or exceeded size limit: ' + JSON.stringify(relative));
          hash.update(buffer.subarray(0,bytesRead));
        }
        const after = await handle.stat();
        if (length !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs) throw new Error('File changed during scan: ' + JSON.stringify(relative));
        files.set(relative, hash.digest('hex'));
      } finally { await handle.close(); }
    }
  }
  await walk(root);
  return files;
}
export async function diffContent(sourceInput, installedInput, { requireSkill = true } = {}) {
  const source = await rootDirectory(sourceInput), installed = await rootDirectory(installedInput);
  if (inside(source,installed) || inside(installed,source)) throw new Error('Source and installed directories must be separate and non-overlapping');
  const a=await inventory(source), b=await inventory(installed), changes=[];
  if (requireSkill && (!a.has('SKILL.md') || !b.has('SKILL.md'))) throw new Error('Both directories must contain a regular SKILL.md at the root');
  if (!requireSkill && a.size === 0) throw new Error('Source directory must contain at least one regular file');
  for (const name of [...new Set([...a.keys(),...b.keys()])].sort()) {
    const sourceHash=a.get(name) ?? null, installedHash=b.get(name) ?? null;
    if (sourceHash !== installedHash) changes.push({path:name,status:sourceHash===null?'installed-only':installedHash===null?'source-only':'changed',source_sha256:sourceHash,installed_sha256:installedHash});
  }
  return {schema:requireSkill?'skill-content-diff-v1':'directory-content-diff-v1',files_source:a.size,files_installed:b.size,changes};
}
