
// Advisory only. This recognizes ordinary single-line GFM pipe tables and code spans;
// it does not parse all Markdown or interpret shell/regex semantics.
function slashCount(s, i) { let j=i-1; while(j>=0 && s[j]==='\\') j--; return i-j-1; }
function isEscaped(s,i) { return slashCount(s,i)%2===1; }
function cells(s) {
  let parts=[], start=0;
  for(let i=0;i<s.length;i++) if(s[i]==='|' && !isEscaped(s,i)) {parts.push(s.slice(start,i));start=i+1;}
  parts.push(s.slice(start));
  if(s.trimStart().startsWith('|')) parts.shift();
  if(s.trimEnd().endsWith('|') && !isEscaped(s,s.lastIndexOf('|'))) parts.pop();
  return parts;
}
function hasSeparator(s) {for(let i=0;i<s.length;i++) if(s[i]==='|'&&!isEscaped(s,i)) return true; return false;}
function separator(s) {
  if(!hasSeparator(s)) return false;
  const items=cells(s); return items.length>0 && items.every(x=>/^\s*:?-+:?\s*$/.test(x));
}
function codeSpans(s) {
  const spans=[];
  for(let i=0;i<s.length;) {
    if(s[i]!=='`' || isEscaped(s,i)) {i++;continue;}
    const start=i;while(s[i]==='`')i++; const n=i-start;const body=i;
    let found=false;
    while(i<s.length) {
      if(s[i]!=='`') {i++;continue;}
      const k=i;while(s[i]==='`')i++;if(i-k===n) {spans.push([body,k]);found=true;break;}
    }
    if(!found) break;
  }
  return spans;
}
function finding(line, column) {
  return {line, column, code:'TABLE_INLINE_ESCAPED_PIPE', message:'Review the raw \\| in this table code span. It may differ from the rendered pipe or be intentional (for example GNU BRE alternation). No command was run or changed.'};
}
export function inspectMarkdown(markdown, limit = 1001) {
  const lines=markdown.split(/\r?\n/), result=[];let inFence=null,inTable=false;
  function inspectLine(line, index) {
    for(const [start,end] of codeSpans(line)) for(let i=start;i<end;i++) {
      if(line[i]==='|' && isEscaped(line,i)) { result.push(finding(index+1,i)); if(result.length >= limit) return; }
    }
  }
  for(let index=0;index<lines.length;index++) {
    const line=lines[index];const fence=line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if(fence) {
      const token=fence[1];
      if(!inFence && (token[0]!=='`' || !fence[2].includes('`'))) inFence={char:token[0],length:token.length};
      else if(inFence && token[0]===inFence.char && token.length>=inFence.length && !fence[2].trim()) inFence=null;
      inTable=false;continue;
    }
    if(inFence) continue;
    if(/^(?: {4}|\t)/.test(line)) {inTable=false;continue;}
    if(separator(line) && index>0 && !/^(?: {4}|\t)/.test(lines[index-1]) && hasSeparator(lines[index-1]) && cells(line).length===cells(lines[index-1]).length) {inTable=true;inspectLine(lines[index-1],index-1);if(result.length>=limit)return result;continue;}
    if(!inTable || !line.trim() || /^ {4}/.test(line) || !hasSeparator(line)) {inTable=false;continue;}
    inspectLine(line,index);
    if(result.length>=limit) return result;
  }
  return result;
}
