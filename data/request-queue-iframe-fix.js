(function(){
  if(!(/\/Inventory\/?$/i.test(location.pathname)||/\/Inventory\/index\.html$/i.test(location.pathname)))return;

  const BACKEND='https://script.google.com/a/macros/mercersburg.edu/s/AKfycbwO-eAB-qrabGBpqbTpLWAkSUQUITiJQ3KPLIZEwjCJBN-wb8yyTgInNT-bXRbPinTA/exec';
  let frame=null;
  let timer=null;

  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const statusClass=s=>'rq-'+String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-');

  function cleanup(){
    clearTimeout(timer);
    if(frame&&frame.parentNode)frame.parentNode.removeChild(frame);
    frame=null;
  }

  function openModal(){
    const modal=document.getElementById('requestQueueModal');
    if(modal)modal.classList.add('open');
    document.body.style.overflow='hidden';
  }

  function notesHtml(text){
    const t=String(text||'');
    const needs=/Additional purchasing may be required/i.test(t);
    return '<div class="rq-notes">'+esc(t||'—')+(needs?'<div class="rq-purchase">May need purchasing</div>':'')+'</div>';
  }

  function fmtDate(ms){
    const n=Number(ms);if(!Number.isFinite(n)||n<=0)return 'Date unavailable';
    try{return new Date(n).toLocaleString([], {month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});}catch(e){return new Date(n).toString();}
  }

  function render(payload){
    cleanup();
    const body=document.getElementById('requestQueueBody');
    if(!body)return;
    if(!payload||payload.type==='request-queue-error'||!payload.ok){
      body.innerHTML='<div class="rq-error">'+esc(payload&&payload.message||'The request queue could not be loaded.')+'</div>';
      return;
    }
    const requests=Array.isArray(payload.requests)?payload.requests:[];
    const submitted=requests.filter(r=>String(r.status||'').toUpperCase()==='SUBMITTED').length;
    const count=document.getElementById('requestQueueCount');if(count)count.textContent=String(submitted);
    if(!requests.length){
      body.innerHTML='<div class="rq-summary"><span class="rq-summary-chip">0 submitted</span><span class="rq-summary-chip">0 total requests</span></div><div class="rq-empty">No requests have been submitted yet.</div>';
      return;
    }
    body.innerHTML='<div class="rq-summary"><span class="rq-summary-chip"><strong>'+submitted+'</strong> submitted</span><span class="rq-summary-chip"><strong>'+requests.length+'</strong> total requests</span></div>'+requests.map(r=>{
      const items=Array.isArray(r.items)?r.items:[];
      return '<section class="rq-card"><div class="rq-card-head"><div><div class="rq-id">'+esc(r.requestId)+'</div><div class="rq-meta">'+esc(r.requesterEmail||'Unknown requester')+(r.studentId?' · '+esc(r.studentId):'')+'<br>'+esc(r.program||'')+' · '+esc(fmtDate(r.requestedAt))+'</div></div><span class="rq-status '+statusClass(r.status)+'">'+esc(r.status||'UNKNOWN')+'</span></div><table class="rq-items"><thead><tr><th>Part</th><th>Requested</th><th>Approved</th><th>Fulfilled</th><th>Notes</th></tr></thead><tbody>'+items.map(i=>'<tr><td><div class="rq-part-name">'+esc(i.partName||i.partId)+'</div><div class="rq-part-id">'+esc(i.partId)+'</div></td><td>'+Number(i.requestedQty||0)+'</td><td>'+(i.approvedQty===''||i.approvedQty==null?'—':Number(i.approvedQty||0))+'</td><td>'+(i.fulfilledQty===''||i.fulfilledQty==null?'—':Number(i.fulfilledQty||0))+'</td><td>'+notesHtml(i.notes)+'</td></tr>').join('')+'</tbody></table></section>';
    }).join('')+'<div class="rq-staff-note">Read-only queue for this step. Approval, denial, and fulfillment controls come next.</div>';
  }

  function load(){
    cleanup();
    openModal();
    const body=document.getElementById('requestQueueBody');
    if(body)body.innerHTML='<div class="rq-loading">Loading live requests…</div>';

    const target='staffRequestQueueFrame_'+Date.now();
    frame=document.createElement('iframe');
    frame.name=target;
    frame.style.display='none';
    frame.setAttribute('aria-hidden','true');
    document.body.appendChild(frame);

    const form=document.createElement('form');
    form.method='POST';form.action=BACKEND;form.target=target;form.style.display='none';
    const input=document.createElement('input');input.type='hidden';input.name='action';input.value='requestqueue';form.appendChild(input);
    document.body.appendChild(form);form.submit();form.remove();

    timer=setTimeout(()=>{
      const current=document.getElementById('requestQueueBody');
      if(current&&/Loading live requests/.test(current.textContent||''))current.innerHTML='<div class="rq-error">The queue response did not return. Click Refresh to try again.</div>';
      cleanup();
    },15000);
  }

  function trustedOrigin(origin){
    return origin===location.origin||/^https:\/\/(?:script\.google\.com|[^/]+\.googleusercontent\.com)$/.test(origin||'');
  }

  window.addEventListener('message',e=>{
    const d=e.data||{};
    if(!trustedOrigin(e.origin))return;
    if(d.source!=='robotics-inventory-backend')return;
    if(d.type!=='request-queue'&&d.type!=='request-queue-error')return;
    render(d);
  });

  document.addEventListener('click',e=>{
    const button=e.target.closest&&e.target.closest('#requestQueueBtn,#requestQueueRefresh');
    if(!button)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    load();
  },true);
})();
