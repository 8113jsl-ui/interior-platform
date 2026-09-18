import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import '../public/ui/identity-core.js';
const core=globalThis.UIIdentityCore,root=resolve(import.meta.dirname,'..'),pub=resolve(root,'public');
const manifest=JSON.parse(await readFile(resolve(root,'docs/reference-pages.json')));
const registryPath=resolve(pub,'ui/page-registry.json');
let pages;try{pages=JSON.parse(await readFile(registryPath));}catch{pages=[{id:'P01_HOME',path:'/',name:'메인'},{id:'P02_LIST',path:'/resources',name:'자료실 목록'},{id:'P03_DETAIL',path:manifest.routes.find(x=>x.startsWith('/insights/')),name:'자료실 상세'},{id:'P04_LOGIN',path:'/login',name:'로그인'},{id:'P05_MYPAGE',pattern:'^#/(pm|customer|field)/preferences$',name:'마이페이지'}];}
let next=Math.max(...pages.map(p=>Number(p.id.match(/^P(\d+)/)[1])))+1;
for(const path of manifest.routes)if(!pages.some(p=>p.path===path))pages.push({id:'P'+String(next++).padStart(2,'0')+'_'+(path.includes('/',1)?'DETAIL':path.slice(1).replaceAll('-','_').toUpperCase()),path,name:path});
const source=await readFile(resolve(pub,'app/screen-registry.js'),'utf8');
const screens=JSON.parse(source.match(/const screens=(\[[\s\S]*?\]);/)[1]);
for(const screen of screens){if(!screen.route||screen.route.endsWith('/preferences'))continue;const pattern='^'+screen.route.replace(/\{[^}]+\}/g,'[^/]+')+'$';if(pages.some(p=>p.pattern===pattern))continue;pages.push({id:'P'+String(next++).padStart(2,'0')+'_'+screen.SCREEN_ID.replaceAll('-','_'),pattern,name:screen.SCREEN_ID,legacyScreenId:screen.SCREEN_ID});}
for(const [id,pattern] of [['INVITE','^#/?invite(?:[/?=].*)?$'],['RESET','^#/?reset(?:[/?=].*)?$']])if(!pages.some(p=>p.name===id))pages.push({id:'P'+String(next++).padStart(2,'0')+'_'+id,pattern,name:id});
if(new Set(pages.map(p=>p.id)).size!==pages.length)throw Error('Duplicate page IDs');
await mkdir(resolve(pub,'ui'),{recursive:true});await writeFile(registryPath,JSON.stringify(pages,null,2)+'\n');
const inventory=[];
for(const page of pages.filter(p=>p.path&&p.path!=='/login')){
 const path=resolve(pub,page.path==='/'?'index.html':page.path.slice(1)+'.html');let html=await readFile(path,'utf8');
 html=html.replace(/\sdata-(?:page-id|target-page|ui-generated-action)=(['"])[\s\S]*?\1/g,'');
 const stack=[{key:page.id,children:new Map()}],seen=new Set();
 html=html.replace(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<\/?[a-zA-Z][^>]*>/g,tag=>{
  if(tag.startsWith('<!--')||/^<(script|style)\b/i.test(tag))return tag;
  const match=tag.match(/^<(\/?)([\w-]+)/);if(!match)return tag;const closing=match[1],name=match[2].toLowerCase();
  if(closing){const index=stack.findLastIndex(x=>x.tag===name);if(index>0)stack.splice(index);return tag;}
  const a={};for(const m of tag.matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g))a[m[1]]=m[3];
  const parent=stack.at(-1),signature=core.signature(name,a),ordinal=(parent.children.get(signature)||0)+1;parent.children.set(signature,ordinal);
  const key=parent.key+'/'+signature+(ordinal>1?'~'+ordinal:'');
  if(!/^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(name)&&!tag.endsWith('/>'))stack.push({tag:name,key,children:new Map()});
  let attrs='';if(name==='body')attrs+=' data-page-id="'+page.id+'"';
  const kind=core.type(name,a);if(kind){const id=a['data-element-id']||core.elementId(page.id,kind,a['data-ui-key']?page.id+'/key/'+a['data-ui-key']:key);if(seen.has(id)||!id.startsWith(page.id.split('_')[0]+'_'))throw Error('Duplicate or invalid element '+id);seen.add(id);tag=tag.replace(/\sdata-element-id=(['"])[\s\S]*?\1/g,'');attrs+=' data-page-id="'+page.id+'" data-element-id="'+id+'"';inventory.push({page:page.id,id,type:kind,key});}
  if(name==='a'&&a.href&&!a.href.startsWith('#')){const url=new URL(a.href,'http://local'+page.path);const target=url.origin==='http://local'?core.pageFor(url.href,pages):null;if(target){attrs+=' data-target-page="'+target.id+'"';if(!a['data-action'])attrs+=' data-action="navigate" data-ui-generated-action="true"';}}
  return tag.replace(/\/?>(?=$)/,end=>attrs+end);
 });
 if(!html.includes('/ui/element-identities.js'))html=html.replace('</head>','<script defer src="/ui/identity-core.js"></script><script defer src="/ui/element-identities.js"></script>\n</head>');
 await writeFile(path,html);
}
const appPath=resolve(pub,'app/index.html');let app=await readFile(appPath,'utf8');if(!app.includes('/ui/element-identities.js'))app=app.replace('</head>','<script defer src="/ui/identity-core.js"></script><script defer src="/ui/element-identities.js"></script>\n</head>');await writeFile(appPath,app);
await writeFile(resolve(root,'docs/ui-element-registry.json'),JSON.stringify(inventory,null,2)+'\n');
console.log(JSON.stringify({pages:pages.length,staticElements:inventory.length}));
