/* Shared by the HTML build and browser. IDs never depend on visible copy. */
(function(root){
 'use strict';
 const types={a:'BUTTON',button:'BUTTON',input:'INPUT',select:'INPUT',textarea:'INPUT',img:'IMAGE',image:'IMAGE',svg:'IMAGE',video:'IMAGE',h1:'TEXT',h2:'TEXT',h3:'TEXT',h4:'TEXT',h5:'TEXT',h6:'TEXT',p:'TEXT',label:'TEXT',span:'TEXT',li:'CARD',article:'CARD',form:'FORM',table:'TABLE',dialog:'DIALOG',header:'HEADER',nav:'NAV',main:'CONTENT',footer:'FOOTER',section:'SECTION',div:'GROUP',aside:'ASIDE'};
 function type(tag,attrs={}){
  const cls=attrs.class||'';
  if(/(?:^|\s)(?:header|header-wrap)(?:\s|$)/.test(cls))return 'HEADER';
  if(/(?:^|\s)(?:header-menu|tabs|nav)(?:\s|$)/.test(cls))return 'NAV';
  if(/(?:^|\s)(?:footer|footer-wrap)(?:\s|$)/.test(cls))return 'FOOTER';
  if(/(?:^|\s)[\w-]*hero(?:-wrap)?(?:\s|$)/.test(cls))return 'HERO';
  if(/(?:^|\s)(?:main|main-wrap)(?:\s|$)/.test(cls))return 'CONTENT';
  if(/(?:card|resource-hero-item-inner|project-row|about-team-item)$/.test(cls.split(/\s+/)[0]||''))return 'CARD';
  return types[tag.toLowerCase()]||null;
 }
 function hash(key){let n=14695981039346656037n;for(const c of key){n^=BigInt(c.codePointAt(0));n=BigInt.asUintN(64,n*1099511628211n);}return n.toString(36).toUpperCase();}
 function signature(tag,a){return tag+':'+(a['data-ui-key']||a.id||a['data-id']||a['data-key']||a.name||a.href||a['data-action']||(a.class||'').split(/\s+/).filter(x=>x&&!/^(active|selected|open|is-|w--)/.test(x)).slice(0,2).join('.'));}
 function elementId(page,kind,key){return page.split('_')[0]+'_'+kind+'_'+hash(key);}
 function pageFor(url,pages){const u=new URL(url,'http://local');const path=u.pathname.replace(/\.html$/,'').replace(/\/$/,'')||'/';if(!path.startsWith('/app')&&path!='/login')return pages.find(p=>p.path===path)||null;if(path==='/login'||!u.hash)return pages.find(p=>p.id==='P04_LOGIN');return pages.filter(p=>p.pattern&&new RegExp(p.pattern).test(u.hash.split('?')[0])).at(-1)||pages.find(p=>p.id==='P04_LOGIN');}
 const api={type,hash,signature,elementId,pageFor,tags:Object.keys(types)};
 if(typeof module!=='undefined')module.exports=api;
 root.UIIdentityCore=api;
})(typeof window==='undefined'?globalThis:window);
