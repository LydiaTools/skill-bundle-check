import { inspectMarkdown } from '../src/review-pipes.js';
const $ = id => document.getElementById(id);
const strings = {
 en:{folderLink:'Compare Skill folders',eyebrow:'Markdown / Skill files',heading:'Review table escapes',intro:'Find escaped pipes in inline code inside Markdown tables.',input:'Markdown',placeholder:'Paste Markdown here or open a file.',local:'Your text stays in this tab.',check:'Check text',open:'Open file',example:'Try example',results:'Review',empty:'Results appear here after you check your text.',advisory:'A hint is not an error. The escape may be intentional; review the command in context.',truncated:'Showing the first 1,000 hints. More matches exist.',limits:'Checks inline code in ordinary single-line Markdown tables. Other cases can be missed or over-reported. Columns use UTF-16 units. No command is executed or changed.',docs:'How this check works',tooLarge:'This file or text exceeds 1 MiB. Choose a smaller input.',badFile:'The file could not be read as UTF-8.',none:'No matching escapes found.',found:n=>`${n} ${n===1?'place':'places'} to review`,location:(l,c)=>`Line ${l}, column ${c}`,noText:'Paste Markdown or open a file first.',replace:'Replace the current text?'},
 zh:{folderLink:'对比 Skill 文件夹',eyebrow:'Markdown / Skill 文件',heading:'检查表格里的转义',intro:'找出 Markdown 表格行内代码中带反斜杠的竖线。',input:'Markdown',placeholder:'粘贴 Markdown 或打开文件。',local:'文本只保留在当前标签页。',check:'检查文本',open:'打开文件',example:'试用示例',results:'待复核',empty:'检查后在这里显示结果。',advisory:'提示不代表错误。转义可能是有意的，请结合命令上下文判断。',truncated:'仅显示前 1,000 条提示，还有其他匹配项。',limits:'检查普通单行 Markdown 表格中的行内代码；其他情况可能漏报或多报。列号按 UTF-16 单元计算。不会执行或修改命令。',docs:'了解检查范围',tooLarge:'文件或文本超过 1 MiB，请选择较小的内容。',badFile:'无法以 UTF-8 读取文件。',none:'没有发现匹配的转义。',found:n=>`${n} 处待复核`,location:(l,c)=>`第 ${l} 行，第 ${c} 列`,noText:'请先粘贴 Markdown 或打开文件。',replace:'替换当前文本？'}
};
const limit=1024*1024;
const example="# Fictional example\n\n| Intent | Command |\n| --- | --- |\n| Pipeline | `printf 'b\\na\\n' \\| sort` |\n| Literal pipe can be intentional | `grep -E 'cat\\|dog' sample.txt` |\n";
let revision=0;
let language=new URLSearchParams(location.search).get('lang')==='zh'?'zh':'en';let findings=null, truncated=false;
function text(){return strings[language]}
function bytes(value){return new TextEncoder().encode(value).length}
function updateSize(){$('size').textContent=`${bytes($('source').value).toLocaleString(language==='zh'?'zh-CN':'en-US')} B / 1 MiB`}
function error(key){$('error').hidden=!key;$('error').textContent=key?text()[key]:'';$('error').dataset.key=key||''}
function display(){
 $('compare-folders').href=language==='zh'?'./diff.html?lang=zh':'./diff.html';
 const t=text();document.documentElement.lang=language==='zh'?'zh-CN':'en';document.title=`${t.heading} | Skill Bundle Check`;document.querySelectorAll('[data-key]').forEach(el=>el.textContent=t[el.dataset.key]);$('source').placeholder=t.placeholder;$('language').textContent=language==='en'?'中文':'English';
 $('empty').hidden=findings!==null;$('report').hidden=findings===null;$('count').textContent=findings===null?'—':String(findings.length)+(truncated?'+':'');
 if(findings!==null){$('summary').textContent=findings.length?t.found(findings.length):t.none;$('truncated').hidden=!truncated;$('findings').replaceChildren();findings.forEach(f=>{const li=document.createElement('li'),button=document.createElement('button');button.type='button';button.className='location';button.textContent=t.location(f.line,f.column);button.addEventListener('click',()=>{let lines=$('source').value.split('\n');let start=lines.slice(0,f.line-1).reduce((n,v)=>n+v.length+1,0)+f.column-1;$('source').focus();$('source').setSelectionRange(start,start+2)});li.append(button);$('findings').append(li)})}
 error($('error').dataset.key||'');updateSize();
}
$('language').addEventListener('click',()=>{language=language==='en'?'zh':'en';const url=new URL(location.href);url.searchParams.set('lang',language);history.replaceState(null,'',url);display()});
$('source').addEventListener('input',()=>{revision++;findings=null;truncated=false;error('');display()});
$('check').addEventListener('click',()=>{const input=$('source').value;if(!input.trim()){error('noText');return}if(bytes(input)>limit){error('tooLarge');return}error('');const all=inspectMarkdown(input);truncated=all.length>1000;findings=all.slice(0,1000);display()});
$('example').addEventListener('click',()=>{if($('source').value && !confirm(text().replace))return;revision++;$('source').value=example;findings=null;truncated=false;error('');display()});
$('file').addEventListener('change',async e=>{const file=e.target.files[0];e.target.value='';const ticket=++revision;if(!file)return;if($('source').value && !confirm(text().replace))return;if(file.size>limit){error('tooLarge');return}try{const data=await file.arrayBuffer();if(ticket!==revision)return;const value=new TextDecoder('utf-8',{fatal:true}).decode(data);$('source').value=value;findings=null;truncated=false;error('');display()}catch{if(ticket===revision)error('badFile')}});
display();
