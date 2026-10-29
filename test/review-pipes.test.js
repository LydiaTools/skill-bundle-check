import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectMarkdown } from '../src/review-pipes.js';
test('table inline code flags escaped pipes with 1-based line/column',()=>{
 const text='Heading\n| Task | Run |\n| --- | --- |\n| A | `echo x \\| sort` |\n';const x=inspectMarkdown(text);assert.equal(x.length,1);assert.equal(x[0].line,4);assert.equal(x[0].column,15);assert.match(x[0].message,/Review/);assert.match(x[0].message,/GNU BRE/);
});
test('fenced blocks prose and unescaped pipe are excluded',()=>{
 const text='```md\n| A | B |\n|---|---|\n| `echo \\| x` | y |\n```\n\nProse `x \\| y`\n| A | B |\n|---|---|\n| `echo x | sort` | y |';assert.equal(inspectMarkdown(text).length,0);
});
test('odd escapes only; repeated slash and code span delimiters',()=>{
 const text='A | B\n--- | ---\nx | ``grep \'a\\|b\'``\nx | `echo x \\\\| sort`\nx | `a\\\\\\|b`';const x=inspectMarkdown(text);assert.deepEqual(x.map(t=>t.line),[3,5]);
});
test('closing inline delimiter required, plain table pipe not enough',()=>{
 const text='| A | B |\n|---|---|\n| plain \\| data | x |\n| `unclosed \\| data | x |';assert.equal(inspectMarkdown(text).length,0);
});
test('CRLF and real source retain locations',()=>{
 const x=inspectMarkdown('| x | y |\r\n| - | - |\r\n| q | `echo \\| cat` |');assert.equal(x.length,1);assert.equal(x[0].line,3);
});
test('table header is checked while indented code blocks are skipped',()=>{
 const text='| `a\\|b` | cmd |\n|---|---|\n| x | y |\n\n    | H | H |\n    |---|---|\n    | `a\\|b` | x |';const x=inspectMarkdown(text);assert.deepEqual(x.map(r=>r.line),[1]);
});


test('UTF-16 columns and escaped separators work after emoji',()=>{
 const line='| 💡 | `grep a\\|b` |';
 const x=inspectMarkdown('| A | B |\n|---|---|\n'+line);
 assert.equal(x.length,1);assert.equal(x[0].column,line.indexOf('\\')+1);
});


test('mismatched table header and divider counts are excluded',()=>{
 assert.equal(inspectMarkdown('a | b | c\n--- | ---\nx | `echo x \\| sort`').length,0);
});
