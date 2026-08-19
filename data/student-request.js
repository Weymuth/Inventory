(function(){
  if(!/\/student\.html$/i.test(location.pathname))return;

  const BACKEND='https://script.google.com/a/macros/mercersburg.edu/s/AKfycbwO-eAB-qrabGBpqbTpLWAkSUQUITiJQ3KPLIZEwjCJBN-wb8yyTgInNT-bXRbPinTA/exec';
  let requestDraft=[];
  let submitting=false;

  const $=id=>document.getElementById(id);
  const data=()=>window.INVENTORY_DATA||[];
  const bool=v=>v===true||v===1||String(v).toUpperCase()==='TRUE';
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const retired=x=>bool(x&&x.ret)||String(x&&x.s||'').toUpperCase()==='RETIRED';
  const unavailable=x=>bool(x&&x.ua);
  const notInventoried=x=>bool(x&&x.ni)||x&&x.iv===0;
  const active=x=>!(x&&(x.active===false||x.active===0));
  const study=x=>bool(x&&x.sg);

  function mode(){return $('modeTitle')&&/study/i.test($('modeTitle').textContent||'')?'study':'request';}
  function program(){const b=document.querySelector('.pill.active[data-program]');return b?b.dataset.program:'VEX';}
  function searchText(){return String($('studentSearch')&&$('studentSearch').value||'').trim().toLowerCase();}

  function installStyles(){
    if($('student-request-css'))return;
    const s=document.createElement('style');s.id='student-request-css';
    s.textContent='.draft-list{display:block!important}.request-line{display:grid;grid-template-columns:minmax(0,1fr) 74px auto;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid #e4e7e5}.request-line:last-child{border-bottom:0}.request-part{font-size:11px;font-weight:800;color:#0B1A2E}.request-qty{width:74px;border:1px solid #cbd1d5;border-radius:7px;padding:6px 7px}.request-remove{border:0;background:transparent;color:#9a342c;font-weight:850;padding:5px}.request-actions{display:flex;gap:8px;align-items:center}.request-status{display:none;border-radius:9px;padding:10px 12px;margin:0 0 12px;font-size:12px;font-weight:750}.request-status.open{display:block}.request-status.ok{background:#edf7f1;border:1px solid #b8d9c5;color:#256b49}.request-status.error{background:#fff4f2;border:1px solid #e7bbb7;color:#7f2d27}';
    document.head.appendChild(s);
  }

  function updateWording(){
    const right=document.querySelector('.head-right');
    if(right&&/order what you need/i.test(right.textContent||''))right.innerHTML='Request what you need.<br><strong>Learn what you use.</strong>';
    document.querySelectorAll('.choice h2').forEach(h=>{if(/^Order Parts$/i.test(h.textContent||''))h.textContent='Request Parts';});
    if($('modeTitle')&&/^Order Parts$/i.test($('modeTitle').textContent||''))$('modeTitle').textContent='Request Parts';
    if($('modeHint')&&mode()==='request')$('modeHint').textContent='Current inventoried parts can be requested even when availability is 0.';
    const note=document.querySelector('.draft-note');if(note)note.textContent='Set the quantity for each part, then submit your request.';
  }

  function statusBox(){
    let b=$('requestStatus');if(b)return b;
    b=document.createElement('div');b.id='requestStatus';b.className='request-status';
    const d=$('draft');if(d&&d.parentNode)d.parentNode.insertBefore(b,d);
    return b;
  }
  function showStatus(message,error){const b=statusBox();if(!b)return;b.textContent=message;b.className='request-status open '+(error?'error':'ok');}
  function clearStatus(){const b=$('requestStatus');if(b)b.className='request-status';}

  function rows(){
    const q=searchText(),m=mode(),p=program();
    return data().filter(x=>{
      if(!active(x)||x.p!==p)return false;
      if(m==='request'&&(retired(x)||unavailable(x)||notInventoried(x)))return false;
      if(m==='study'&&!study(x))return false;
      return !q||[x.i,x.n,x.m,x.x,x.c,x.p].some(v=>String(v||'').toLowerCase().includes(q));
    });
  }

  function image(x){return x.g?'<img src="'+esc(x.g)+'" alt="" loading="lazy" onerror="this.parentElement.innerHTML=\'<div class=&quot;missing&quot;>Image unavailable</div>\'">':'<div class="missing">No image</div>';}

  function renderGrid(){
    const grid=$('parts'),count=$('resultCount'),workspace=$('workspace');
    if(!grid||!count||!workspace||!workspace.classList.contains('open'))return;
    updateWording();
    const m=mode(),list=rows();count.textContent=list.length+' part'+(list.length===1?'':'s');
    if(!list.length){grid.innerHTML='<div class="empty">'+(m==='study'?'No Study Guide parts match this program and search.':'No requestable parts match this program and search.')+'</div>';return;}
    grid.innerHTML=list.map(x=>{
      const available=Number(x.a||0),added=requestDraft.some(d=>d.i===x.i);
      const right=m==='study'?'<span class="study-chip">Instructor selected</span>':'<div class="student-row"><div class="available '+(available<=0?'zero':'')+'"><b>'+available+'</b>Available</div><button class="add" type="button" '+(added?'disabled':'')+' onclick="addDraft(\''+esc(x.i)+'\')">'+(added?'Added':'Add')+'</button></div>';
      return '<article class="student-part"><div class="student-thumb">'+image(x)+'</div><div class="student-body"><div class="program-tag">'+esc(x.p)+'</div><div class="student-name">'+esc(x.n)+'</div><div class="student-meta">'+esc(x.m||'Manufacturer not listed')+(x.x?' · '+esc(x.x):'')+(x.c?'<br>'+esc(x.c):'')+'</div>'+right+'</div></article>';
    }).join('');
  }

  function ensureSubmit(){
    const head=document.querySelector('#draft .draft-head');if(!head)return;
    if(head.querySelector('.request-actions'))return;
    const actions=document.createElement('div');actions.className='request-actions';
    const clear=head.querySelector('button');if(clear){head.removeChild(clear);actions.appendChild(clear);}
    const submit=document.createElement('button');submit.id='requestSubmitBtn';submit.className='btn';submit.type='button';submit.textContent='Submit Request';submit.onclick=submitRequest;actions.appendChild(submit);head.appendChild(actions);
  }

  function renderDraft(){
    const box=$('draft'),list=$('draftList');if(!box||!list)return;
    if(mode()!=='request'||!requestDraft.length){box.classList.remove('open');list.innerHTML='';renderGrid();return;}
    box.classList.add('open');
    if($('draftTitle'))$('draftTitle').textContent='Draft '+requestDraft[0].p+' Request · '+requestDraft.length+' item'+(requestDraft.length===1?'':'s');
    list.innerHTML=requestDraft.map(x=>'<div class="request-line"><div class="request-part">'+esc(x.n)+'</div><input class="request-qty" type="number" min="1" max="999" step="1" value="'+x.q+'" onchange="updateRequestQty(\''+esc(x.i)+'\',this.value)"><button class="request-remove" type="button" onclick="removeRequestItem(\''+esc(x.i)+'\')">Remove</button></div>').join('');
    ensureSubmit();const submit=$('requestSubmitBtn');if(submit){submit.disabled=submitting;submit.textContent=submitting?'Submitting…':'Submit Request';}
    renderGrid();
  }

  window.addDraft=function(partId){
    const x=data().find(i=>i.i===partId);if(!x||!active(x)||retired(x)||unavailable(x)||notInventoried(x))return;
    if(requestDraft.length&&requestDraft[0].p!==x.p){alert('One request can contain only one program.');return;}
    if(requestDraft.some(i=>i.i===partId))return;
    requestDraft.push({i:x.i,n:x.n,p:x.p,q:1});clearStatus();renderDraft();
  };
  window.clearDraft=function(){if(submitting)return;requestDraft=[];clearStatus();renderDraft();};
  window.updateRequestQty=function(partId,value){const x=requestDraft.find(i=>i.i===partId);if(!x)return;let q=Math.floor(Number(value));if(!Number.isFinite(q)||q<1)q=1;if(q>999)q=999;x.q=q;renderDraft();};
  window.removeRequestItem=function(partId){if(submitting)return;requestDraft=requestDraft.filter(i=>i.i!==partId);renderDraft();};

  function hidden(form,name,value){const i=document.createElement('input');i.type='hidden';i.name=name;i.value=value;form.appendChild(i);}
  function submitRequest(){
    if(submitting||!requestDraft.length)return;
    const p=requestDraft[0].p;if(requestDraft.some(x=>x.p!==p)){alert('One request can contain only one program.');return;}
    const target='studentPartsRequest';
    const popup=window.open('',target,'popup,width=520,height=420,resizable=yes,scrollbars=yes');
    if(!popup){alert('Allow popups for this site so your request can be submitted.');return;}
    const form=document.createElement('form');form.method='POST';form.action=BACKEND;form.target=target;form.style.display='none';
    hidden(form,'action','requestparts');hidden(form,'program',p);hidden(form,'items',JSON.stringify(requestDraft.map(x=>({partId:x.i,quantity:x.q}))));
    document.body.appendChild(form);submitting=true;clearStatus();renderDraft();form.submit();form.remove();
  }

  function handleBridge(payload){
    if(!payload||payload.source!=='robotics-inventory-backend')return;
    if(payload.type==='request-submitted'&&payload.ok){submitting=false;requestDraft=[];renderDraft();showStatus('Request submitted · '+payload.requestId,false);}
    else if(payload.type==='request-error'){submitting=false;renderDraft();showStatus(payload.message||'The request could not be submitted.',true);}
  }

  window.addEventListener('load',function(){
    installStyles();updateWording();statusBox();
    const originalOpen=window.openWorkspace;
    if(typeof originalOpen==='function')window.openWorkspace=function(nextMode){originalOpen(nextMode);updateWording();setTimeout(()=>{renderDraft();renderGrid();},0);};

    document.addEventListener('click',function(e){
      const b=e.target.closest&&e.target.closest('.pill[data-program]');if(!b||!requestDraft.length)return;
      if(b.dataset.program===requestDraft[0].p)return;
      if(!confirm('Clear the current request and switch programs?')){e.preventDefault();e.stopImmediatePropagation();return;}
      requestDraft=[];clearStatus();renderDraft();
    },true);

    const search=$('studentSearch');if(search)search.addEventListener('input',()=>setTimeout(renderGrid,0));
    document.querySelectorAll('.pill[data-program]').forEach(b=>b.addEventListener('click',()=>setTimeout(()=>{renderDraft();renderGrid();},0)));
    window.addEventListener('message',e=>{if(e.origin===location.origin)handleBridge(e.data||null);});
    window.addEventListener('storage',e=>{if(e.key!=='roboticsInventoryBridgeEvent'||!e.newValue)return;try{handleBridge(JSON.parse(e.newValue).payload||null);}catch(err){}});
    try{const channel=new BroadcastChannel('robotics-inventory');channel.onmessage=e=>handleBridge(e.data||null);}catch(e){}
  });
})();
