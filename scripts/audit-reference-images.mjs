import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import sharp from 'sharp';
const root=resolve(import.meta.dirname,'..');
const manifest=JSON.parse(await readFile(resolve(root,'docs/reference-pages.json')));
const failures=[];let images=0;
for(const route of manifest.routes){
 const html=await readFile(resolve(root,'public',route==='/'?'index.html':route.slice(1)+'.html'),'utf8');
 for(const tag of html.matchAll(/<(?:img|source|image)\b[^>]*>/gi)){
  for(const a of tag[0].matchAll(/(?:src|srcset|href)\s*=\s*(["'])([\s\S]*?)\1/g)){
   for(const candidate of a[2].trim().split(',').map(x=>x.trim().split(/\s+/)[0])){
    if(!candidate||candidate.startsWith('data:'))continue;
    const url=new URL(candidate,'http://127.0.0.1:8766'+route);
    const r=await fetch(url);if(!r.ok)failures.push({route,url:url.href,status:r.status});
   }
  }
 }
}
for(const {file} of manifest.assets){if(!/\.(png|jpg|jpeg|webp|avif)$/.test(file))continue;images++;try{await sharp(resolve(root,'public','.'+file)).stats();}catch(e){failures.push({file,error:e.message});}}
console.log(JSON.stringify({pages:manifest.routes.length,images,failures},null,2));
if(failures.length)process.exitCode=1;
