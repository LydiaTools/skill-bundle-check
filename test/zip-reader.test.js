import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectSkillZip} from '../web/zip-reader.js';
import {makeZip} from './zip-fixtures.mjs';
const check=entries=>inspectSkillZip(new Blob([makeZip(entries)]));

test('one exact entry is found without reading file contents',async()=>{
 const x=await check([{name:'paper/SKILL.md'},{name:'paper/references/one.md'}]);
 assert.equal(x.status,'ok');assert.deepEqual(x.skillFiles,['paper/SKILL.md']);assert.equal(x.entries,2);
});
test('finds symlinks, duplicate paths, case differences, unsafe paths and encryption',async()=>{
 const x=await check([{name:'SKILL.md'},{name:'SKILL.md'},{name:'nested/SKILL.md',mode:0o120777},{name:'skill.md'},{name:'../escape'},{name:'C:/escape'},{name:'private',flags:0x801},{name:'a\0b'}]);
 const codes=x.findings.map(x=>x.code);
 for(const code of ['DUPLICATE_PATH','SYMLINK','ENTRYPOINT_CASE','UNSAFE_PATH','ENCRYPTED_ENTRY','NUL_IN_PATH','ENTRYPOINT_COUNT'])assert(codes.includes(code),code);
 assert.equal(x.skillCount,3);assert.equal(x.status,'review');
});
test('UTF-8 names work; legacy non-ASCII and Unicode Path metadata fail closed',async()=>{
 assert.deepEqual((await check([{name:'动画/SKILL.md'}])).skillFiles,['动画/SKILL.md']);
 await assert.rejects(check([{name:'动画/SKILL.md',flags:0}]),/unsupported/);
 await assert.rejects(check([{name:'SKILL.md',extra:Buffer.from([0x75,0x70,0,0])}]),/unsupported/);
});
test('rejects corrupt, ambiguous, ZIP64 and trailing data instead of showing a clean result',async()=>{
 await assert.rejects(inspectSkillZip(new Blob(['not a zip'])),/unsupported/);
 const fake=Buffer.alloc(22);fake.writeUInt32LE(0x06054b50,0);
 await assert.rejects(inspectSkillZip(new Blob([makeZip([{name:'SKILL.md'}],fake)])),/unsupported/);
 await assert.rejects(inspectSkillZip(new Blob([makeZip([{name:'SKILL.md'}]),'trailing'])),/unsupported/);
 const zip64=makeZip([{name:'SKILL.md'}]);zip64.writeUInt16LE(0xffff,zip64.length-12);zip64.writeUInt16LE(0xffff,zip64.length-14);
 await assert.rejects(inspectSkillZip(new Blob([zip64])),/unsupported/);
});
test('size and entry limits stop the review',async()=>{
 const many=makeZip(Array.from({length:5001},(_,i)=>({name:`f${i}`})));
 await assert.rejects(inspectSkillZip(new Blob([many])),/large/);
 const oversized={size:64*1024*1024+1,slice(){throw new Error('should not read')}};
 await assert.rejects(inspectSkillZip(oversized),/large/);
});
