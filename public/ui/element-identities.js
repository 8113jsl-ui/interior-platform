/* Identity metadata is always active; the non-interactive overlay is dev-only. */
(async function(){
 'use strict';
 const core=window.UIIdentityCore;
 const pages=await fetch('/ui/page-registry.json').then(r=>r.json());
 const config=await fetch('/api/ui-config').then(r=>r.ok?r.json():{}).catch(()=>({}));
 const isApp=location.pathname.startsWith('/app');
 let currentPage,observer,scheduled=false,host,shadow,hovered=null,enabled=false,lastPaint=0,raf=0;
 const koreanTypes={BUTTON:'버튼',CARD:'카드',IMAGE:'이미지',TEXT:'텍스트',INPUT:'입력창',HEADER:'헤더',NAV:'내비게이션',HERO:'메인 배너',CONTENT:'본문',FOOTER:'푸터',FORM:'입력 폼',TABLE:'표',DIALOG:'대화상자',SECTION:'영역',GROUP:'컨테이너',ASIDE:'보조 영역'};
 const koreanPages={'/':'메인','/resources':'자료실 목록','/about-us':'회사 소개','/pricing':'요금 안내','/contact-us':'문의','/heron-chat-widget':'채팅 위젯','/heron-dashboard':'대시보드','/privacy-policy':'개인정보 처리방침','/terms-and-conditions':'이용 약관','/cookie-policy':'쿠키 정책','/login':'로그인'};
 const labelText=id=>{const [page,kind,...key]=id.split('_');return page+' · '+(koreanTypes[kind]||kind)+' · '+key.join('_');};
 const pageText=page=>koreanPages[page.path]||(page.id==='P05_MYPAGE'?'마이페이지':page.id.endsWith('_DETAIL')?'자료실 상세':page.id.endsWith('_INVITE')?'초대':page.id.endsWith('_RESET')?'비밀번호 재설정':page.name+' 화면');
 const measure=document.createElement('canvas').getContext('2d');
 measure.font='600 16px "Malgun Gothic", sans-serif';
 function getPage(){
  if(isApp&&document.querySelector('#auth-form,#login-form,.auth-form'))return pages.find(p=>p.id==='P04_LOGIN');
  const legacy=isApp&&document.querySelector('[data-screen-id]')?.getAttribute('data-screen-id');
  return pages.find(p=>legacy&&p.legacyScreenId===legacy)||core.pageFor(location.href,pages)||pages.find(p=>p.id==='P04_LOGIN');
 }
 function scan(){
  scheduled=false;observer?.disconnect();currentPage=getPage();const page=currentPage.id;
  document.body.dataset.pageId=page;
  const used=new Set(),keys=new WeakMap(),siblingCounts=new WeakMap();keys.set(document.body,page);
  for(const el of document.body.querySelectorAll('*')){
   if(el===host||el.closest('[data-ui-overlay]')||/^(SCRIPT|STYLE|PATH|DEFS|MASK|CLIPPATH|NOSCRIPT|BR)$/.test(el.tagName))continue;
   const a=Object.fromEntries([...el.attributes].map(x=>[x.name,x.value]));
   const parent=el.parentElement;let counts=siblingCounts.get(parent);if(!counts)siblingCounts.set(parent,counts=new Map());
   const signature=core.signature(el.localName,a),n=(counts.get(signature)||0)+1;counts.set(signature,n);
   const key=(keys.get(parent)||page)+'/'+signature+(n>1?'~'+n:'');keys.set(el,key);
   const kind=core.type(el.localName,a);if(!kind)continue;
   // SplitText's generated lines/words are presentation fragments of an existing ID.
   if(!isApp&&!el.dataset.elementId&&el.closest('[aria-hidden="true"]'))continue;
   let id=el.dataset.elementId;
   if(!id||!id.startsWith(page.split('_')[0]+'_')||used.has(id))id=core.elementId(page,kind,a['data-ui-key']?page+'/key/'+a['data-ui-key']:key);
   if(used.has(id))throw Error('Duplicate UI identity: '+id);
   used.add(id);el.dataset.pageId=page;el.dataset.elementId=id;
   if(el.matches('a[href]')){
    const u=new URL(el.getAttribute('href'),location.href);
    const hashNavigation=u.hash&&u.hash.startsWith('#/');
    const target=u.origin===location.origin&&(u.pathname!==location.pathname||hashNavigation)?core.pageFor(u.href,pages):null;
    if(target){el.dataset.targetPage=target.id;if(!el.dataset.action||el.dataset.uiGeneratedAction){el.dataset.action='navigate';el.dataset.uiGeneratedAction='true';}else el.dataset.uiAction='navigate';}
    else{delete el.dataset.targetPage;if(el.dataset.uiGeneratedAction){delete el.dataset.action;delete el.dataset.uiGeneratedAction;}}
   }
  }
  observer?.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['href','data-screen-id']});
 }
 function queue(){if(!scheduled){scheduled=true;setTimeout(scan,50);}}
 observer=new MutationObserver(records=>{if(records.some(r=>r.type==='attributes'||[...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1)))queue();});scan();window.addEventListener('hashchange',queue);window.addEventListener('popstate',queue);
 function paint(now){
  if(!enabled)return;raf=requestAnimationFrame(paint);if(now-lastPaint<120)return;lastPaint=now;
  shadow.querySelector('.labels').replaceChildren();
  const occupied=[],layer=shadow.querySelector('.labels');
  const visible=e=>e.checkVisibility?e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}):getComputedStyle(e).visibility!=='hidden';
  const protectedRects=[...document.querySelectorAll('h1,h2,h3,p,label,input,button,img,a,span')].filter(e=>visible(e)&&(!e.children.length||/^(H[1-6]|P|INPUT|IMG|BUTTON|A)$/.test(e.tagName))).map(e=>e.getBoundingClientRect()).filter(r=>r.width>0&&r.height>0&&r.top<innerHeight&&r.bottom>0);
  const add=(text,x,y,highlight=false)=>{
   text=labelText(text);const width=Math.min(innerWidth-8,Math.ceil(measure.measureText(text).width)+18),height=28;x=Math.max(4,Math.min(x,innerWidth-width-4));y=Math.max(4,Math.min(y,innerHeight-64));
   const blocked=()=>occupied.some(r=>x<r.x+r.w&&x+width>r.x&&y<r.y+28&&y+height>r.y)||protectedRects.some(r=>x<r.right&&x+width>r.left&&y<r.bottom&&y+height>r.top);
   for(let i=0;i<3&&blocked();i++)y-=29;
   if(y<4||blocked()||(!highlight&&occupied.length>=35))return;
   occupied.push({x,y,w:width});const label=document.createElement('span');label.className='tag'+(highlight?' selected':'');label.textContent=text;label.style.cssText=`left:${x}px;top:${y}px;max-width:${width}px`;layer.append(label);
  };
  const elements=[...document.querySelectorAll('[data-element-id]')];
  elements.sort((a,b)=>Number(!/_(BUTTON|INPUT|CARD|HERO|HEADER|NAV|FOOTER)_/.test(a.dataset.elementId))-Number(!/_(BUTTON|INPUT|CARD|HERO|HEADER|NAV|FOOTER)_/.test(b.dataset.elementId)));
  for(const el of elements){if(/_GROUP_/.test(el.dataset.elementId)||!visible(el))continue;const rect=el.getBoundingClientRect();if(rect.width<3||rect.height<3||rect.bottom<0||rect.top>innerHeight||rect.right<0||rect.left>innerWidth||el.closest('[hidden],[aria-hidden="true"]'))continue;add(el.dataset.elementId,rect.left,rect.top-29);}
  const outline=shadow.querySelector('.outline');outline.hidden=true;
  if(hovered?.isConnected){const r=hovered.getBoundingClientRect();outline.hidden=false;outline.style.cssText=`left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;add(hovered.dataset.elementId,r.left,r.top-29,true);}
  shadow.querySelector('.status').textContent=`${pageText(currentPage)} [${currentPage.id}] · ${hovered?.dataset.elementId?labelText(hovered.dataset.elementId):'요소 '+elements.length+'개'} · 숨기기 Alt+Shift+I`;
 }
 function setEnabled(value){
  enabled=config.allowElementIds===true&&Boolean(value);
  try{sessionStorage.setItem('show-element-ids',String(enabled));}catch{}
  cancelAnimationFrame(raf);
  if(!enabled){host?.remove();host=null;return false;}
  if(!host){host=document.createElement('div');host.dataset.uiOverlay='true';host.setAttribute('aria-hidden','true');host.style.cssText='position:fixed;inset:0;z-index:2147483647;pointer-events:none;contain:strict;';shadow=host.attachShadow({mode:'closed'});shadow.innerHTML='<style>:host{pointer-events:none!important}.tag{position:fixed;white-space:nowrap;font:600 16px/24px "Malgun Gothic",sans-serif;background:#172d4be8;color:white;border:1px solid #acc3e5;border-radius:2px;padding:1px 8px;box-sizing:border-box;overflow:hidden;text-overflow:ellipsis;pointer-events:none}.selected{background:#b52400;z-index:2}.outline{position:fixed;box-sizing:border-box;border:2px solid #ed431c;pointer-events:none}.status{position:fixed;bottom:3px;left:4px;background:#172d4be8;color:white;font:600 15px/24px "Malgun Gothic",sans-serif;padding:4px 10px;max-width:calc(100vw - 8px);box-sizing:border-box;pointer-events:none}</style><div class="labels"></div><div class="outline" hidden></div><div class="status"></div>';document.body.append(host);}
  raf=requestAnimationFrame(paint);return true;
 }
 document.addEventListener('pointermove',event=>{if(enabled)hovered=event.target.closest?.('[data-element-id]')||null;},{passive:true});
 document.addEventListener('keydown',event=>{if(config.allowElementIds&&event.altKey&&event.shiftKey&&event.code==='KeyI'){event.preventDefault();setEnabled(!enabled);}});
 window.UIIds=Object.freeze({pages,setEnabled,refresh:scan,get enabled(){return enabled;},get page(){return currentPage.id;},find:id=>document.querySelector('[data-element-id="'+CSS.escape(id)+'"]'),inspect:()=>[...document.querySelectorAll('[data-element-id]')].map(e=>({page:e.dataset.pageId,id:e.dataset.elementId,target:e.dataset.targetPage||null,tag:e.localName}))});
 let remembered=false;try{remembered=sessionStorage.getItem('show-element-ids')==='true';}catch{}
 const requested=new URLSearchParams(location.search).get('elementIds');setEnabled(requested===null?(config.showElementIds||remembered):requested==='1');
})();
