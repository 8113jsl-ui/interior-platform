import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApplication} from '../server/app.mjs';
const manifest=JSON.parse(await readFile(new URL('../docs/reference-pages.json',import.meta.url)));
test('all captured reference routes and assets are served locally',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'reference-pages-'));
 const app=await createApplication({dataDir:dir,port:0,test:true});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${app.server.address().port}`;
 try{
  assert.deepEqual(manifest.failures,[]);
  for(const route of manifest.routes){
   const response=await fetch(base+route);assert.equal(response.status,200,route);
   assert.match(response.headers.get('content-type'),/text\/html/);
   const html=await response.text();assert.equal((html.match(/src="\/assets\/heron-subpages-motion.js"/g)||[]).length,1,route);
   assert.ok(html.includes('form-action &#39;none&#39;')||html.includes("form-action 'none'"));
   for(const m of html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)){const asset=await fetch(base+m[1],{method:'HEAD'});assert.equal(asset.status,200,`${route} ${m[1]}`);}
   // Include SVG <image href>, relative paths and responsive source candidates.
   for(const tag of html.matchAll(/<(?:img|image|source)\b[^>]*>/gi)){
    for(const attr of tag[0].matchAll(/(?:src|href|srcset)\s*=\s*(["'])([\s\S]*?)\1/g)){
     for(const value of attr[2].trim().split(',').map(x=>x.trim().split(/\s+/)[0])){
      if(!value||value.startsWith('data:'))continue;
      const url=new URL(value,base+route);assert.equal(url.origin,base,`${route}: external image`);
      const asset=await fetch(url,{method:'HEAD'});assert.equal(asset.status,200,`${route}: ${value}`);
     }
    }
   }
  }
  const login=await fetch(base+'/login',{redirect:'manual'});assert.equal(login.status,302);assert.equal(login.headers.get('location'),'/app/');
  assert.equal((await fetch(base+'/api/state')).status,401);
 }finally{await new Promise(resolve=>app.server.close(resolve));await app.close();await rm(dir,{recursive:true,force:true});}
});
