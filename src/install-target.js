import path from 'node:path';
import { lstat, stat } from 'node:fs/promises';

// A snapshot of the selected path, not a reservation or an installation check.
export async function inspectInstallTarget(input) {
  if (typeof input !== 'string' || !input.trim() || input.includes('\0')) throw new Error('Provide a destination path');
  const target = path.resolve(input);
  const root = path.parse(target).root;
  const segments = path.relative(root, target).split(path.sep).filter(Boolean);
  if (!segments.length) {
    try {
      const item = await lstat(root);
      return {schema:'skill-install-target-v1',target,status:'present',kind:item.isDirectory() ? 'directory' : 'other'};
    } catch (error) { return {schema:'skill-install-target-v1',target,status:'unavailable',at:root,code:error.code || 'UNKNOWN'}; }
  }
  let current = root;
  for (let i = 0; i < segments.length; i++) {
    current = path.join(current, segments[i]);
    let item;
    try { item = await lstat(current); }
    catch (error) {
      if (error.code === 'ENOENT') return {schema:'skill-install-target-v1',target,status:'missing',first_missing:current};
      return {schema:'skill-install-target-v1',target,status:'unavailable',at:current,code:error.code || 'UNKNOWN'};
    }
    if (i === segments.length - 1) {
      const kind = item.isSymbolicLink() ? 'symlink' : item.isDirectory() ? 'directory' : item.isFile() ? 'file' : 'other';
      return {schema:'skill-install-target-v1',target,status:'present',kind};
    }
    try {
      const parent = item.isSymbolicLink() ? await stat(current) : item;
      if (!parent.isDirectory()) return {schema:'skill-install-target-v1',target,status:'unavailable',at:current,code:'NOT_DIRECTORY'};
    } catch (error) {
      return {schema:'skill-install-target-v1',target,status:'unavailable',at:current,code:error.code || 'UNKNOWN'};
    }
  }
}
