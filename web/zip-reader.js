// A bounded, directory-only reader for single-Skill ZIP review. It does not
// extract entries, validate file contents, or certify any platform upload.
const MAX_ARCHIVE=64*1024*1024, MAX_DIR=4*1024*1024, MAX_ENTRIES=5000, MAX_RESULTS=25;
const signature=(v,i,n)=>i>=0&&i+4<=v.byteLength&&v.getUint32(i,true)===n;
const fail=()=>{throw new Error('unsupported')};

export async function inspectSkillZip(file){
  if(file.size>MAX_ARCHIVE)throw new Error('large');
  const start=Math.max(0,file.size-65557), tail=new DataView(await file.slice(start).arrayBuffer());
  let end=-1, candidates=0;
  for(let p=tail.byteLength-22;p>=0;p--){
    if(signature(tail,p,0x06054b50)&&p+22+tail.getUint16(p+20,true)===tail.byteLength){end=p;candidates++}
  }
  if(candidates!==1)fail();
  for(let p=end+22;p+4<=tail.byteLength;p++)if(signature(tail,p,0x06054b50))fail();
  const disk=tail.getUint16(end+4,true), cdDisk=tail.getUint16(end+6,true);
  const diskCount=tail.getUint16(end+8,true), count=tail.getUint16(end+10,true);
  const length=tail.getUint32(end+12,true), offset=tail.getUint32(end+16,true);
  if(disk||cdDisk||diskCount!==count||count===0xffff||length===0xffffffff||offset===0xffffffff)fail();
  if(count>MAX_ENTRIES||length>MAX_DIR)throw new Error('large');
  if(offset+length!==start+end)fail();
  const data=new DataView(await file.slice(offset,offset+length).arrayBuffer());
  let p=0, findings=[], skillFiles=[], seen=new Set();
  for(let i=0;i<count;i++){
    if(p+46>data.byteLength||!signature(data,p,0x02014b50))fail();
    const madeBy=data.getUint16(p+4,true)>>>8, flags=data.getUint16(p+8,true);
    const nameLen=data.getUint16(p+28,true), extraLen=data.getUint16(p+30,true), commentLen=data.getUint16(p+32,true);
    const next=p+46+nameLen+extraLen+commentLen;
    if(!nameLen||next>data.byteLength)fail();
    const raw=new Uint8Array(data.buffer,data.byteOffset+p+46,nameLen);
    if(!(flags&0x800)&&raw.some(x=>x>127))fail();
    let name;try{name=new TextDecoder('utf-8',{fatal:true}).decode(raw)}catch{fail()}
    // Unicode Path extra fields can rename a central-directory entry; do not
    // silently report the legacy filename as the only name.
    const extraStart=p+46+nameLen, extraEnd=extraStart+extraLen;
    for(let x=extraStart;x<extraEnd;){
      if(x+4>extraEnd)fail();const kind=data.getUint16(x,true), n=data.getUint16(x+2,true);
      if(x+4+n>extraEnd||kind===0x7075)fail();x+=4+n;
    }
    if(name.includes('\0'))findings.push({code:'NUL_IN_PATH',path:name});
    if(!name||name.includes('\\')||name.startsWith('/')||/^[A-Za-z]:/.test(name)||name.split('/').includes('..'))findings.push({code:'UNSAFE_PATH',path:name});
    if(seen.has(name))findings.push({code:'DUPLICATE_PATH',path:name});seen.add(name);
    const mode=data.getUint32(p+38,true)>>>16;
    if(madeBy===3&&(mode&0xf000)===0xa000)findings.push({code:'SYMLINK',path:name});
    if(flags&1)findings.push({code:'ENCRYPTED_ENTRY',path:name});
    if(!name.endsWith('/')){
      const base=name.split('/').at(-1);
      if(base==='SKILL.md')skillFiles.push(name);
      else if(base.toLowerCase()==='skill.md')findings.push({code:'ENTRYPOINT_CASE',path:name});
    }
    p=next;
  }
  if(p!==data.byteLength)fail();
  if(skillFiles.length!==1)findings.push({code:'ENTRYPOINT_COUNT',count:skillFiles.length});
  return {status:findings.length?'review':'ok',entries:count,skillCount:skillFiles.length,
          skillFiles:skillFiles.slice(0,MAX_RESULTS),findings:findings.slice(0,MAX_RESULTS),findingCount:findings.length};
}
