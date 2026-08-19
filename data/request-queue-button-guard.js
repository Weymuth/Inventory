(function(){
  if(!(/\/Inventory\/?$/i.test(location.pathname)||/\/Inventory\/index\.html$/i.test(location.pathname)))return;

  function ensureButton(){
    const status=document.querySelector('.status');
    if(!status||document.getElementById('requestQueueBtn'))return;
    const btn=document.createElement('button');
    btn.id='requestQueueBtn';
    btn.className='rq-open';
    btn.type='button';
    btn.innerHTML='Request Queue <span id="requestQueueCount" class="rq-count">—</span>';
    btn.style.marginLeft='auto';
    btn.style.border='0';
    btn.style.borderRadius='8px';
    btn.style.background='#0B1A2E';
    btn.style.color='white';
    btn.style.fontWeight='850';
    btn.style.padding='9px 13px';
    btn.style.cursor='pointer';
    btn.style.whiteSpace='nowrap';
    status.appendChild(btn);
  }

  ensureButton();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureButton,{once:true});
  window.addEventListener('load',ensureButton);

  const observer=new MutationObserver(function(){ensureButton();});
  observer.observe(document.documentElement,{childList:true,subtree:true});
})();
