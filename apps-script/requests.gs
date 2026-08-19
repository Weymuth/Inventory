const REQUESTS_SHEET_NAME='REQUESTS';

function doPost(e){
  const p=(e&&e.parameter)||{};
  const action=String(p.action||'').trim().toLowerCase();
  try{
    if(action==='requestparts'){
      const user=requireInventoryUser_();
      const result=submitPartsRequest_(user,p);
      return requestReturnPage_(true,result.requestId,'');
    }

    if(action==='requestqueue'){
      const user=requireTeacherOrAdmin_();
      return requestQueuePage_(true,user,loadRequestQueue_(),'');
    }

    throw new Error('Unknown backend action.');
  }catch(err){
    if(action==='requestqueue')return requestQueuePage_(false,null,[],safeError_(err));
    return requestReturnPage_(false,'',safeError_(err));
  }
}

function submitPartsRequest_(user,p){
  const program=String(p.program||'').trim().toUpperCase();
  if(!['VEX','ROBOCUP'].includes(program))throw new Error('Choose VEX or RoboCup before submitting.');

  let rawItems;
  try{rawItems=JSON.parse(String(p.items||'[]'));}
  catch(e){throw new Error('The request item list is invalid.');}
  if(!Array.isArray(rawItems)||!rawItems.length)throw new Error('Add at least one part before submitting.');
  if(rawItems.length>50)throw new Error('A request can contain at most 50 different parts.');

  const quantities={};
  rawItems.forEach(item=>{
    const partId=String(item&&item.partId||'').trim().toUpperCase();
    const quantity=Number(item&&item.quantity);
    if(!/^P-\d{6}$/.test(partId))throw new Error('One of the requested PartIDs is invalid.');
    if(!Number.isFinite(quantity)||quantity<=0||Math.floor(quantity)!==quantity||quantity>999)
      throw new Error('Requested quantities must be whole numbers from 1 to 999.');
    if(Object.prototype.hasOwnProperty.call(quantities,partId))throw new Error('The same part cannot appear twice in one request.');
    quantities[partId]=quantity;
  });

  const lock=LockService.getScriptLock();
  lock.waitLock(30000);
  try{
    const ss=SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const parts=ss.getSheetByName(CONFIG.PARTS_SHEET);
    const requests=ss.getSheetByName(REQUESTS_SHEET_NAME);
    const inventory=ss.getSheetByName(CONFIG.INVENTORY_SHEET);
    if(!parts||!requests||!inventory)throw new Error('Required request sheets are missing.');

    const partValues=parts.getDataRange().getValues();
    if(!partValues.length)throw new Error('PARTS sheet is empty.');
    const ph=headerMap_(partValues[0]);
    ['PartID','Program','Active','ProductStatus','Unavailable','NotInventoried'].forEach(name=>{
      if(ph[name]===undefined)throw new Error('PARTS '+name+' column is missing.');
    });

    const allowed={};
    for(let r=1;r<partValues.length;r++){
      const row=partValues[r];
      const partId=String(row[ph.PartID]||'').trim().toUpperCase();
      if(!Object.prototype.hasOwnProperty.call(quantities,partId))continue;
      const rowProgram=String(row[ph.Program]||'').trim().toUpperCase();
      const active=row[ph.Active]===true||String(row[ph.Active]).toUpperCase()==='TRUE';
      const retired=String(row[ph.ProductStatus]||'').trim().toUpperCase()==='RETIRED';
      const unavailable=row[ph.Unavailable]===true||String(row[ph.Unavailable]).toUpperCase()==='TRUE';
      const notInventoried=row[ph.NotInventoried]===true||String(row[ph.NotInventoried]).toUpperCase()==='TRUE';
      if(rowProgram!==program)throw new Error(partId+' is not in the selected program.');
      if(!active)throw new Error(partId+' is inactive and cannot be requested.');
      if(retired)throw new Error(partId+' is retired and cannot be requested.');
      if(unavailable)throw new Error(partId+' is marked unavailable and cannot be requested.');
      if(notInventoried)throw new Error(partId+' is reference-only and cannot be requested.');
      allowed[partId]=true;
    }

    Object.keys(quantities).forEach(partId=>{
      if(!allowed[partId])throw new Error(partId+' was not found in the active requestable catalog.');
    });

    const requestHeaders=requests.getRange(1,1,1,requests.getLastColumn()).getValues()[0];
    const rh=headerMap_(requestHeaders);
    ['RequestID','RequestedAt','RequesterEmail','StudentID','Program','PartID','RequestedQty','Status','Notes'].forEach(name=>{
      if(rh[name]===undefined)throw new Error('REQUESTS '+name+' column is missing.');
    });

    const balances=balancesFromValues_(inventory.getDataRange().getValues());
    const requestId=makeRequestId_();
    const now=new Date();
    const rows=Object.keys(quantities).sort().map(partId=>{
      const row=new Array(requestHeaders.length).fill('');
      const available=Number((balances[partId]&&balances[partId].available)||0);
      const requested=quantities[partId];
      row[rh.RequestID]=requestId;
      row[rh.RequestedAt]=now;
      row[rh.RequesterEmail]=user.email;
      row[rh.StudentID]=user.studentId||'';
      row[rh.Program]=program==='ROBOCUP'?'RoboCup':'VEX';
      row[rh.PartID]=partId;
      row[rh.RequestedQty]=requested;
      row[rh.Status]='SUBMITTED';
      row[rh.Notes]='Available at request: '+available+'.'+(available<requested?' Additional purchasing may be required.':'');
      return row;
    });

    const startRow=Math.max(2,requests.getLastRow()+1);
    requests.getRange(startRow,1,rows.length,requestHeaders.length).setValues(rows);
    SpreadsheetApp.flush();
    return{requestId:requestId,itemCount:rows.length};
  }finally{
    lock.releaseLock();
  }
}

function loadRequestQueue_(){
  const ss=SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const requests=ss.getSheetByName(REQUESTS_SHEET_NAME);
  const parts=ss.getSheetByName(CONFIG.PARTS_SHEET);
  if(!requests||!parts)throw new Error('Required request queue sheets are missing.');

  const requestValues=requests.getDataRange().getValues();
  if(!requestValues.length)return[];
  const rh=headerMap_(requestValues[0]);
  ['RequestID','RequestedAt','RequesterEmail','StudentID','Program','PartID','RequestedQty','Status','ApprovedQty','FulfilledQty','Notes'].forEach(name=>{
    if(rh[name]===undefined)throw new Error('REQUESTS '+name+' column is missing.');
  });

  const partValues=parts.getDataRange().getValues();
  const ph=partValues.length?headerMap_(partValues[0]):{};
  const partNames={};
  if(ph.PartID!==undefined&&ph.PartName!==undefined){
    for(let r=1;r<partValues.length;r++){
      const id=String(partValues[r][ph.PartID]||'').trim().toUpperCase();
      if(id)partNames[id]=String(partValues[r][ph.PartName]||'').trim();
    }
  }

  const grouped={};
  for(let r=1;r<requestValues.length;r++){
    const row=requestValues[r];
    const requestId=String(row[rh.RequestID]||'').trim();
    if(!requestId)continue;
    if(!grouped[requestId]){
      const rawDate=row[rh.RequestedAt];
      let requestedAt=rawDate instanceof Date?rawDate.getTime():new Date(rawDate||0).getTime();
      if(!Number.isFinite(requestedAt))requestedAt=0;
      grouped[requestId]={
        requestId:requestId,
        requestedAt:requestedAt,
        requesterEmail:String(row[rh.RequesterEmail]||'').trim(),
        studentId:String(row[rh.StudentID]||'').trim(),
        program:String(row[rh.Program]||'').trim(),
        statuses:{},
        items:[]
      };
    }
    const g=grouped[requestId];
    const status=String(row[rh.Status]||'').trim().toUpperCase()||'UNKNOWN';
    g.statuses[status]=true;
    const partId=String(row[rh.PartID]||'').trim().toUpperCase();
    g.items.push({
      partId:partId,
      partName:partNames[partId]||partId,
      requestedQty:Number(row[rh.RequestedQty]||0),
      approvedQty:row[rh.ApprovedQty]===''?'':Number(row[rh.ApprovedQty]||0),
      fulfilledQty:row[rh.FulfilledQty]===''?'':Number(row[rh.FulfilledQty]||0),
      notes:String(row[rh.Notes]||'').trim()
    });
  }

  return Object.keys(grouped).map(id=>{
    const g=grouped[id];
    const statuses=Object.keys(g.statuses);
    return{
      requestId:g.requestId,
      requestedAt:g.requestedAt,
      requesterEmail:g.requesterEmail,
      studentId:g.studentId,
      program:g.program,
      status:statuses.length===1?statuses[0]:'MIXED',
      items:g.items
    };
  }).sort((a,b)=>b.requestedAt-a.requestedAt).slice(0,250);
}

function requestQueuePage_(ok,user,requests,message){
  const payload={
    source:'robotics-inventory-backend',
    type:ok?'request-queue':'request-queue-error',
    ok:!!ok,
    requests:ok?requests:[],
    user:user?{email:user.email,firstName:user.firstName,lastName:user.lastName,role:user.role}:null,
    message:String(message||'')
  };
  const payloadText=JSON.stringify(JSON.stringify(payload)).replace(/</g,'\\u003c');
  const bridgeUrl=CONFIG.FRONTEND_ORIGIN+'/Inventory/request-queue-bridge.html?v=20260819-1412';
  const target=JSON.stringify(bridgeUrl).replace(/</g,'\\u003c');
  return HtmlService.createHtmlOutput('<!doctype html><html><head><meta charset="utf-8"><title>Request Queue</title></head><body><p>Loading request queue…</p><script>window.name='+payloadText+';window.location.replace('+target+');</script></body></html>');
}

function makeRequestId_(){
  const stamp=Utilities.formatDate(new Date(),CONFIG.TIME_ZONE,'yyyyMMdd-HHmmss');
  return 'REQ-'+stamp+'-'+Utilities.getUuid().slice(0,6).toUpperCase();
}

function requestReturnPage_(ok,requestId,message){
  const params=['ok='+(ok?'1':'0')];
  if(requestId)params.push('requestId='+encodeURIComponent(String(requestId)));
  if(message)params.push('message='+encodeURIComponent(String(message)));
  const url=CONFIG.FRONTEND_ORIGIN+'/Inventory/request-bridge.html?'+params.join('&');
  const target=JSON.stringify(url).replace(/</g,'\\u003c');
  return HtmlService.createHtmlOutput('<!doctype html><html><head><meta charset="utf-8"><title>Submitting request</title></head><body><p>Saving request…</p><script>window.location.replace('+target+');</script></body></html>');
}
