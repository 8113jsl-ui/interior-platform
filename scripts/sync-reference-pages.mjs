// Explicit public-page capture. Does not crawl accounts or submit forms.
import {mkdir,readFile,writeFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,extname} from 'node:path';
const root=resolve(import.meta.dirname,'..'), out=resolve(root,'public'), assets=resolve(out,'assets');
const origin='https://heronaiapp.com';
const routes=['/','/about-us','/heron-chat-widget','/heron-dashboard','/pricing','/resources','/contact-us','/privacy-policy','/terms-and-conditions','/cookie-policy'];
const bundle='https://heronai-bp.netlify.app/main.js';
const mapping=new Map(), failures=[], pages=new Map(), downloaded=new Set();
const decode=s=>s.replaceAll('&amp;','&');
const absolute=(s,base)=>new URL(decode(s),base).href;
const blocked=s=>/googletagmanager|google-analytics|clarity\.ms|localhost:3000|\/config\.js/.test(s);
function filename(url){let ext=extname(new URL(url).pathname); if(!/^\.[a-z0-9]{1,7}$/i.test(ext))ext='.js';return createHash('sha256').update(url).digest('hex').slice(0,18)+ext;}
async function get(url){const r=await fetch(url,{signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error(`${r.status} ${url}`);return Buffer.from(await r.arrayBuffer());}
function cssUrls(text,base){text=text.replaceAll('\\(','%28').replaceAll('\\)','%29');return [...text.matchAll(/url\(\s*['"]?([^\s)'"]+)['"]?\s*\)/g)].map(m=>m[1]).filter(s=>!s.startsWith('data:')&&!s.startsWith('#')).map(s=>absolute(s,base));}
function pageUrls(text,base){const result=new Set(cssUrls(text,base));for(const m of text.matchAll(/<(img|image|script|source|video|audio|link)\b[^>]*>/gi)){const tag=m[0];if(m[1]==='link'&&!/rel="(?:stylesheet|icon|preload|apple-touch-icon)/.test(tag))continue;for(const a of tag.matchAll(/(?:src|poster|href)="([^"]+)"/g))result.add(absolute(a[1],base));for(const a of tag.matchAll(/srcset="([^"]+)"/g))for(const part of a[1].split(','))result.add(absolute(part.trim().split(/\s+/)[0],base));}return [...result].filter(s=>/^https?:/.test(s)&&!blocked(s));}
await mkdir(assets,{recursive:true});
for(const route of routes){const html=(await get(origin+route)).toString();pages.set(route,html);for(const m of html.matchAll(/href=['"](\/(?:insights|ai-practices|design-workflows)\/[^'"?#]+)['"]/g))if(!routes.includes(m[1]))routes.push(m[1]);console.log('Read',route);}
let pending=new Set([bundle,...[...pages].flatMap(([route,html])=>pageUrls(html,origin+route))]);
while(pending.size){const batch=[...pending];pending=new Set();for(let i=0;i<batch.length;i+=8){await Promise.all(batch.slice(i,i+8).map(async url=>{if(mapping.has(url))return;const name=url===bundle?'heron-subpages-motion.js':filename(url);const path=resolve(assets,name);try{let data;try{if(name.endsWith('.css'))throw Error('Refresh CSS');await access(path);data=await readFile(path);}catch{data=await get(url);await writeFile(path,data);downloaded.add(name);}mapping.set(url,'/assets/'+name);if(name.endsWith('.css'))for(const u of cssUrls(data.toString(),url))if(!mapping.has(u)&&!blocked(u))pending.add(u);}catch(e){failures.push({url,error:e.message});}}));}console.log('Assets',mapping.size,'pending',pending.size);}
for(const [url,local] of mapping){if(!local.endsWith('.css'))continue;const path=resolve(out,'.'+local);let css=(await readFile(path,'utf8')).replaceAll('\\(','%28').replaceAll('\\)','%29');css=css.replace(/url\(\s*(['"]?)([^\s)'"]+)\1\s*\)/g,(all,q,s)=>{if(s.startsWith('data:')||s.startsWith('#'))return all;return mapping.has(absolute(s,url))?'url("'+mapping.get(absolute(s,url))+'")':all;});await writeFile(path,css);}
let motion=await readFile(resolve(assets,'heron-subpages-motion.js'),'utf8');
motion=motion.replaceAll('barba.use(barbaPrefetch)','void 0').replaceAll('barba.init({','barba.init({prefetchIgnore:true,prevent:()=>true,');
for(const [url,local] of mapping)motion=motion.replaceAll(url,local);
await writeFile(resolve(assets,'heron-subpages-motion.js'),motion);
const csp="default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-src 'self' blob:; worker-src 'self' blob:; form-action 'none'; base-uri 'self'";
for(const [route,source] of pages){let html=source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,block=>{if(/googletagmanager|gtag\(|clarity\.ms|application\/ld\+json/.test(block))return '';if(block.includes('heronai-bp.netlify.app/config.js'))return '<script defer src="/assets/heron-subpages-motion.js"></script>';if(/localhost:3000/.test(block))return '';return block;});
html=html.replace(/\b(src|href|poster|content)=(["'])([^"']+)\2/g,(all,key,q,value)=>{try{const local=mapping.get(absolute(value,origin+route));return local?key+'='+q+local+q:all;}catch{return all;}});
for(const [url,local] of [...mapping].sort((a,b)=>b[0].length-a[0].length)){html=html.replaceAll(url,local).replaceAll(url.replaceAll('&','&amp;'),local);const u=new URL(url);if(u.origin===origin){html=html.replaceAll('..'+u.pathname,local).replaceAll('"'+u.pathname+'"','"'+local+'"');}}
html=html.replace(/(?:\.\.\/)+\/?assets\//g,'/assets/');
html=html.replace(/<link\b[^>]*rel="(?:preconnect|dns-prefetch|canonical)"[^>]*>/gi,'');
html=html.replace('<head>','<head><meta http-equiv="Content-Security-Policy" content="'+csp+'"><meta name="robots" content="noindex,nofollow"><script src="/local-safety.js"></script>');
html=html.replace('</body>','<script src="/local-controls.js"></script></body>');
html=html.replace(/<script[^>]*src="\/assets\/heron-subpages-motion\.js"[^>]*><\/script>/g,(()=>{let seen=false;return tag=>{if(seen)return '';seen=true;return tag;};})());
const dest=resolve(out,route==='/'?'index.html':route.slice(1)+'.html');await mkdir(resolve(dest,'..'),{recursive:true});await writeFile(dest,html);}
await mkdir(resolve(root,'docs'),{recursive:true});
await writeFile(resolve(root,'docs/reference-pages.json'),JSON.stringify({source:origin,capturedAt:new Date().toISOString(),routes,assets:[...mapping].map(([url,file])=>({url,file})),failures},null,2));
console.log(JSON.stringify({pages:pages.size,assets:mapping.size,failures},null,2));
if(failures.length)process.exitCode=1;
if(!failures.length)await import('./build-ui-identities.mjs');
