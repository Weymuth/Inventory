(function(){
  if(!(/\/Inventory\/?$/i.test(location.pathname)||/\/Inventory\/index\.html$/i.test(location.pathname)))return;

  const REQUEST_BACKEND='https://script.google.com/a/macros/mercersburg.edu/s/AKfycbwO-eAB-qrabGBpqbTpLWAkSUQUITiJQ3KPLIZEwjCJBN-wb8yyTgInNT-bXRbPinTA/exec';
  let queuePopup=null;
  let requests=[];
  let loadTimer=null;

  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const statusClass=s=>'rq-'+String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-');

  function installStyles(){
    if(document.getElementById('request-queue-css'))return;
    const style=document.createElement('style');
    style.id='request-queue-css';
    style.textContent=`
      .rq-open{margin-left:auto;border:0;border-radius:8px;background:#0B1A2E;color:white;font-weight:850;padding:9px 13px;cursor:pointer;white-space:nowrap}.rq-open:hover{filter:brightness(1.08)}.rq-open .rq-count{display:inline-block;min-width:20px;margin-left:6px;padding:2px 6px;border-radius:999px;background:#C9A463;color:#0B1A2E;font-size:10px;font-weight:950}.rq-modal{position:fixed;inset:0;background:rgba(6,16,29,.68);display:none;align-items:center;justify-content:center;padding:24px;z-index:95}.rq-modal.open{display:flex}.rq-dialog{width:min(1100px,100%);max-height:92vh;overflow:auto;background:#f6f7f5;border-radius:14px;box-shadow:0 26px 90px rgba(0,0,0,.38)}.rq-head{position:sticky;top:0;z-index:2;background:#0B1A2E;color:white;border-bottom:4px solid #C9A463;padding:17px 20px;display:flex;align-items:center;justify-content:space-between;gap:16px}.rq-head h2{margin:3px 0 0;font-size:23px}.rq-eyebrow{font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:#d8c69f;font-weight:850}.rq-head-actions{display:flex;gap:8px}.rq-btn{border:0;border-radius:7px;padding:8px 11px;font-weight:850;cursor:pointer}.rq-btn.refresh{background:#3D5266;color:white}.rq-btn.close{background:white;color:#0B1A2E}.rq-body{padding:18px}.rq-summary{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:13px}.rq-summary-chip{background:white;border:1px solid #d9ddda;border-radius:999px;padding:7px 10px;font-size:11px;font-weight:800;color:#3D5266}.rq-empty{background:white;border:1px dashed #cfd4d1;border-radius:10px;padding:30px;text-align:center;color:#67727c}.rq-card{background:white;border:1px solid #dfe2df;border-radius:12px;margin-bottom:12px;overflow:hidden;box-shadow:0 3px 12px rgba(11,26,46,.05)}.rq-card-head{display:flex;justify-content:space-between;gap:16px;align-items:start;padding:14px 16px;border-bottom:1px solid #e5e8e6}.rq-id{font-weight:900;color:#0B1A2E;font-size:14px}.rq-meta{font-size:11px;color:#67727c;margin-top:4px;line-height:1.45}.rq-status{display:inline-block;border-radius:999px;padding:5px 8px;font-size:9px;letter-spacing:.04em;font-weight:900;background:#eef1f3;color:#3D5266}.rq-submitted{background:#fff4d7;color:#7f5412}.rq-approved{background:#edf7f1;color:#256b49}.rq-denied,.rq-cancelled{background:#fff0ee;color:#8a352f}.rq-partially-fulfilled{background:#eef3fa;color:#365b80}.rq-fulfilled{background:#e7f4eb;color:#256b49}.rq-items{width:100%;border-collapse:collapse;font-size:11px}.rq-items th{text-align:left;background:#f7f8f7;color:#67727c;text-transform:uppercase;letter-spacing:.06em;font-size:8.5px;padding:8px 10px;border-bottom:1px solid #e5e8e6}.rq-items td{padding:9px 10px;border-bottom:1px solid #edf0ee;vertical-align:top}.rq-items tr:last-child td{border-bottom:0}.rq-part-name{font-weight:850;color:#0B1A2E}.rq-part-id{font-size:9px;color:#7a858d;margin-top:2px}.rq-notes{color:#67727c;line-height:1.35;max-width:380px}.rq-loading{padding:32px;text-align:center;color:#67727c}.rq-error{background:#fff4f2;border:1px solid #e7bbb7;color:#7f2d27;border-radius:9px;padding:12px 14px;margin-bottom:12px}.rq-staff-note{font-size:10px;color:#7B6240;margin-top:8px}.rq-purchase{display:inline-block;margin-top:4px;background:#fff4d7;color:#7f5412;border:1px solid #ead39d;border-radius:999px;padding:2px 6px;font-size:8.5px;font-weight:850}@media(max-width:720px){.rq-modal{padding:10px}.rq-card-head{flex-direction:column}.rq-items{display:block;overflow-x:auto}.rq-head{align-items:flex-start}.rq-head-actions{flex-direction:column}}
    `;
    document.head.appendChild(style);
  }

  function installUi(){
    installStyles();
    if(!document.getElementById('requestQueueBtn')){
      const status=document.querySelector('.status');
      if(status){
        const btn=document.createElement('button');btn.id='requestQueueBtn';btn.className='rq-open';btn.type='button';btn.innerHTML='Request Queue <span id="requestQueueCount" class="rq-count">—</span>';btn.onclick=openQueue;status.appendChild(btn);
      }
    }
    if(!document.getElementById('requestQueueModal')){
      const modal=document.createElement('div');modal.id='requestQueueModal';modal.className='rq-modal';modal.onclick=e=>{if(e.target===modal)closeQueue();};
      modal.innerHTML='<div class="rq-dialog"><div class="rq-head"><div><div class="rq-eyebrow">Mercersburg Robotics</div><h2>Staff Request Queue</h2></div><div class="rq-head-actions"><button class="rq-btn refresh" type="button" id="requestQueueRefresh">Refresh</button><button class="rq-btn close" type="button" id="requestQueueClose">Close</button></div></div><div id="requestQueueBody" class="rq-body"><div class="rq-loading">Open the queue to load current requests.</div></div></div>';
      document.body.appendChild(modal);
      document.getElementById('requestQueueRefresh').onclick=loadQueue;
      document.getElementById('requestQueueClose').onclick=closeQueue;
    }
  }

  function openQueue(){
    installUi();document.getElementById('requestQueueModal').classList.add('open');document.body.style.overflow='hidden';loadQueue();
  }
  function closeQueue(){const m=document.getElementById('requestQueueModal');if(m)m.classList.remove('open');document.body.style.overflow='';}

  function loadQueue(){
    clearTimeout(loadTimer);
    const body=document.getElementById('requestQueueBody');if(body)body.innerHTML='<div class="rq-loading">Loading live requests…</div>';
    const target='staffRequestQueue_'+Date.now();
    queuePopup=window.open('',target,'popup,width=500,height=360,resizable=yes,scrollbars=yes');
    if(!queuePopup){if(body)body.innerHTML='<div class="rq-error">Popup blocked. Allow popups for this site, then click Refresh.</div>';return;}
    const form=document.createElement('form');form.method='POST';form.action=REQUEST_BACKEND;form.target=target;form.style.display='none';
    const input=document.createElement('input');input.type='hidden';input.name='action';input.value='requestqueue';form.appendChild(input);document.body.appendChild(form);form.submit();form.remove();
    loadTimer=setTimeout(()=>{
      const current=document.getElementById('requestQueueBody');
      if(current&&/Loading live requests/.test(current.textContent||''))current.innerHTML='<div class="rq-error">The queue response did not return. Close any request popup, then click Refresh.</div>';
    },12000);
  }

  function fmtDate(ms){
    const n=Number(ms);if(!Number.isFinite(n)||n<=0)return 'Date unavailable';
    try{return new Date(n).toLocaleString([], {month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});}catch(e){return new Date(n).toString();}
  }

  function notesHtml(text){
    const t=String(text||'');
    const needs=/Additional purchasing may be required/i.test(t);
    return '<div class="rq-notes">'+esc(t||'—')+(needs?'<div class="rq-purchase">May need purchasing</div>':'')+'</div>';
  }

  function renderQueue(){
    const body=document.getElementById('requestQueueBody');if(!body)return;
    const submitted=requests.filter(r=>String(r.status||'').toUpperCase()==='SUBMITTED').length;
    const count=document.getElementById('requestQueueCount');if(count)count.textContent=String(submitted);
    if(!requests.length){body.innerHTML='<div class="rq-summary"><span class="rq-summary-chip">0 submitted</span><span class="rq-summary-chip">0 total requests</span></div><div class="rq-empty">No requests have been submitted yet.</div>';return;}
    body.innerHTML='<div class="rq-summary"><span class="rq-summary-chip"><strong>'+submitted+'</strong> submitted</span><span class="rq-summary-chip"><strong>'+requests.length+'</strong> total requests</span></div>'+requests.map(r=>{
      const items=Array.isArray(r.items)?r.items:[];
      return '<section class="rq-card"><div class="rq-card-head"><div><div class="rq-id">'+esc(r.requestId)+'</div><div class="rq-meta">'+esc(r.requesterEmail||'Unknown requester')+(r.studentId?' · '+esc(r.studentId):'')+'<br>'+esc(r.program||'')+' · '+esc(fmtDate(r.requestedAt))+'</div></div><span class="rq-status '+statusClass(r.status)+'">'+esc(r.status||'UNKNOWN')+'</span></div><table class="rq-items"><thead><tr><th>Part</th><th>Requested</th><th>Approved</th><th>Fulfilled</th><th>Notes</th></tr></thead><tbody>'+items.map(i=>'<tr><td><div class="rq-part-name">'+esc(i.partName||i.partId)+'</div><div class="rq-part-id">'+esc(i.partId)+'</div></td><td>'+Number(i.requestedQty||0)+'</td><td>'+(i.approvedQty===''||i.approvedQty==null?'—':Number(i.approvedQty||0))+'</td><td>'+(i.fulfilledQty===''||i.fulfilledQty==null?'—':Number(i.fulfilledQty||0))+'</td><td>'+notesHtml(i.notes)+'</td></tr>').join('')+'</tbody></table></section>';
    }).join('')+'<div class="rq-staff-note">Read-only queue for this step. Approval, denial, and fulfillment controls come next.</div>';
  }

  function handlePayload(d){
    if(!d||d.source!=='robotics-inventory-backend')return;
    if(d.type!=='request-queue'&&d.type!=='request-queue-error')return;
    clearTimeout(loadTimer);
    try{if(queuePopup&&!queuePopup.closed)queuePopup.close();}catch(e){}
    queuePopup=null;
    if(d.type==='request-queue'&&d.ok){requests=Array.isArray(d.requests)?d.requests:[];renderQueue();}
    else{
      const body=document.getElementById('requestQueueBody');if(body)body.innerHTML='<div class="rq-error">'+esc(d.message||'The request queue could not be loaded.')+'</div>';
    }
  }

  window.addEventListener('message',e=>{if(e.origin===location.origin)handlePayload(e.data||null);});
  window.addEventListener('storage',e=>{if(e.key!=='roboticsInventoryQueueBridgeEvent'||!e.newValue)return;try{handlePayload(JSON.parse(e.newValue).payload||null);}catch(err){}});
  try{const channel=new BroadcastChannel('robotics-inventory');channel.onmessage=e=>handlePayload(e.data||null);}catch(e){}
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeQueue();});
  window.addEventListener('load',installUi);
})();
