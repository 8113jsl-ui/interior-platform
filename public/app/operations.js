/* Reversible archival stays inside project settings, not a new D1 module. */
(()=>{
 function attach(){if(!session?.user||session.user.role!=='pm'||route?.tab!=='settings'||!route.project)return;
  const target=document.querySelector('.workspace');if(!target||document.querySelector('#archive-open'))return;
  const section=document.createElement('section');section.className='panel backup-panel';section.innerHTML=`<div class="panel-head"><h2>${lang==='ko'?'보관된 자료':'Archived records'}</h2><button class="button" id="archive-open">${lang==='ko'?'조회 및 복원':'View and restore'}</button></div><div class="panel-body small muted">${lang==='ko'?'보관 처리는 파일을 삭제하지 않습니다. 자료를 복원하면 원래 탭에서 다시 확인할 수 있습니다.':'Archiving preserves files. Restored records return to their original tabs.'}</div>`;target.append(section);
  section.querySelector('button').onclick=async()=>{try{const result=await api('archives?project='+encodeURIComponent(route.project));openDialog(lang==='ko'?'보관된 자료':'Archived records',`<div class="full">${result.items.length?result.items.map(i=>`<div class="timeline-row"><span>${esc(i.title)} · ${esc(t(i.type))}</span><button type="button" class="button" data-restore-item="${esc(i.id)}">${lang==='ko'?'복원':'Restore'}</button></div>`).join(''):`<p>${esc(t('empty'))}</p>`}</div>`);document.querySelectorAll('[data-restore-item]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const item=result.items.find(i=>i.id===b.dataset.restoreItem);db=normalizeState(await api('restore','POST',{id:item.id,version:item.version}));$('#dialog').close();render();toast(t('saved'));}catch(e){$('#form-error').textContent=e.message;b.disabled=false;}});}catch(e){toast(e.message);}};
 }
 addEventListener('workspace-render',attach);
})();
