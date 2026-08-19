const REQUESTS_SHEET_NAME='REQUESTS';

function doPost(e){
  try{
    const p=(e&&e.parameter)||{};
    const action=String(p.action||'').trim().toLowerCase();
    if(action!=='requestparts')throw new Error('Unknown backend action.');

    const user=requireInventoryUser_();
    const result=submitPartsRequest_(user,p);
    return autoReturnPage_('Request submitted',buildFrontendUrl_({
      bridge:'inventory-updated',
      ok:'1',
      partId:'REQUEST',
      transactionId:result.requestId
    }));
  }catch(err){
    return autoReturnPage_('Request error',buildFrontendUrl_({
      bridge:'inventory-error',
      ok:'0',
      message:safeError_(err)
    }));
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
    quantities[partId]=(quantities[partId]||0)+quantity;
    if(quantities[partId]>999)throw new Error('A requested quantity cannot exceed 999.');
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
    ['PartID','Program','Active','ProductStatus','Unavailable'].forEach(name=>{
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
      if(rowProgram!==program)throw new Error(partId+' is not in the selected program.');
      if(!active||retired||unavailable)throw new Error(partId+' is not currently requestable.');
      allowed[partId]=true;
    }

    Object.keys(quantities).forEach(partId=>{
      if(!allowed[partId])throw new Error(partId+' was not found in the active parts catalog.');
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

    const startRow=requests.getLastRow()+1;
    requests.getRange(startRow,1,rows.length,requestHeaders.length).setValues(rows);
    SpreadsheetApp.flush();
    return{requestId:requestId,itemCount:rows.length};
  }finally{
    lock.releaseLock();
  }
}

function makeRequestId_(){
  const stamp=Utilities.formatDate(new Date(),CONFIG.TIME_ZONE,'yyyyMMdd-HHmmss');
  return 'REQ-'+stamp+'-'+Utilities.getUuid().slice(0,6).toUpperCase();
}
