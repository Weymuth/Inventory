// Teacher/admin metadata editor enhancements.
// PARTS remains authoritative; local overrides keep static GitHub Pages cards
// current immediately after a successful backend edit.
(function(){
  const BACKEND='https://script.google.com/a/macros/mercersburg.edu/s/AKfycbwO-eAB-qrabGBpqbTpLWAkSUQUITiJQ3KPLIZEwjCJBN-wb8yyTgInNT-bXRbPinTA/exec';
  const pendingNames={};
  let activeNamePopup=null;

  function items(){return window.INVENTORY_DATA||[];}
  function part(partId){return items().find(function(x){return x.i===partId;});}
  function currentDetailPartId(){
    const el=document.getElementById('detailId');
    const id=String(el&&el.textContent||'').trim().toUpperCase();
    return /^P-\d{6}$/.test(id)?id:'';
  }
  function refreshDetailIf(partId){
    if(currentDetailPartId()===partId&&typeof window.refreshDetail==='function')window.refreshDetail();
  }
  function isRoboSource(x){
    if(!x)return false;
    return [x.vendor,x.v,x.source,x.src,x.supplier]
      .some(function(value){return /robosource/i.test(String(value||''));});
  }

  function normalizeProgramLinks(){
    items().forEach(function(x){if(isRoboSource(x))x.p='VEX';});
  }

  function saveNameOverride(partId,name){
    try{
      const all=JSON.parse(localStorage.getItem('roboticsInventoryNameOverrides')||'{}');
      if(name)all[partId]=name;else delete all[partId];
      localStorage.setItem('roboticsInventoryNameOverrides',JSON.stringify(all));
    }catch(e){}
  }

  function loadNameOverrides(){
    try{
      const all=JSON.parse(localStorage.getItem('roboticsInventoryNameOverrides')||'{}');
      items().forEach(function(x){if(all[x.i])x.n=all[x.i];});
    }catch(e){}
  }

  function partIdForCard(card){
    const raw=card&&card.getAttribute('onclick')||'';
    const match=raw.match(/P-\d{6}/);
    return match?match[0]:'';
  }

  function ensureStyles(){
    if(document.getElementById('inventory-admin-editor-css'))return;
    const style=document.createElement('style');
    style.id='inventory-admin-editor-css';
    style.textContent='\
      .thumb{position:relative}\
      .image-update-button{position:absolute;left:5px;right:5px;bottom:5px;border:1px solid rgba(61,82,102,.4);background:rgba(255,255,255,.94);color:#0B1A2E;border-radius:6px;padding:4px 3px;font-size:8.5px;font-weight:850;cursor:pointer;line-height:1.1;box-shadow:0 1px 3px rgba(11,26,46,.10)}\
      .image-update-button:hover{background:#F5F2E9;border-color:#C9A463}\
      .detail-image{position:relative}\
      .detail-image-update{position:absolute;right:8px;bottom:8px;border:1px solid #b8c0c5;background:rgba(255,255,255,.96);color:#0B1A2E;border-radius:7px;padding:6px 9px;font-size:10px;font-weight:850;cursor:pointer;box-shadow:0 2px 7px rgba(11,26,46,.12)}\
      .detail-image-update:hover{background:#F5F2E9;border-color:#C9A463}\
      .rename-part-button{margin-top:8px;border:1px solid rgba(255,255,255,.48);background:rgba(255,255,255,.10);color:white;border-radius:7px;padding:5px 9px;font-size:10px;font-weight:800;cursor:pointer}\
      .rename-part-button:hover{background:rgba(255,255,255,.18)}';
    document.head.appendChild(style);
  }

  function promptImage(partId,event){
    if(event)event.stopPropagation();
    const x=part(partId);
    if(!x||typeof window.setPartImageUrl!=='function')return;
    const pasted=window.prompt('Paste the image web link for '+x.n+':',x.g||'');
    if(pasted==null)return;
    window.setPartImageUrl(partId,pasted,event);
  }

  function decorateWorkingImageButtons(){
    ensureStyles();
    document.querySelectorAll('.card').forEach(function(card){
      const thumb=card.querySelector('.thumb');
      if(!thumb||thumb.querySelector('.image-update-button')||thumb.querySelector('.image-link-button'))return;
      if(!thumb.querySelector('img'))return;
      const partId=partIdForCard(card);
      if(!partId)return;
      const button=document.createElement('button');
      button.type='button';
      button.className='image-update-button';
      button.textContent='Update Image';
      button.title='Replace this image link';
      button.addEventListener('click',function(event){promptImage(partId,event);});
      thumb.appendChild(button);
    });
  }

  function decorateDetailControls(){
    ensureStyles();
    const detailName=document.getElementById('detailName');
    if(detailName&&detailName.parentElement&&!detailName.parentElement.querySelector('.rename-part-button')){
      const button=document.createElement('button');
      button.type='button';
      button.className='rename-part-button';
      button.textContent='Rename Part';
      button.addEventListener('click',function(event){
        event.stopPropagation();
        const partId=currentDetailPartId();
        const x=part(partId);
        if(!x)return;
        const pasted=window.prompt('Rename this part:',x.n||'');
        if(pasted==null)return;
        window.setPartName(partId,pasted,event);
      });
      detailName.parentElement.appendChild(button);
    }

    const detailImage=document.getElementById('detailImage');
    if(detailImage&&!detailImage.querySelector('.detail-image-update')){
      const button=document.createElement('button');
      button.type='button';
      button.className='detail-image-update';
      button.textContent='Update Image';
      button.addEventListener('click',function(event){
        event.stopPropagation();
        const partId=currentDetailPartId();
        if(partId)promptImage(partId,event);
      });
      detailImage.appendChild(button);
    }
  }

  function closeNamePopup(){
    if(!activeNamePopup)return;
    try{if(!activeNamePopup.closed)activeNamePopup.close();}catch(e){}
    activeNamePopup=null;
  }

  window.setPartName=function(partId,value,event){
    if(event)event.stopPropagation();
    const x=part(partId);
    if(!x)return;
    const name=String(value||'').replace(/\s+/g,' ').trim();
    if(name.length<2){
      if(typeof window.showToast==='function')window.showToast('Part name must contain at least 2 characters.');
      return;
    }
    if(name.length>160){
      if(typeof window.showToast==='function')window.showToast('Part name is too long.');
      return;
    }

    const oldName=x.n||'';
    const u=new URL(BACKEND);
    u.searchParams.set('action','partname');
    u.searchParams.set('partId',partId);
    u.searchParams.set('partName',name);
    const popup=window.open(u.toString(),'partNameAction','popup,width=470,height=300,resizable=yes,scrollbars=yes');
    if(!popup){
      if(typeof window.showToast==='function')window.showToast('Popup blocked. Allow popups for this site to rename parts.');
      return;
    }

    activeNamePopup=popup;
    pendingNames[partId]=oldName;
    x.n=name;
    saveNameOverride(partId,name);
    if(typeof window.render==='function')window.render();
    refreshDetailIf(partId);
  };

  function applyNameBridge(data){
    if(!data||data.source!=='robotics-inventory-backend')return;
    if(data.type==='part-name-updated'&&data.ok){
      const x=part(data.partId);
      if(x&&data.partName){x.n=data.partName;saveNameOverride(data.partId,data.partName);}
      delete pendingNames[data.partId];
      if(typeof window.render==='function')window.render();
      refreshDetailIf(data.partId);
      if(typeof window.showToast==='function')window.showToast('Part name saved');
      closeNamePopup();
    }else if(data.type==='part-name-error'){
      const x=part(data.partId);
      if(x&&Object.prototype.hasOwnProperty.call(pendingNames,data.partId)){
        x.n=pendingNames[data.partId]||x.n;
        saveNameOverride(data.partId,x.n);
      }
      delete pendingNames[data.partId];
      if(typeof window.render==='function')window.render();
      refreshDetailIf(data.partId);
      if(typeof window.showToast==='function')window.showToast(data.message||'Part rename failed.');
      closeNamePopup();
    }
  }

  window.addEventListener('storage',function(e){
    if(e.key!=='roboticsInventoryBridgeEvent'||!e.newValue)return;
    try{const envelope=JSON.parse(e.newValue);applyNameBridge(envelope.payload||null);}catch(err){}
  });
  try{
    const channel=new BroadcastChannel('robotics-inventory');
    channel.onmessage=function(e){applyNameBridge(e.data||null);};
  }catch(err){}

  window.addEventListener('load',function(){
    normalizeProgramLinks();
    loadNameOverrides();
    if(typeof window.render==='function'){
      const priorRender=window.render;
      window.render=function(){
        normalizeProgramLinks();
        const result=priorRender.apply(this,arguments);
        decorateWorkingImageButtons();
        decorateDetailControls();
        return result;
      };
      window.render();
    }else{
      decorateWorkingImageButtons();
      decorateDetailControls();
    }

    const grid=document.getElementById('grid');
    if(grid){
      const observer=new MutationObserver(function(){decorateWorkingImageButtons();});
      observer.observe(grid,{childList:true,subtree:true});
    }

    const modal=document.getElementById('modal');
    if(modal){
      const observer=new MutationObserver(function(){decorateDetailControls();});
      observer.observe(modal,{childList:true,subtree:true});
    }
  });
})();
