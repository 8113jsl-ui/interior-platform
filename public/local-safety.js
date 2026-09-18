/* Reference landing forms never transmit input; their CTA opens our app. */
'use strict';
window['ga-disable-G-N1KKXK6ZR5']=true;
window.dataLayer=[];
window.gtag=function(){};
window.clarity=function(){};
document.addEventListener('submit',function(event){
 event.preventDefault();event.stopImmediatePropagation();
 window.location.assign('/app/');
},true);

// Capture before source form handlers, and bypass their validation/submission.
document.addEventListener('click',function(event){
 const submit=event.target.closest('button[type="submit"],input[type="submit"]');
 if(!submit||!submit.closest('form'))return;
 event.preventDefault();event.stopImmediatePropagation();
 window.location.assign('/app/');
},true);
