(function(){
  if(!(/\/Inventory\/?$/i.test(location.pathname)||/\/Inventory\/index\.html$/i.test(location.pathname)))return;

  const BACKEND='https://script.google.com/a/macros/mercersburg.edu/s/AKfycbwO-eAB-qrabGBpqbTpLWAkSUQUITiJQ3KPLIZEwjCJBN-wb8yyTgInNT-bXRbPinTA/exec';
  let latestRequests=[];

  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));

  function installStyles(){
    if(document.getElementById('request-decision-css'))return;
    const s=document.createElement('style');
    s.id='request-decision-css';
    s.textContent='.rq-approve-input{width:72px;border:1px solid #cbd1d5;border-radius:6px;padding:6px 7px;font:inherit}.rq-decision-panel{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:11px 14px;background:#fafbf9;border-top:1px solid #e5e8e6}.rq-decision-note{margin-right:auto;font-size:10px;color:#67727c}.rq-decision-btn{border:0;border-radius:7px;padding:8px 11px;font-weight:850;cursor:pointer}.rq-decision-btn.approve{background:#256b49;color:white}.rq-decision-btn.deny{background:#8a352f;color:white}.rq-decision-btn:disabled{opacity:.45;cursor:not-allowed}.rq-result{border-radius:9px;padding:10px 12px;margin-bottom:12px;font-size:11px;font-weight:800}.rq-result.ok{background:#edf7f1;border:1px solid #b8d9c5;color:#256b49}.rq-result.error{background:#fff4f2;border:1px solid #e7bbb7;color:#7f2d27}.rq-saving{background:#eef3fa;border:1px solid #b9cbe0;color:#365b80;border-radius:9px;padding:10px 12px;margin:0 14px 11px;font-size:11px;font-weight:800}@media(max-width:720px){.rq-decision-panel{align-items:stretch;flex-direction:column}.rq-decision-note{margin-right:0}}';
    document.head.appendChild(s);
  }

  function requestById(id){return latestRequests.find(r=>String(r.requestId||'')===id)||null;}

  function augment(){
    installStyles();
    document.querySelectorAll('.rq-card').forEach(card=>{
      if(card.dataset.decisionReady==='1')return;
      const idNode=card.querySelector('.rq-id');
      const requestId=idNode?String(idNode.textContent||'').trim():'';
      const request=requestById(requestId);
      if(!request||String(request.status||'').toUpperCase()!=='SUBMITTED')return;

      const rows=card.querySelectorAll('.rq-items tbody tr');
      rows.forEach((tr,index)=>{
        const item=(request.items||[])[index];
        const cells=tr.querySelectorAll('td');
        if(!item||cells.length<3)return;
        const requested=Math.max(1,Number(item.requestedQty||1));
        cells[2].innerHTML='<input class="rq-approve-input" type="number" min="1" max="'+requested+'" step="1" value="'+requested+'" data-part-id="'+esc(item.partId)+'" data-requested="'+requested+'" aria-label="Approved quantity for '+esc(item.partName||item.partId)+'">';
      });

      const panel=document.createElement('div');
      panel.className='rq-decision-panel';
      panel.innerHTML='<span class="rq-decision-note">Adjust quantities if needed, then click a Save button to record the decision.</span><button class="rq-decision-btn deny" type="button">Deny &amp; Save</button><button class="rq-decision-btn approve" type="button">Approve &amp; Save</button>';
      panel.querySelector('.deny').onclick=()=>submitDecision(card,requestId,'DENY');
      panel.querySelector('.approve').onclick=()=>submitDecision(card,requestId,'APPROVE');
      card.appendChild(panel);
      card.dataset.decisionReady='1';
    });
  }

  function setBusy(card,busy,decision){
    card.querySelectorAll('.rq-decision-btn,.rq-approve-input').forEach(el=>el.disabled=!!busy);
    let msg=card.querySelector('.rq-saving');
    if(busy){
      if(!msg){msg=document.createElement('div');msg.className='rq-saving';card.appendChild(msg);}
      msg.textContent=decision==='APPROVE'?'Saving approval…':'Saving denial…';
    }else if(msg){msg.remove();}
  }

  function submitDecision(card,requestId,decision){
    const request=requestById(requestId);if(!request)return;
    let approvals=[];
    if(decision==='APPROVE'){
      const inputs=[...card.querySelectorAll('.rq-approve-input')];
      for(const input of inputs){
        const requested=Number(input.dataset.requested||0),qty=Number(input.value);
        if(!Number.isInteger(qty)||qty<1||qty>requested){
          alert('Approved quantity must be a whole number from 1 to '+requested+'.');input.focus();return;
        }
        approvals.push({partId:input.dataset.partId,quantity:qty});
      }
      if(approvals.length!==(request.items||[]).length){alert('Could not read all approval quantities. Refresh the queue and try again.');return;}
      if(!confirm('Approve and save this request now?'))return;
    }else if(!confirm('Deny and save this entire request now?'))return;

    setBusy(card,true,decision);
    const target='requestDecisionFrame_'+Date.now();
    const frame=document.createElement('iframe');frame.name=target;frame.style.display='none';frame.setAttribute('aria-hidden','true');document.body.appendChild(frame);
    const form=document.createElement('form');form.method='POST';form.action=BACKEND;form.target=target;form.style.display='none';
    [['action','requestdecision'],['requestId',requestId],['decision',decision],['approvals',JSON.stringify(approvals)]].forEach(pair=>{const i=document.createElement('input');i.type='hidden';i.name=pair[0];i.value=pair[1];form.appendChild(i);});
    document.body.appendChild(form);form.submit();form.remove();
    setTimeout(()=>{try{frame.remove();}catch(e){};setBusy(card,false,decision);},15000);
  }

  function trustedOrigin(origin){return origin===location.origin||/^https:\/\/(?:script\.google\.com|[^/]+\.googleusercontent\.com)$/.test(origin||'');}

  window.addEventListener('message',e=>{
    const d=e.data||{};if(!trustedOrigin(e.origin)||d.source!=='robotics-inventory-backend')return;
    if(d.type!=='request-queue'&&d.type!=='request-queue-error')return;
    if(d.type==='request-queue'&&d.ok){latestRequests=Array.isArray(d.requests)?d.requests:[];setTimeout(()=>{augment();if(d.message){const body=document.getElementById('requestQueueBody');if(body){const n=document.createElement('div');n.className='rq-result ok';n.textContent=d.message;body.insertBefore(n,body.firstChild);}}},40);}
    else if(d.message){setTimeout(()=>{const body=document.getElementById('requestQueueBody');if(body){const n=document.createElement('div');n.className='rq-result error';n.textContent=d.message;body.insertBefore(n,body.firstChild);}},40);}
  });
})();
