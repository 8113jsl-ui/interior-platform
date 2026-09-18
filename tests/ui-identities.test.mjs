import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApplication} from '../server/app.mjs';
import '../public/ui/identity-core.js';
const core=globalThis.UIIdentityCore;
const pages=JSON.parse(await readFile(new URL('../public/ui/page-registry.json',import.meta.url)));
const elements=JSON.parse(await readFile(new URL('../docs/ui-element-registry.json',import.meta.url)));
test('registered page and element IDs are globally unique and prefixed',()=>{
 assert.equal(new Set(pages.map(p=>p.id)).size,pages.length);
 assert.equal(new Set(elements.map(p=>p.id)).size,elements.length);
 for(const e of elements)assert.ok(e.id.startsWith(e.page.split('_')[0]+'_'));
});
test('internal destinations resolve to the actual public or role-specific page',()=>{
 assert.equal(core.pageFor('/about-us',pages).id,pages.find(p=>p.path==='/about-us').id);
 assert.equal(core.pageFor('/resources?sc=ai-practices',pages).id,'P02_LIST');
 assert.equal(core.pageFor('/app/#/pm/preferences',pages).id,'P05_MYPAGE');
 assert.equal(core.pageFor('/app/#/pm/projects',pages).legacyScreenId,'PM-01');
 assert.equal(core.pageFor('/app/#/field/photos?project=example',pages).legacyScreenId,'FW-01');
 assert.equal(core.pageFor('/login',pages).id,'P04_LOGIN');
});
test('identity keys do not depend on translations, values or active classes',()=>{
 const a={id:'save',class:'button active',value:'secret',text:'저장'};
 const b={id:'save',class:'button',value:'changed',text:'Save'};
 assert.equal(core.signature('button',a),core.signature('button',b));
 assert.equal(core.signature('button',{class:'button active'}),core.signature('button',{class:'button'}));
 assert.equal(core.elementId('P01_HOME','BUTTON','stable'),core.elementId('P01_HOME','BUTTON','stable'));
 assert.notEqual(core.elementId('P01_HOME','BUTTON','stable'),core.elementId('P02_LIST','BUTTON','stable'));
});
test('production disables overlay even when SHOW_ELEMENT_IDS is enabled',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'ui-id-config-'));
 const app=await createApplication({dataDir:dir,port:0,test:true,showElementIds:true});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${app.server.address().port}`;
 try{
  assert.deepEqual(await fetch(base+'/api/ui-config').then(r=>r.json()),{showElementIds:true,allowElementIds:true});
  app.config.production=true;
  assert.deepEqual(await fetch(base+'/api/ui-config?elementIds=1').then(r=>r.json()),{showElementIds:false,allowElementIds:false});
 }finally{await new Promise(resolve=>app.server.close(resolve));await app.close();await rm(dir,{recursive:true,force:true});}
});
