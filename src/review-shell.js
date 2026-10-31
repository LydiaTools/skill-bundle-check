import { lstat, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

// Review hints only: these paths may be relative to a project or another cwd.
export async function reviewShell(sourcePath, installedPath) {
  const roots = await Promise.all([sourcePath, installedPath].map(async (value) => {
    const root = await realpath(path.resolve(value));
    if (!(await stat(root)).isDirectory()) throw new Error(`Not a directory: ${value}`);
    return root;
  }));
  if (roots[0] === roots[1]) throw new Error('Choose two separate skill folders.');
  const document = path.join(roots[0], 'SKILL.md');
  const info = await lstat(document);
  if (!info.isFile() || info.size > 1024 * 1024) throw new Error('Source SKILL.md must be a regular file no larger than 1 MiB.');
  const lines = (await readFile(document, 'utf8')).split(/\r?\n/);
  const findings = [];
  let fence = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (!fence) {
      if (!marker || (marker[1][0] === '`' && marker[2].includes('`'))) continue;
      const language = marker[2].trim().split(/\s+/, 1)[0].toLowerCase();
      fence = { marker: marker[1], shell: ['sh', 'shell', 'bash', 'zsh'].includes(language) };
      continue;
    }
    if (marker && marker[1][0] === fence.marker[0] && marker[1].length >= fence.marker.length && !marker[2].trim()) { fence = null; continue; }
    if (!fence.shell) continue;
    const match = /^\s*(?:(?:bash|sh|zsh|python|python3|node)\s+)?(\.\/scripts\/[A-Za-z0-9_./-]+)(?=\s|$)/.exec(line);
    if (!match || match[1].split('/').includes('..')) continue;
    if (findings.length >= 1000) return { schema:'skill-shell-path-review-v1', findings, truncated:true };
    const relative = match[1].slice(2);
    findings.push({line:i+1, commandPath:match[1], sourceRoot:await pathStatus(roots[0], relative), installedRoot:await pathStatus(roots[1], relative)});
  }
  return { schema:'skill-shell-path-review-v1', findings, truncated:false };
}

async function pathStatus(root, relative) {
  try {
    const target = path.join(root, relative);
    // Do not follow links outside the selected bundle.
    const resolved = await realpath(target);
    const tail = path.relative(root, resolved);
    if (tail === '..' || tail.startsWith(`..${path.sep}`) || path.isAbsolute(tail)) return 'outside-root';
    const info = await stat(resolved);
    return info.isFile() ? 'file' : info.isDirectory() ? 'directory' : 'other';
  } catch (error) {
    return error.code === 'ENOENT' ? 'missing' : 'unavailable';
  }
}
