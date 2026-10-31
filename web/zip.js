import {inspectSkillZip} from './zip-reader.js';
const $=id=>document.getElementById(id);
const strings={
 en:{heading:'Review a Skill ZIP',intro:'Choose a ZIP to check its structure before uploading one Skill.',chooseHeading:'Choose a ZIP',choose:'Choose ZIP',none:'No file selected.',privacy:'The selected file stays in this browser tab.',results:'Results',empty:'Choose a ZIP to begin.',scope:'Checks ZIP directory metadata only. It does not read file contents, validate YAML or prove that an upload will succeed.',limits:'Single-Skill ZIPs only. Maximum 64 MiB and 5,000 entries. ZIP64 and some ZIP formats are unsupported.',other:'Compare Skill folders',working:'Checking ZIP…',ok:'No structural findings.',review:n=>`${n} ${n===1?'item needs':'items need'} review.`,unavailable:'Could not check this ZIP. It may be damaged or use an unsupported format.',large:'This ZIP exceeds the inspection limit.',skill:'SKILL.md',more:n=>`${n} more findings`,SYMLINK:'Symbolic link — some uploaders reject links',DUPLICATE_PATH:'Duplicate path — rebuild without duplicates',UNSAFE_PATH:'Unsafe path',NUL_IN_PATH:'NUL in path',ENCRYPTED_ENTRY:'Encrypted entry',ENTRYPOINT_CASE:'Check filename case',ENTRYPOINT_COUNT:n=>`SKILL.md entries found: ${n} — choose a single-Skill package`},
 zh:{heading:'检查 Skill ZIP',intro:'选择 ZIP，上传单个 Skill 前先检查文件结构。',chooseHeading:'选择 ZIP',choose:'选择 ZIP',none:'尚未选择文件。',privacy:'所选文件仅在当前浏览器标签页处理。',results:'检查结果',empty:'选择 ZIP 后开始检查。',scope:'只检查 ZIP 目录信息，不读取文件内容、不验证 YAML，也不保证一定能上传成功。',limits:'仅检查单个 Skill 的 ZIP，最大 64 MiB、5,000 个条目；不支持 ZIP64 及部分 ZIP 格式。',other:'对比 Skill 文件夹',working:'正在检查 ZIP…',ok:'未发现结构问题。',review:n=>`${n} 项需要检查。`,unavailable:'无法检查这个 ZIP：文件可能损坏或格式暂不支持。',large:'ZIP 超出检查限制。',skill:'SKILL.md',more:n=>`还有 ${n} 项提示`,SYMLINK:'符号链接（部分平台不接受）',DUPLICATE_PATH:'重复路径（请重新打包）',UNSAFE_PATH:'不安全路径',NUL_IN_PATH:'路径包含空字符',ENCRYPTED_ENTRY:'加密条目',ENTRYPOINT_CASE:'检查文件名大小写',ENTRYPOINT_COUNT:n=>`发现 ${n} 个 SKILL.md 条目（请使用单个 Skill 的包）`}
};
strings.en.example='Try fictional example';strings.en.exampleName='Fictional example';
strings.zh.example='试用虚构示例';strings.zh.exampleName='虚构示例';
strings.en.guide='ZIP looks clean but upload fails?';strings.zh.guide='结构正常但仍上传失败？';
const exampleZip='UEsDBBQAAAgAAAAAAAAAAAAAAAAAAAAAAAAQAAAAZXhhbXBsZS9TS0lMTC5tZFBLAwQUAAAIAAAAAAAAAAAAAAAAAAAAAAAAFgAAAGV4YW1wbGUvYWxpYXMvU0tJTEwubWRQSwECFAMUAAAIAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAApIEAAAAAZXhhbXBsZS9TS0lMTC5tZFBLAQIUAxQAAAgAAAAAAAAAAAAAAAAAAAAAAAAWAAAAAAAAAAAAAAD/oS4AAABleGFtcGxlL2FsaWFzL1NLSUxMLm1kUEsFBgAAAAACAAIAggAAAGIAAAAAAA==';
let lang=new URLSearchParams(location.search).get('lang')==='zh'?'zh':'en', result=null, error='', working=false, selected='', sample=false, revision=0;
const t=()=>strings[lang];
// Escape invisible control/bidi characters so a ZIP entry cannot visually
// impersonate another filename in the findings list.
const safe=s=>s.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
function render(){
 document.documentElement.lang=lang==='zh'?'zh-CN':'en';document.title=t().heading+' | Skill Bundle Check';
 document.querySelectorAll('[data-key]').forEach(el=>el.textContent=t()[el.dataset.key]);
 $('language').textContent=lang==='en'?'中文':'English';$('archive').setAttribute('aria-label',t().choose);
 $('filename').textContent=sample?t().exampleName:selected?safe(selected):t().none;$('other').href=lang==='zh'?'./diff.html?lang=zh':'./diff.html';$('guide').href='https://github.com/LydiaTools/skill-bundle-check/blob/main/docs/zip-clean-but-upload-fails'+(lang==='zh'?'.zh-CN':'')+'.md';
 $('count').textContent=result?String(result.findingCount):'—';$('results').replaceChildren();
 $('summary').textContent=working?t().working:error?t()[error]:result?(result.status==='ok'?t().ok:t().review(result.findingCount)):t().empty;
 if(!result)return;
 const add=text=>{const li=document.createElement('li');li.className='diff-row';li.textContent=text;$('results').append(li)};
 for(const path of result.skillFiles)add(t().skill+' · '+safe(path));
 for(const item of result.findings)add((typeof t()[item.code]==='function'?t()[item.code](item.count):t()[item.code])+(item.path?' · '+safe(item.path):''));
 if(result.findingCount>result.findings.length)add(t().more(result.findingCount-result.findings.length));
}
$('language').addEventListener('click',()=>{lang=lang==='en'?'zh':'en';const url=new URL(location.href);url.searchParams.set('lang',lang);history.replaceState(null,'',url);render()});
$('archive').addEventListener('click',()=>{$('archive').value=''});
async function run(file,name,isSample){
 const ticket=++revision;result=null;error='';working=Boolean(file);selected=name;sample=isSample;render();if(!file)return;
 try{const next=await inspectSkillZip(file);if(ticket!==revision)return;result=next}
 catch(e){if(ticket!==revision)return;error=e.message==='large'?'large':'unavailable'}
 finally{if(ticket===revision){working=false;render()}}
}
$('archive').addEventListener('change',()=>{const file=$('archive').files[0];run(file,file?.name||'',false)});
$('example').addEventListener('click',()=>{$('archive').value='';const bytes=Uint8Array.from(atob(exampleZip),c=>c.charCodeAt(0));run(new Blob([bytes]),'',true)});
render();
