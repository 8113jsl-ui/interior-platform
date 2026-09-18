/* Keep all cloned page navigation local. */
'use strict';
document.addEventListener('click',event=>{
 const link=event.target.closest('a[href]');
 if(!link)return;
 const raw=link.getAttribute('href');
 if(!raw||raw.startsWith('#'))return;
 const url=new URL(raw,location.href);
 if(url.origin==='https://heronaiapp.com'){url.host=location.host;url.protocol=location.protocol;}
 if(url.origin!==location.origin)return;
 if(url.pathname===location.pathname&&url.hash)return;
 event.preventDefault();event.stopImmediatePropagation();
 window.location.assign(url.pathname+url.search+url.hash);
},true);
