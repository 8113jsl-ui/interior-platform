import {test} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {Store} from '../server/repository.mjs';
import {storeFile} from '../server/files.mjs';
test('file processor decodes PNG, denies renamed garbage and cross-parent references',async()=>{
 const store=new Store(),memory=new Map(),driver={put:async(id,bytes)=>memory.set(id,bytes)},config={maxFileBytes:20*1024*1024};
 const png=await sharp({create:{width:2,height:2,channels:3,background:'#fa3600'}}).png().toBuffer();const data='data:image/png;base64,'+png.toString('base64');
 const url=await storeFile(store,data,{parent:'items:p1',company:'a',image:true},config,driver);assert.match(url,/^\/api\/files\//);assert.equal(memory.size,1);
 await assert.rejects(storeFile(store,'data:image/png;base64,YmFk',{parent:'items:p1',company:'a',image:true},config,driver),/invalid_image/);
 await assert.rejects(storeFile(store,url,{parent:'items:p2',company:'a',image:true},config,driver),/file_scope/);
 await assert.rejects(storeFile(store,'data:application/pdf;base64,YmFk',{parent:'items:p1',company:'a',name:'fake.pdf'},config,driver),/invalid_pdf/);
});
