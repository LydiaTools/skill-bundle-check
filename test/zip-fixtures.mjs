// Synthetic empty-file ZIPs for tests. No external archive data is included.
export function makeZip(entries, comment=Buffer.alloc(0)){
 const local=[], central=[];let offset=0;
 for(const e of entries){
  const name=Buffer.from(e.name,'utf8'), extra=e.extra||Buffer.alloc(0), flags=e.flags??0x800;
  const l=Buffer.alloc(30);l.writeUInt32LE(0x04034b50,0);l.writeUInt16LE(20,4);l.writeUInt16LE(flags,6);l.writeUInt16LE(name.length,26);
  local.push(l,name);
  const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE((3<<8)|20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(flags,8);c.writeUInt16LE(name.length,28);c.writeUInt16LE(extra.length,30);
  c.writeUInt32LE((((e.mode??0o100644)<<16)>>>0),38);c.writeUInt32LE(offset,42);
  central.push(c,name,extra);offset+=l.length+name.length;
 }
 const directory=Buffer.concat(central),end=Buffer.alloc(22);
 end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);end.writeUInt16LE(comment.length,20);
 return Buffer.concat([...local,directory,end,comment]);
}
