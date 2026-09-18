/* Keep the reference motion and hash navigation; connect entry links to the app. */
'use strict';
document.addEventListener('click',function(event){
 const link=event.target.closest('a[href]');
 if(!link)return;
 const raw=link.getAttribute('href');
 if(!raw||raw.startsWith('#'))return;
 const url=new URL(raw,location.href);
 if(url.origin===location.origin&&(url.pathname==='/'||url.pathname==='/index.html')){
  if(url.hash)return;
  event.preventDefault();window.scrollTo({top:0,behavior:'smooth'});return;
 }
 event.preventDefault();event.stopImmediatePropagation();
 window.location.assign('/app/');
},true);

// Update real destinations too, including keyboard and context-menu navigation.
document.querySelectorAll('a[href]').forEach(function(link){
 const raw=link.getAttribute('href');
 if(!raw||raw.startsWith('#'))return;
 const url=new URL(raw,location.href);
 if(url.origin===location.origin&&(url.pathname==='/'||url.pathname==='/index.html'))return;
 link.setAttribute('href','/app/');
 link.removeAttribute('target');
 link.removeAttribute('download');
});
