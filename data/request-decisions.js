(function(){
  if(!(/\/Inventory\/?$/i.test(location.pathname)||/\/Inventory\/index\.html$/i.test(location.pathname)))return;

  const BACKEND='https://script.google.com/a/macros/mercersburg.edu/s/AKfycbwO-eAB-qrabGBpqbTpLWAkSUQUITiJQ3KPLIZEwjCJBN-wb8yyTgInNT-bXRbPinTA/exec';
  let latestRequests=[];
  let batch=null;

  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function installStyles(){
    if(document.getElementById('request-decision-css'))return;
    const s=document.createElement('style');
    s.id='request-decision-css';
    s.textContent=`
      .rq-batchbar{position:sticky;top:72px;z-index:3;display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:#fff;border:1px solid #d9ddda;border-radius:10px;padding:10px 12px;margin-bottom:12px;box-shadow:0 3px 12px rgba(11,26,46,.06)}
      .rq-batchbar .rq-batch-count{font-size:11px;font-weight:850;color:#3D5266;margin-right:auto}.rq-batchbar button{border:0;border-radius:7px;padding:8px 11px;font-weight:850;cursor:pointer}.rq-batchbar button:disabled{opacity:.45;cursor:not-allowed}.rq-select-all{background:#eef1f3;color:#0B1A2E}.rq-approve-selected{background:#256b49;color:#fff}.rq-deny-selected{background:#8a352f;color:#fff}
      .rq-card-select{display:flex;align-items:flex-start;gap:10px}.rq-request-check{width:18px;height:18px;margin-top:1px;accent-color:#0B1A2E}.rq-card.rq-selected{outline:2px solid #C9A463;outline-offset:1px}.rq-approve-input{width:72px;border:1px solid #cbd1d5;border-radius:6px;padding:6px 7px;font:inherit}.rq-approve-input:disabled{background:#f2f3f2;color:#89929a}.rq-batch-note{font-size:10px;color:#67727c;padding:0 14px 10px}.rq-saving{background:#eef3fa;border:1px solid #b9cbe0;color:#365b80;border-radius:9px;padding:10px 12px;margin-bottom:12px;font-size:11px;font-weight:800}.rq-result{border-radius:9px;padding:10px 12px;margin-bottom:12px;font-size:11px;font-weight:800}.rq-result.ok{background:#edf7f1;border:1px solid #b8d9c5;color:#256b49}.rq-result.error{background:#fff4f2;border:1px solid #e7bbb7;color:#7f2d27}
      @media(max-width:720px){.rq-batchbar{top:105px}.rq-batchbar .rq-batch-count{width:100%;margin-right:0}}
    `;
    document.head.appendChild(s);
  }

  function requestById(id){return latestRequests.find(r=>String(r.requestId||'')===id)||null;}
  function submittedRequests(){return latestRequests.filter(r=>String(r.status||'').toUpperCase()==='SUBMITTED');}

  function ensureBatchBar(){
    const body=document.getElementById('requestQueueBody');
    if(!body||document.getElementById('rqBatchBar'))return;
    const submitted=submittedRequests();
    if(!submitted.length)return;
    const bar=document.createElement('div');
    bar.id='rqBatchBar';bar.className='rq-batchbar';
    bar.innerHTML='<span id="rqBatchCount" class="rq-batch-count">0 selected</span><button id="rqSelectAll" class="rq-select-all" type="button">Select All</button><button id="rqDenySelected" class="rq-deny-selected" type="button" disabled>Deny Selected</button><button id="rqApproveSelected" class="rq-approve-selected" type="button" disabled>Approve Selected</button>';
    const firstCard=body.querySelector('.rq-card');
    if(firstCard)body.insertBefore(bar,firstCard);else body.appendChild(bar);
    document.getElementById('rqSelectAll').onclick=toggleSelectAll;
    document.getElementById('rqApproveSelected').onclick=()=>startBatch('APPROVE');
    document.getElementById('rqDenySelected').onclick=()=>startBatch('DENY');
    updateBatchControls();
  }

  function augment(){
    installStyles();
    document.querySelectorAll('.rq-card').forEach(card=>{
      const idNode=card.querySelector('.rq-id');
      const requestId=idNode?String(idNode.textContent||'').trim():'';
      const request=requestById(requestId);
      if(!request||String(request.status||'').toUpperCase()!=='SUBMITTED')return;
      if(card.dataset.batchReady==='1')return;

      const head=card.querySelector('.rq-card-head > div:first-child');
      if(head){
        const wrap=document.createElement('div');wrap.className='rq-card-select';
        const check=document.createElement('input');check.type='checkbox';check.className='rq-request-check';check.dataset.requestId=requestId;check.setAttribute('aria-label','Select '+requestId);
        head.parentNode.insertBefore(wrap,head);wrap.appendChild(check);wrap.appendChild(head);
        check.onchange=()=>{card.classList.toggle('rq-selected',check.checked);updateBatchControls();};
      }

      const rows=card.querySelectorAll('.rq-items tbody tr');
      rows.forEach((tr,index)=>{
        const item=(request.items||[])[index];
        const cells=tr.querySelectorAll('td');
        if(!item||cells.length<3)return;
        const requested=Math.max(1,Number(item.requestedQty||1));
        cells[2].innerHTML='<input class="rq-approve-input" type="number" min="1" max="'+requested+'" step="1" value="'+requested+'" data-part-id="'+esc(item.partId)+'" data-requested="'+requested+'" aria-label="Approved quantity for '+esc(item.partName||item.partId)+'">';
      });

      const note=document.createElement('div');note.className='rq-batch-note';note.textContent='Select this request above. Adjust approved quantities only if needed.';card.appendChild(note);
      card.dataset.batchReady='1';
    });
    ensureBatchBar();
    updateBatchControls();
  }

  function selectedCards(){return [...document.querySelectorAll('.rq-request-check:checked')].map(c=>c.closest('.rq-card')).filter(Boolean);}
  function updateBatchControls(){
    const selected=selectedCards().length;
    const total=document.querySelectorAll('.rq-request-check').length;
    const count=document.getElementById('rqBatchCount');if(count)count.textContent=selected+' selected';
    const approve=document.getElementById('rqApproveSelected');if(approve)approve.disabled=!selected||!!batch;
    const deny=document.getElementById('rqDenySelected');if(deny)deny.disabled=!selected||!!batch;
    const all=document.getElementById('rqSelectAll');if(all){all.disabled=!!batch;all.textContent=total&&selected===total?'Clear All':'Select All';}
  }

  function toggleSelectAll(){
    const boxes=[...document.querySelectorAll('.rq-request-check')];
    const allSelected=boxes.length&&boxes.every(b=>b.checked);
    boxes.forEach(b=>{b.checked=!allSelected;const card=b.closest('.rq-card');if(card)card.classList.toggle('rq-selected',b.checked);});
    updateBatchControls();
  }

  function buildOperations(decision){
    const ops=[];
    for(const card of selectedCards()){
      const idNode=card.querySelector('.rq-id');
      const requestId=idNode?String(idNode.textContent||'').trim():'';
      const request=requestById(requestId);if(!request)continue;
      const approvals=[];
      if(decision==='APPROVE'){
        const inputs=[...card.querySelectorAll('.rq-approve-input')];
        for(const input of inputs){
          const requested=Number(input.dataset.requested||0),qty=Number(input.value);
          if(!Number.isInteger(qty)||qty<1||qty>requested){
            alert('Approved quantity must be a whole number from 1 to '+requested+'.');input.focus();return null;
          }
          approvals.push({partId:input.dataset.partId,quantity:qty});
        }
        if(approvals.length!==(request.items||[]).length){alert('Could not read all approval quantities for '+requestId+'. Refresh the queue and try again.');return null;}
      }
      ops.push({requestId,decision,approvals});
    }
    return ops;
  }

  function showSaving(text){
    const body=document.getElementById('requestQueueBody');if(!body)return;
    let n=document.getElementById('rqBatchSaving');
    if(!n){n=document.createElement('div');n.id='rqBatchSaving';n.className='rq-saving';body.insertBefore(n,body.firstChild);}
    n.textContent=text;
  }
  function clearSaving(){const n=document.getElementById('rqBatchSaving');if(n)n.remove();}
  function showResult(text,error){
    const body=document.getElementById('requestQueueBody');if(!body)return;
    const n=document.createElement('div');n.className='rq-result '+(error?'error':'ok');n.textContent=text;body.insertBefore(n,body.firstChild);
  }

  function startBatch(decision){
    if(batch)return;
    const ops=buildOperations(decision);if(!ops||!ops.length)return;
    if(decision==='DENY'&&!confirm('Deny all '+ops.length+' selected request'+(ops.length===1?'':'s')+'?'))return;
    batch={ops,index:0,success:0,decision,currentFrame:null};
    document.querySelectorAll('.rq-request-check,.rq-approve-input').forEach(el=>el.disabled=true);
    updateBatchControls();
    sendNext();
  }

  function sendNext(){
    if(!batch)return;
    if(batch.index>=batch.ops.length){
      const count=batch.success,decision=batch.decision;
      batch=null;clearSaving();
      showResult(count+' request'+(count===1?'':'s')+' '+(decision==='APPROVE'?'approved':'denied')+'.',false);
      setTimeout(()=>{const refresh=document.getElementById('requestQueueRefresh');if(refresh)refresh.click();},500);
      return;
    }
    const op=batch.ops[batch.index];
    showSaving((batch.decision==='APPROVE'?'Approving ':'Denying ')+(batch.index+1)+' of '+batch.ops.length+'…');
    const target='requestDecisionBatchFrame_'+Date.now()+'_'+batch.index;
    const frame=document.createElement('iframe');frame.name=target;frame.style.display='none';frame.setAttribute('aria-hidden','true');document.body.appendChild(frame);batch.currentFrame=frame;
    const form=document.createElement('form');form.method='POST';form.action=BACKEND;form.target=target;form.style.display='none';
    [['action','requestdecision'],['requestId',op.requestId],['decision',op.decision],['approvals',JSON.stringify(op.approvals)]].forEach(pair=>{const i=document.createElement('input');i.type='hidden';i.name=pair[0];i.value=pair[1];form.appendChild(i);});
    document.body.appendChild(form);form.submit();form.remove();
  }

  function trustedOrigin(origin){return origin===location.origin||/^https:\/\/(?:script\.google\.com|[^/]+\.googleusercontent\.com)$/.test(origin||'');}

  window.addEventListener('message',e=>{
    const d=e.data||{};if(!trustedOrigin(e.origin)||d.source!=='robotics-inventory-backend')return;
    if(d.type!=='request-queue'&&d.type!=='request-queue-error')return;

    if(batch){
      try{if(batch.currentFrame)batch.currentFrame.remove();}catch(err){}
      batch.currentFrame=null;
      if(d.type==='request-queue-error'||!d.ok){
        const done=batch.success;const msg=d.message||'A request decision could not be saved.';batch=null;clearSaving();showResult((done?done+' saved before the error. ':'')+msg,true);return;
      }
      batch.success++;batch.index++;
      setTimeout(sendNext,80);
      return;
    }

    if(d.type==='request-queue'&&d.ok){
      latestRequests=Array.isArray(d.requests)?d.requests:[];
      setTimeout(augment,50);
    }
  });
})();
