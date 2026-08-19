(function(){
  function ensureRequestQueueButton(){
    var status=document.querySelector('.status');
    if(!status||document.getElementById('requestQueueBtn'))return;
    var btn=document.createElement('button');
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
  ensureRequestQueueButton();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureRequestQueueButton,{once:true});
  window.addEventListener('load',ensureRequestQueueButton);
})();

document.write('<script src="data/inventory-data-6-core.js?v=20260818-2310"><\/script><script src="data/inventory-data-7.js?v=20260819-0842"><\/script><script src="data/inventory-data-8.js?v=20260819-0900"><\/script><script src="data/inventory-data-9.js?v=20260819-0915"><\/script><script src="data/inventory-data-10.js?v=20260819-0930"><\/script><script src="data/delete-card-simple.js?v=20260818-2313"><\/script><script src="data/low-stock-warning.js?v=20260819-1223"><\/script><script src="data/request-queue.js?v=20260819-1510"><\/script><script src="data/request-queue-iframe-fix.js?v=20260819-1510"><\/script><script src="data/request-decisions.js?v=20260819-1510"><\/script>');
