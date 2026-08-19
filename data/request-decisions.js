(function(){
  if(!(/\/Inventory\/?$/i.test(location.pathname)||/\/Inventory\/index\.html$/i.test(location.pathname)))return;

  const BACKEND='https://script.google.com/a/macros/mercersburg.edu/s/AKfycbwO-eAB-qrabGBpqbTpLWAkSUQUITiJQ3KPLIZEwjCJBN-wb8yyTgInNT-bXRbPinTA/exec';
  let latestRequests=[];
  let staged={};
  let submitting=false;

  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const key=(requestId,partId)=>requestId+'|'+partId;
  const isSubmittedItem=item=>String(item&&item.status||'SUBMITTED').toUpperCase()==='SUBMITTED';

  function installStyles(){
    if(document.getElementById('request-decision-css'))return;
    const s=document.createElement('style');
    s.id='request-decision-css';
    s.textContent=`
      .rq-decision-cell{min-width:225px}.rq-item-controls{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.rq-item-choice{border:1px solid #cbd1d5;border-radius:7px;padding:7px 10px;font-size:10px;font-weight:850;cursor:pointer;background:#fff;color:#3D5266}.rq-item-choice.approve.active{background:#256b49;border-color:#256b49;color:#fff}.rq-item-choice.decline.active{background:#8a352f;border-color:#8a352f;color:#fff}.rq-item-choice:disabled{opacity:.5;cursor:not-allowed}.rq-approve-qty{width:66px;border:1px solid #cbd1d5;border-radius:6px;padding:6px 7px;font:inherit}.rq-approve-qty:disabled{background:#f2f3f2;color:#9aa2a8}.rq-stage-label{font-size:9px;font-weight:850;color:#67727c}.rq-final-item{font-size:10px;font-weight:850;color:#67727c}.rq-submit-footer{margin-top:16px;background:#fff;border:1px solid #d9ddda;border-radius:11px;padding:14px 16px;display:flex;align-items:center;gap:12px;justify-content:flex-end}.rq-submit-summary{margin-right:auto;color:#3D5266;font-size:11px;font-weight:800}.rq-submit-decisions{border:0;border-radius:8px;background:#0B1A2E;color:#fff;padding:10px 15px;font-weight:900;cursor:pointer}.rq-submit-decisions:disabled{opacity:.45;cursor:not-allowed}.rq-result{border-radius:9px;padding:10px 12px;margin-bottom:12px;font-size:11px;font-weight:800}.rq-result.ok{background:#edf7f1;border:1px solid #b8d9c5;color:#256b49}.rq-result.error{background:#fff4f2;border:1px solid #e7bbb7;color:#7f2d27}@media(max-width:720px){.rq-submit-footer{align-items:stretch;flex-direction:column}.rq-submit-summary{margin-right:0}.rq-submit-decisions{width:100%}.rq-decision-cell{min-width:190px}}
    `;
    document.head.appendChild(s);
  }

  function requestById(id){return latestRequests.find(r=>String(r.requestId||'')===id)||null;}
  function anySubmittedItems(){return latestRequests.some(r=>(r.items||[]).some(isSubmittedItem));}

  function setChoice(requestId,item,choice,row){
    if(submitting)return;
    const k=key(requestId,item.partId);
    staged[k]={requestId:requestId,partId:item.partId,decision:choice,approvedQty:choice==='APPROVE'?Math.max(1,Number(item.requestedQty||1)):0};
    renderRowChoice(row,k,item);
    updateFooter();
  }

  function renderRowChoice(row,k,item){
    const d=staged[k]||null;
    const approve=row.querySelector('.rq-item-choice.approve');
    const decline=row.querySelector('.rq-item-choice.decline');
    const qty=row.querySelector('.rq-approve-qty');
    const label=row.querySelector('.rq-stage-label');
    if(approve)approve.classList.toggle('active',!!d&&d.decision==='APPROVE');
    if(decline)decline.classList.toggle('active',!!d&&d.decision==='DENY');
    if(qty){qty.disabled=!d||d.decision!=='APPROVE'||submitting;if(d&&d.decision==='APPROVE')qty.value=String(d.approvedQty);}
    if(label)label.textContent=!d?'Not decided':d.decision==='APPROVE'?'Staged: Approve':'Staged: Decline';
  }

  function augment(){
    installStyles();
    document.querySelectorAll('.rq-card').forEach(card=>{
      const idNode=card.querySelector('.rq-id');
      const requestId=idNode?String(idNode.textContent||'').trim():'';
      const request=requestById(requestId);
      if(!request||(request.items||[]).every(item=>!isSubmittedItem(item)))return;
      if(card.dataset.itemDecisionReady==='1')return;

      const headRow=card.querySelector('.rq-items thead tr');
      if(headRow){const th=document.createElement('th');th.textContent='Decision';headRow.appendChild(th);}

      const rows=card.querySelectorAll('.rq-items tbody tr');
      rows.forEach((row,index)=>{
        const item=(request.items||[])[index];if(!item)return;
        const td=document.createElement('td');td.className='rq-decision-cell';row.appendChild(td);
        if(!isSubmittedItem(item)){
          td.innerHTML='<span class="rq-final-item">'+esc(String(item.status||'DECIDED').replace(/_/g,' '))+'</span>';
          return;
        }
        const requested=Math.max(1,Number(item.requestedQty||1));
        td.innerHTML='<div class="rq-item-controls"><button class="rq-item-choice approve" type="button">Approve</button><button class="rq-item-choice decline" type="button">Decline</button><input class="rq-approve-qty" type="number" min="1" max="'+requested+'" step="1" value="'+requested+'" disabled aria-label="Approved quantity for '+esc(item.partName||item.partId)+'"><span class="rq-stage-label">Not decided</span></div>';
        const k=key(requestId,item.partId);
        td.querySelector('.approve').onclick=()=>setChoice(requestId,item,'APPROVE',row);
        td.querySelector('.decline').onclick=()=>setChoice(requestId,item,'DENY',row);
        td.querySelector('.rq-approve-qty').oninput=e=>{const d=staged[k];if(!d||d.decision!=='APPROVE')return;const qty=Number(e.target.value);if(Number.isInteger(qty)&&qty>=1&&qty<=requested)d.approvedQty=qty;updateFooter();};
        renderRowChoice(row,k,item);
      });
      card.dataset.itemDecisionReady='1';
    });
    ensureFooter();updateFooter();
  }

  function ensureFooter(){
    const body=document.getElementById('requestQueueBody');if(!body||document.getElementById('rqSubmitFooter')||!anySubmittedItems())return;
    const footer=document.createElement('div');footer.id='rqSubmitFooter';footer.className='rq-submit-footer';
    footer.innerHTML='<div id="rqSubmitSummary" class="rq-submit-summary">No decisions staged.</div><button id="rqSubmitDecisions" class="rq-submit-decisions" type="button" disabled>Submit Decisions</button>';
    body.appendChild(footer);document.getElementById('rqSubmitDecisions').onclick=submitDecisions;
  }

  function validStaged(){
    const values=Object.values(staged);
    for(const d of values){
      if(d.decision==='APPROVE'){
        const request=requestById(d.requestId);const item=request&&(request.items||[]).find(i=>i.partId===d.partId);const max=item?Number(item.requestedQty||0):0;
        if(!Number.isInteger(Number(d.approvedQty))||Number(d.approvedQty)<1||Number(d.approvedQty)>max)return false;
      }
    }
    return true;
  }

  function updateFooter(){
    const count=Object.keys(staged).length;
    const summary=document.getElementById('rqSubmitSummary');if(summary)summary.textContent=count?count+' decision'+(count===1?'':'s')+' staged. Nothing has been saved yet.':'No decisions staged.';
    const btn=document.getElementById('rqSubmitDecisions');if(btn){btn.disabled=!count||submitting||!validStaged();btn.textContent=submitting?'Submitting…':'Submit Decisions';}
  }

  function showMessage(text,error){
    const body=document.getElementById('requestQueueBody');if(!body)return;
    const old=document.getElementById('rqDecisionMessage');if(old)old.remove();
    const n=document.createElement('div');n.id='rqDecisionMessage';n.className='rq-result '+(error?'error':'ok');n.textContent=text;body.insertBefore(n,body.firstChild);
  }

  function submitDecisions(){
    if(submitting)return;
    const decisions=Object.values(staged);if(!decisions.length)return;
    if(!validStaged()){showMessage('One approved quantity is invalid. Correct it before submitting.',true);return;}
    submitting=true;updateFooter();document.querySelectorAll('.rq-item-choice,.rq-approve-qty').forEach(el=>el.disabled=true);showMessage('Submitting '+decisions.length+' decision'+(decisions.length===1?'':'s')+'…',false);
    const target='requestDecisionsFrame_'+Date.now();
    const frame=document.createElement('iframe');frame.name=target;frame.style.display='none';frame.setAttribute('aria-hidden','true');document.body.appendChild(frame);
    const form=document.createElement('form');form.method='POST';form.action=BACKEND;form.target=target;form.style.display='none';
    [['action','requestdecisions'],['decisions',JSON.stringify(decisions)]].forEach(pair=>{const i=document.createElement('input');i.type='hidden';i.name=pair[0];i.value=pair[1];form.appendChild(i);});
    document.body.appendChild(form);form.submit();form.remove();setTimeout(()=>{try{frame.remove();}catch(e){}},20000);
  }

  function trustedOrigin(origin){return origin===location.origin||/^https:\/\/(?:script\.google\.com|[^/]+\.googleusercontent\.com)$/.test(origin||'');}

  window.addEventListener('message',e=>{
    const d=e.data||{};if(!trustedOrigin(e.origin)||d.source!=='robotics-inventory-backend')return;
    if(d.type!=='request-queue'&&d.type!=='request-queue-error')return;
    if(submitting){
      submitting=false;
      if(d.type==='request-queue-error'||!d.ok){showMessage(d.message||'The decisions could not be saved.',true);updateFooter();setTimeout(augment,50);return;}
      staged={};latestRequests=Array.isArray(d.requests)?d.requests:[];
      const refresh=document.getElementById('requestQueueRefresh');if(refresh)refresh.click();
      setTimeout(()=>showMessage(d.message||'Decisions saved.',false),250);return;
    }
    if(d.type==='request-queue'&&d.ok){latestRequests=Array.isArray(d.requests)?d.requests:[];setTimeout(augment,50);}
  });
})();
