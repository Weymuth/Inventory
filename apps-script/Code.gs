const CONFIG=Object.freeze({
  SPREADSHEET_ID:'1qgV-9SOsLiF6lWj1-Ah2jCujwF7Dk_TSoA8X4nu92h0',
  FRONTEND_ORIGIN:'https://weymuth.github.io',
  FRONTEND_URL:'https://weymuth.github.io/Inventory/bridge.html',
  USERS_SHEET:'USERS',
  PARTS_SHEET:'PARTS',
  INVENTORY_SHEET:'INVENTORY',
  TRANSACTIONS_SHEET:'TRANSACTIONS',
  TIME_ZONE:'America/New_York'
});

function doGet(e){
  try{
    const p=(e&&e.parameter)||{};
    const action=String(p.action||'status').toLowerCase();

    if(action==='status'){
      const user=requireInventoryUser_();
      return simplePage_('Inventory backend online','Signed in as '+user.firstName+' '+user.lastName+' ('+user.role+').');
    }

    if(action==='bootstrap'){
      const user=requireInventoryUser_();
      return returnPage_(
        'Connected',
        'Authentication succeeded. Return to the inventory page to finish connecting.',
        buildFrontendUrl_({
          bridge:'bootstrap',ok:'1',email:user.email,firstName:user.firstName,lastName:user.lastName,role:user.role,
          balances:compactBalances_(getAllBalances_())
        })
      );
    }

    if(action==='partflag'){
      const user=requireTeacherOrAdmin_();
      const result=setPartFlag_(user,normalizePartFlagRequest_(p));
      return autoReturnPage_('Part status updated',buildFrontendUrl_({
        bridge:'part-flag-updated',ok:'1',partId:result.partId,
        retired:result.retired?'1':'0',
        unavailable:result.unavailable?'1':'0',
        notInventoried:result.notInventoried?'1':'0',
        studyGuide:result.studyGuide?'1':'0'
      }));
    }

    if(action==='imageurl'){
      const user=requireTeacherOrAdmin_();
      const result=setPartImageUrl_(user,normalizePartImageRequest_(p));
      return autoReturnPage_('Part image updated',buildFrontendUrl_({
        bridge:'part-image-updated',ok:'1',partId:result.partId,imageUrl:result.imageUrl
      }));
    }

    if(action==='partname'){
      const user=requireTeacherOrAdmin_();
      const result=setPartName_(user,normalizePartNameRequest_(p));
      return autoReturnPage_('Part renamed',buildFrontendUrl_({
        bridge:'part-name-updated',ok:'1',partId:result.partId,partName:result.partName
      }));
    }

    if(action==='partactive'){
      const user=requireTeacherOrAdmin_();
      const result=setPartActive_(user,normalizePartActiveRequest_(p));
      return autoReturnPage_(result.active?'Part restored':'Part deleted',buildFrontendUrl_({
        bridge:'part-active-updated',ok:'1',partId:result.partId,active:result.active?'1':'0'
      }));
    }

    if(action==='move'){
      const user=requireTeacherOrAdmin_();
      const request=normalizeMoveRequest_(p);
      const current=getPartBalances_(request.partId);
      const available=Number(current[stateKey_(request.fromState)]||0);
      if(available<request.quantity)throw new Error('Only '+available+' units are currently in '+request.fromState+'.');
      return confirmationPage_(user,request,issueNonce_(user.email,request),available);
    }

    throw new Error('Unknown backend action.');
  }catch(err){
    const p=(e&&e.parameter)||{};
    const action=String(p.action||'').toLowerCase();
    const base={ok:'0',partId:String(p.partId||''),message:safeError_(err)};
    if(action==='partflag'){
      base.bridge='part-flag-error';base.flag=String(p.flag||'');
      return autoReturnPage_('Part status error',buildFrontendUrl_(base));
    }
    if(action==='imageurl'){
      base.bridge='part-image-error';
      return autoReturnPage_('Part image error',buildFrontendUrl_(base));
    }
    if(action==='partname'){
      base.bridge='part-name-error';
      return autoReturnPage_('Part rename error',buildFrontendUrl_(base));
    }
    if(action==='partactive'){
      base.bridge='part-active-error';
      return autoReturnPage_('Part delete/restore error',buildFrontendUrl_(base));
    }
    return simplePage_('Inventory backend error',safeError_(err));
  }
}

function confirmMoveFromUi(partId,fromState,toState,quantity,nonce){
  const user=requireTeacherOrAdmin_();
  const request=normalizeMoveRequest_({partId:partId,fromState:fromState,toState:toState,quantity:quantity});
  verifyNonce_(user.email,request,String(nonce||''));
  const result=moveInventoryState_(user,request);
  const b=result.balances;
  return{
    ok:true,
    transactionId:result.transactionId,
    returnUrl:buildFrontendUrl_({
      bridge:'inventory-updated',ok:'1',partId:request.partId,
      available:Number(b.available||0),storage:Number(b.storage||0),
      checkedOut:Number(b.checkedOut||0),unclassified:Number(b.unclassified||0),
      transactionId:result.transactionId,email:user.email,firstName:user.firstName,lastName:user.lastName,role:user.role
    })
  };
}

function normalizePartFlagRequest_(p){
  const partId=String(p.partId||'').trim().toUpperCase();
  const flag=String(p.flag||'').trim().toUpperCase().replace(/-/g,'_');
  const text=String(p.enabled==null?'':p.enabled).trim().toLowerCase();
  if(!/^P-\d{6}$/.test(partId))throw new Error('Invalid PartID.');
  if(!['RETIRED','UNAVAILABLE','NOT_INVENTORIED','STUDY_GUIDE'].includes(flag))throw new Error('Invalid part status flag.');
  let enabled;
  if(['1','true','yes','on'].includes(text))enabled=true;
  else if(['0','false','no','off'].includes(text))enabled=false;
  else throw new Error('Invalid flag value.');
  return{partId:partId,flag:flag,enabled:enabled};
}

function setPartFlag_(user,request){
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const sheet=SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(CONFIG.PARTS_SHEET);
    if(!sheet)throw new Error('PARTS sheet not found.');
    const values=sheet.getDataRange().getValues();
    if(!values.length)throw new Error('PARTS sheet is empty.');
    const h=headerMap_(values[0]);
    if(h.ProductStatus===undefined||h.Unavailable===undefined||h.NotInventoried===undefined||h.StudyGuide===undefined)
      throw new Error('PARTS status columns are missing.');

    let rowIndex=0,row=null;
    for(let r=1;r<values.length;r++){
      if(String(values[r][h.PartID]||'').trim().toUpperCase()===request.partId){rowIndex=r+1;row=values[r];break;}
    }
    if(!rowIndex||!row)throw new Error('Part not found.');

    let retired=String(row[h.ProductStatus]||'').trim().toUpperCase()==='RETIRED';
    let unavailable=row[h.Unavailable]===true||String(row[h.Unavailable]).toUpperCase()==='TRUE';
    let notInventoried=row[h.NotInventoried]===true||String(row[h.NotInventoried]).toUpperCase()==='TRUE';
    let studyGuide=row[h.StudyGuide]===true||String(row[h.StudyGuide]).toUpperCase()==='TRUE';

    if(request.flag==='RETIRED'){
      retired=request.enabled;sheet.getRange(rowIndex,h.ProductStatus+1).setValue(retired?'Retired':'Current');
    }else if(request.flag==='UNAVAILABLE'){
      unavailable=request.enabled;sheet.getRange(rowIndex,h.Unavailable+1).setValue(unavailable);
    }else if(request.flag==='NOT_INVENTORIED'){
      notInventoried=request.enabled;sheet.getRange(rowIndex,h.NotInventoried+1).setValue(notInventoried);
    }else{
      studyGuide=request.enabled;sheet.getRange(rowIndex,h.StudyGuide+1).setValue(studyGuide);
    }
    SpreadsheetApp.flush();
    return{partId:request.partId,retired:retired,unavailable:unavailable,notInventoried:notInventoried,studyGuide:studyGuide,changedBy:user.email};
  }finally{lock.releaseLock();}
}

function normalizePartImageRequest_(p){
  const partId=String(p.partId||'').trim().toUpperCase();
  let imageUrl=String(p.imageUrl||'').trim();
  if(!/^P-\d{6}$/.test(partId))throw new Error('Invalid PartID.');
  const m=imageUrl.match(/^=IMAGE\(\s*["'](.+?)["']\s*\)$/i);
  if(m)imageUrl=String(m[1]||'').trim();
  if(!/^https?:\/\/\S+$/i.test(imageUrl))throw new Error('Paste a complete http:// or https:// image link.');
  return{partId:partId,imageUrl:imageUrl};
}

function setPartImageUrl_(user,request){
  return setPartCell_(user,request.partId,'ImageURL',request.imageUrl,{
    result:{partId:request.partId,imageUrl:request.imageUrl}
  });
}

function normalizePartNameRequest_(p){
  const partId=String(p.partId||'').trim().toUpperCase();
  const partName=String(p.partName||'').replace(/\s+/g,' ').trim();
  if(!/^P-\d{6}$/.test(partId))throw new Error('Invalid PartID.');
  if(partName.length<2)throw new Error('Part name must contain at least 2 characters.');
  if(partName.length>160)throw new Error('Part name is too long.');
  if(/[\u0000-\u001F\u007F]/.test(partName))throw new Error('Part name contains invalid characters.');
  return{partId:partId,partName:partName};
}

function setPartName_(user,request){
  return setPartCell_(user,request.partId,'PartName',request.partName,{
    result:{partId:request.partId,partName:request.partName}
  });
}

function normalizePartActiveRequest_(p){
  const partId=String(p.partId||'').trim().toUpperCase();
  const text=String(p.active==null?'':p.active).trim().toLowerCase();
  if(!/^P-\d{6}$/.test(partId))throw new Error('Invalid PartID.');
  let active;
  if(['1','true','yes','on'].includes(text))active=true;
  else if(['0','false','no','off'].includes(text))active=false;
  else throw new Error('Invalid Active value.');
  return{partId:partId,active:active};
}

function setPartActive_(user,request){
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const ss=SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet=ss.getSheetByName(CONFIG.PARTS_SHEET);
    if(!sheet)throw new Error('PARTS sheet not found.');
    const values=sheet.getDataRange().getValues();
    if(!values.length)throw new Error('PARTS sheet is empty.');
    const h=headerMap_(values[0]);
    if(h.PartID===undefined||h.Active===undefined)throw new Error('PARTS Active column is missing.');
    let rowIndex=0;
    for(let r=1;r<values.length;r++){
      if(String(values[r][h.PartID]||'').trim().toUpperCase()===request.partId){rowIndex=r+1;break;}
    }
    if(!rowIndex)throw new Error('Part not found.');

    if(!request.active){
      const b=getPartBalances_(request.partId)||{};
      const total=Number(b.available||0)+Number(b.storage||0)+Number(b.checkedOut||0)+Number(b.unclassified||0)+Number(b.repair||0);
      if(total>0)throw new Error('This card still has '+total+' inventory unit'+(total===1?'':'s')+'. Move or adjust that inventory before deleting the card.');
    }

    sheet.getRange(rowIndex,h.Active+1).setValue(request.active);
    SpreadsheetApp.flush();
    return{partId:request.partId,active:request.active,changedBy:user.email};
  }finally{lock.releaseLock();}
}

function setPartCell_(user,partId,columnName,value,options){
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const sheet=SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(CONFIG.PARTS_SHEET);
    if(!sheet)throw new Error('PARTS sheet not found.');
    const values=sheet.getDataRange().getValues();
    if(!values.length)throw new Error('PARTS sheet is empty.');
    const h=headerMap_(values[0]);
    if(h.PartID===undefined||h[columnName]===undefined)throw new Error('PARTS '+columnName+' column is missing.');
    let rowIndex=0;
    for(let r=1;r<values.length;r++){
      if(String(values[r][h.PartID]||'').trim().toUpperCase()===partId){rowIndex=r+1;break;}
    }
    if(!rowIndex)throw new Error('Part not found.');
    sheet.getRange(rowIndex,h[columnName]+1).setValue(value);
    SpreadsheetApp.flush();
    return Object.assign({},options&&options.result||{}, {changedBy:user.email});
  }finally{lock.releaseLock();}
}

function normalizeMoveRequest_(p){
  const partId=String(p.partId||'').trim().toUpperCase();
  const fromState=String(p.fromState||'').trim().toUpperCase();
  const toState=String(p.toState||'').trim().toUpperCase();
  const text=String(p.quantity==null?'':p.quantity).trim();
  const quantity=Number(text);
  if(!/^P-\d{6}$/.test(partId))throw new Error('Invalid PartID.');
  if(!['UNCLASSIFIED','STORAGE','AVAILABLE'].includes(fromState))throw new Error('Invalid source state.');
  if(!['STORAGE','AVAILABLE'].includes(toState))throw new Error('Invalid destination state.');
  if(fromState===toState)throw new Error('Source and destination states must be different.');
  if(!text||!Number.isFinite(quantity)||quantity<=0||Math.floor(quantity)!==quantity)throw new Error('Quantity must be a positive whole number.');
  return{partId:partId,fromState:fromState,toState:toState,quantity:quantity};
}

function stateKey_(state){
  return{AVAILABLE:'available',STORAGE:'storage',CHECKED_OUT:'checkedOut',UNCLASSIFIED:'unclassified',REPAIR:'repair',RETIRED:'retired'}[state];
}

function issueNonce_(email,request){
  const nonce=Utilities.getUuid();
  CacheService.getScriptCache().put('move:'+nonce,JSON.stringify({email:email,request:request}),600);
  return nonce;
}

function verifyNonce_(email,request,nonce){
  if(!nonce)throw new Error('Confirmation token is missing or expired.');
  const cache=CacheService.getScriptCache(),key='move:'+nonce,stored=cache.get(key);
  cache.remove(key);
  if(!stored)throw new Error('Confirmation token is missing or expired.');
  const payload=JSON.parse(stored);
  if(payload.email!==email||JSON.stringify(payload.request)!==JSON.stringify(request))
    throw new Error('Confirmation token does not match this inventory change.');
}

function confirmationPage_(user,request,nonce,available){
  const title=request.fromState==='UNCLASSIFIED'?'Classify inventory':'Move inventory';
  const requestJson=JSON.stringify(request).replace(/</g,'\\u003c');
  const nonceJson=JSON.stringify(String(nonce)).replace(/</g,'\\u003c');
  const body=`
    <div class="card" id="card">
      <div class="eyebrow">Robotics Inventory</div>
      <h1>${escapeHtml_(title)}</h1>
      <p>You are signed in as <strong>${escapeHtml_(user.firstName+' '+user.lastName)}</strong> (${escapeHtml_(user.role)}).</p>
      <dl>
        <dt>Part</dt><dd>${escapeHtml_(request.partId)}</dd>
        <dt>Quantity</dt><dd>${request.quantity}</dd>
        <dt>From</dt><dd>${escapeHtml_(request.fromState)}</dd>
        <dt>To</dt><dd>${escapeHtml_(request.toState)}</dd>
        <dt>Current source quantity</dt><dd>${available}</dd>
      </dl>
      <p class="note">This first migration step changes inventory state only. Physical room/cabinet/bin assignment will be added next.</p>
      <button id="confirmButton" type="button" onclick="confirmInventoryChange()">Confirm change</button>
      <p id="working" class="muted" style="display:none">Recording change…</p>
      <div id="result"></div>
    </div>
    <script>
      const moveRequest=${requestJson},moveNonce=${nonceJson};
      function confirmInventoryChange(){
        const button=document.getElementById('confirmButton');
        button.disabled=true;document.getElementById('working').style.display='block';document.getElementById('result').innerHTML='';
        google.script.run
          .withSuccessHandler(function(result){
            document.getElementById('working').style.display='none';
            if(!result||!result.ok){showFailure({message:'The inventory change did not return a valid result.'});return;}
            const c=document.getElementById('result'),h=document.createElement('h2'),t=document.createElement('p'),a=document.createElement('a');
            h.textContent='Inventory updated';t.textContent='Transaction '+result.transactionId+' was recorded.';
            a.className='return-button';a.href=result.returnUrl;a.target='_top';a.textContent='Return to Inventory';
            c.appendChild(h);c.appendChild(t);c.appendChild(a);button.style.display='none';
          })
          .withFailureHandler(showFailure)
          .confirmMoveFromUi(moveRequest.partId,moveRequest.fromState,moveRequest.toState,String(moveRequest.quantity),moveNonce);
      }
      function showFailure(error){
        document.getElementById('working').style.display='none';
        const button=document.getElementById('confirmButton');button.disabled=false;
        const message=error&&error.message?error.message:String(error||'Unknown error');
        const c=document.getElementById('result');c.innerHTML='';
        const h=document.createElement('h2'),t=document.createElement('p');h.textContent='Inventory error';t.textContent=message;c.appendChild(h);c.appendChild(t);
      }
    </script>`;
  return page_(title,body);
}

function autoReturnPage_(title,returnUrl){
  const target=JSON.stringify(String(returnUrl)).replace(/</g,'\\u003c');
  return page_(title,`<div class="card"><div class="eyebrow">Robotics Inventory</div><h1>${escapeHtml_(title)}</h1><p class="muted">Saving…</p></div><script>window.location.replace(${target});</script>`);
}

function returnPage_(title,message,returnUrl){
  return page_(title,`<div class="card"><div class="eyebrow">Robotics Inventory</div><h1>${escapeHtml_(title)}</h1><p>${escapeHtml_(message)}</p><p><a class="return-button" href="${escapeAttr_(returnUrl)}" target="_top">Return to Inventory</a></p></div>`);
}

function compactBalances_(balances){
  return Object.keys(balances).sort().map(partId=>{
    const b=balances[partId]||{},number=Number(String(partId).replace(/^P-/,''));
    return[number,Number(b.available||0),Number(b.storage||0),Number(b.checkedOut||0),Number(b.unclassified||0)].join(',');
  }).join('|');
}

function buildFrontendUrl_(params){
  const pairs=[];
  Object.keys(params).forEach(key=>{
    const value=params[key];
    if(value===undefined||value===null||value==='')return;
    pairs.push(encodeURIComponent(key)+'='+encodeURIComponent(String(value)));
  });
  return CONFIG.FRONTEND_URL+(pairs.length?'?'+pairs.join('&'):'');
}

function simplePage_(title,message){
  return page_(title,`<div class="card"><div class="eyebrow">Robotics Inventory</div><h1>${escapeHtml_(title)}</h1><p>${escapeHtml_(message)}</p></div>`);
}

function page_(title,body){
  return HtmlService.createHtmlOutput(`<!doctype html><html><head><base target="_top"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml_(title)}</title><style>body{font-family:Arial,sans-serif;background:#f5f6f4;color:#17202a;margin:0;padding:28px}.card{max-width:620px;margin:auto;background:#fff;border-top:6px solid #0B1A2E;border-radius:10px;padding:24px;box-shadow:0 10px 30px rgba(11,26,46,.12)}.eyebrow{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#7B6240;font-weight:700}h1,h2{color:#0B1A2E;margin:6px 0 18px}dl{display:grid;grid-template-columns:180px 1fr;gap:8px 14px}dt{font-weight:700;color:#3D5266}dd{margin:0}.note{background:#F5F2E9;padding:12px;border-left:4px solid #C9A463}.muted{color:#67727c}.return-button,button{display:inline-block;background:#0B1A2E;color:#fff;border:0;border-radius:7px;padding:11px 16px;font-weight:700;cursor:pointer;text-decoration:none}button:disabled{opacity:.55;cursor:wait}</style></head><body>${body}</body></html>`);
}

function safeError_(err){return String(err&&err.message?err.message:err||'Unknown error');}
function escapeHtml_(value){return String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function escapeAttr_(value){return escapeHtml_(value);}
