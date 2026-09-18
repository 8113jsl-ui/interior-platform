/* Preview forms never transmit data to the reference company. */
'use strict';
window['ga-disable-G-N1KKXK6ZR5']=true;
window.dataLayer=[];window.gtag=function(){};window.clarity=function(){};
function previewSubmit(event,form){
 event.preventDefault();event.stopImmediatePropagation();
 if(!form.reportValidity())return;
 let message=form.querySelector('[data-local-feedback]');
 if(!message){message=document.createElement('p');message.dataset.localFeedback='';message.setAttribute('role','status');form.append(message);}
 message.textContent='Preview only — your information has not been sent. 미리보기: 입력 정보는 전송되지 않았습니다.';
}
document.addEventListener('submit',event=>{if(event.target.matches('form'))previewSubmit(event,event.target);},true);
document.addEventListener('click',event=>{const button=event.target.closest('button[type="submit"],input[type="submit"]');if(button?.form)previewSubmit(event,button.form);},true);
