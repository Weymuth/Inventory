// Teacher/admin metadata editor enhancements.
// PARTS remains authoritative; local overrides keep static GitHub Pages cards
// current immediately after a successful backend edit.
(function(){
  const BACKEND='https://script.google.com/a/macros/mercersburg.edu/s/AKfycbwO-eAB-qrabGBpqbTpLWAkSUQUITiJQ3KPLIZEwjCJBN-wb8yyTgInNT-bXRbPinTA/exec';
  const pendingNames={};
  const pendingActive={};
  let activeNamePopup=null;
  let activeStatusPopup=null;

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
  function inventoryTotal(x){
    return Number(x&&x.a||0)+Number(x&&x.t||0)+Number(x&&x.o||0)+Number(x&&x.z||0);
  }
  function isActive(x){return !(x&&(x.active===false||x.active===0));}
  function isRoboSource(x){
    if(!x)return false;
    return [x.vendor,x.v,x.source,x.src,x.supplier]
      .some(function(value){return /robosource/i.test(String(value||''));});
  }

  // RoboSource is a purchasing/source relationship; these parts belong under
  // the VEX program button even when RoboSource itself is not the manufacturer.
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

  function saveActiveOverride(partId,active){
    try{
      const all=JSON.parse(localStorage.getItem('roboticsInventoryActiveOverrides')||'{}');
      all[partId]=!!active;
      localStorage.setItem('roboticsInventoryActiveOverrides',JSON.stringify(all));
    }catch(e){}
  }
  function loadActiveOverrides(){
    try{
      const all=JSON.parse(localStorage.getItem('roboticsInventoryActiveOverrides')||'{}');
      items().forEach(function(x){
        if(Object.prototype.hasOwnProperty.call(all,x.i))x.active=!!all[x.i];
        else if(x.active!==false&&x.active!==0)x.active=true;
      });
    }catch(e){
      items().forEach(function(x){if(x.active!==false&&x.active!==0)x.active=true;});
    }
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
      .toolbar{grid-template-columns:minmax(280px,1.5fr) auto minmax(190px,.55fr) auto!important}\
      .thumb{position:relative}\
      .image-update-button{position:absolute;left:5px;right:5px;bottom:5px;border:1px solid rgba(61,82,102,.4);background:rgba(255,255,255,.94);color:#0B1A2E;border-radius:6px;padding:4px 3px;font-size:8.5px;font-weight:850;cursor:pointer;line-height:1.1;box-shadow:0 1px 3px rgba(11,26,46,.10)}\
      .image-update-button:hover{background:#F5F2E9;border-color:#C9A463}\
      .detail-image{position:relative}\
      .detail-image-update{position:absolute;right:8px;bottom:8px;border:1px solid #b8c0c5;background:rgba(255,255,255,.96);color:#0B1A2E;border-radius:7px;padding:6px 9px;font-size:10px;font-weight:850;cursor:pointer;box-shadow:0 2px 7px rgba(11,26,46,.12)}\
      .detail-image-update:hover{background:#F5F2E9;border-color:#C9A463}\
      .rename-part-button,.delete-part-button{margin-top:8px;margin-right:6px;border:1px solid rgba(255,255,255,.48);background:rgba(255,255,255,.10);color:white;border-radius:7px;padding:5px 9px;font-size:10px;font-weight:800;cursor:pointer}\
      .rename-part-button:hover{background:rgba(255,255,255,.18)}\
      .delete-part-button{border-color:#efb8b3;background:#8f2d25}\
      .delete-part-button:hover{background:#a6382f}\
      .delete-part-button.restore{border-color:#9bd2b3;background:#1f6e46}\
      .delete-part-button.restore:hover{background:#278456}\
      .show-deleted-control{display:flex;align-items:center;gap:7px;border:1px solid #cbd1d5;border-radius:8px;padding:9px 11px;background:#fafbfa;color:#3D5266;font-size:11px;font-weight:800;white-space:nowrap;cursor:pointer}\
      .show-deleted-control input{accent-color:#0B1A2E}\
      .card.deleted-card{opacity:.72;border-color:#d7aaa6;background:#fff8f7}\
      .deleted-badge{display:inline-block;margin-top:7px;margin-left:5px;background:#fbe3e0;color:#8f2d25;border:1px solid #e8b8b2;border-radius:999px;padding:3px 7px;font-size:9px;font-weight:850}\
      @media(max-width:900px){.toolbar{grid-template-columns:1fr!important}.show-deleted-control{justify-content:center}}';
    document.head.appendChild(style);
  }

  function ensureShowDeletedControl(){
    ensureStyles();
    const toolbar=document.querySelector('.toolbar');
    if(!toolbar||document.getElementById('showDeletedCards'))return;
    const label=document.createElement('label');
    label.className='show-deleted-control';
    label.innerHTML='<input id="showDeletedCards" type="checkbox"> Show Deleted';
    const input=label.querySelector('input');
    input.checked=localStorage.getItem('roboticsInventoryShowDeleted')==='1';
    input.addEventListener('change',function(){
      try{localStorage.setItem('roboticsInventoryShowDeleted',input.checked?'1':'0');}catch(e){}
      if(typeof window.render==='function')window.render();
    });
    toolbar.appendChild(label);
  }

  function showDeletedEnabled(){
    const input=document.getElementById('showDeletedCards');
    return !!(input&&input.checked);
  }

  function filterDeletedCards(){
    const showDeleted=showDeletedEnabled();
    let visible=0;
    document.querySelectorAll('#grid .card').forEach(function(card){
      const partId=partIdForCard(card);
      const x=part(partId);
      if(!x)return;
      const active=isActive(x);
      card.classList.toggle('deleted-card',!active);
      const body=card.querySelector('.body');
      if(body){
        let badge=body.querySelector('.deleted-badge');
        if(!active&&showDeleted&&!badge){
          badge=document.createElement('span');
          badge.className='deleted-badge';
          badge.textContent='Deleted';
          body.appendChild(badge);
        }else if((active||!showDeleted)&&badge){
          badge.remove();
        }
      }
      const shouldShow=active||showDeleted;
      card.style.display=shouldShow?'':'none';
      if(shouldShow)visible++;
    });

    const activeCount=items().filter(isActive).length;
    const stat=document.getElementById('statParts');
    if(stat)stat.textContent=activeCount;

    const result=document.getElementById('resultCount');
    if(result){
      result.textContent=visible+' part'+(visible===1?'':'s')+' shown';
    }

    const grid=document.getElementById('grid');
    if(grid){
      const old=grid.querySelector('[data-delete-empty="1"]');
      if(old)old.remove();
      if(visible===0&&!grid.querySelector('.empty')){
        const empty=document.createElement('div');
        empty.className='empty';
        empty.dataset.deleteEmpty='1';
        empty.textContent=showDeleted?'No parts match those filters.':'No active parts match those filters.';
        grid.appendChild(empty);
      }
    }
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

  function updateDeleteButton(button){
    const partId=currentDetailPartId();
    const x=part(partId);
    if(!x)return;
    const active=isActive(x);
    button.textContent=active?'Delete Card':'Restore Card';
    button.classList.toggle('restore',!active);
    button.title=active?'Hide this card without erasing its history':'Restore this card to the active catalog';
  }

  function decorateDetailControls(){
    ensureStyles();
    const detailName=document.getElementById('detailName');
    if(detailName&&detailName.parentElement){
      if(!detailName.parentElement.querySelector('.rename-part-button')){
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
      let deleteButton=detailName.parentElement.querySelector('.delete-part-button');
      if(!deleteButton){
        deleteButton=document.createElement('button');
        deleteButton.type='button';
        deleteButton.className='delete-part-button';
        deleteButton.addEventListener('click',function(event){
          event.stopPropagation();
          const partId=currentDetailPartId();
          const x=part(partId);
          if(!x)return;
          if(isActive(x)){
            const total=inventoryTotal(x);
            if(total>0){
              if(typeof window.showToast==='function')window.showToast('This card has '+total+' inventory unit'+(total===1?'':'s')+'. Move or adjust that inventory before deleting it.');
              return;
            }
            if(!window.confirm('Delete "'+x.n+'"?\n\nThis does not erase the part or its history. It sets Active = FALSE and hides the card. You can restore it with Show Deleted.'))return;
            window.setPartActive(partId,false,event);
          }else{
            window.setPartActive(partId,true,event);
          }
        });
        detailName.parentElement.appendChild(deleteButton);
      }
      updateDeleteButton(deleteButton);
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
  function closeStatusPopup(){
    if(!activeStatusPopup)return;
    try{if(!activeStatusPopup.closed)activeStatusPopup.close();}catch(e){}
    activeStatusPopup=null;
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

  window.setPartActive=function(partId,active,event){
    if(event)event.stopPropagation();
    const x=part(partId);
    if(!x)return;
    const oldValue=isActive(x);

    const u=new URL(BACKEND);
    u.searchParams.set('action','partactive');
    u.searchParams.set('partId',partId);
    u.searchParams.set('active',active?'1':'0');
    const popup=window.open(u.toString(),'partActiveAction','popup,width=470,height=300,resizable=yes,scrollbars=yes');
    if(!popup){
      if(typeof window.showToast==='function')window.showToast('Popup blocked. Allow popups for this site to delete or restore cards.');
      return;
    }

    activeStatusPopup=popup;
    pendingActive[partId]=oldValue;
    x.active=!!active;
    saveActiveOverride(partId,active);
    if(!active&&typeof window.closeDetail==='function')window.closeDetail();
    if(typeof window.render==='function')window.render();
    refreshDetailIf(partId);
  };

  function applyMetadataBridge(data){
    if(!data||data.source!=='robotics-inventory-backend')return;

    if(data.type==='part-name-updated'&&data.ok){
      const x=part(data.partId);
      if(x&&data.partName){x.n=data.partName;saveNameOverride(data.partId,data.partName);}
      delete pendingNames[data.partId];
      if(typeof window.render==='function')window.render();
      refreshDetailIf(data.partId);
      if(typeof window.showToast==='function')window.showToast('Part name saved');
      closeNamePopup();
      return;
    }

    if(data.type==='part-name-error'){
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
      return;
    }

    if(data.type==='part-active-updated'&&data.ok){
      const x=part(data.partId);
      if(x){
        x.active=!!data.active;
        saveActiveOverride(data.partId,!!data.active);
      }
      delete pendingActive[data.partId];
      if(typeof window.render==='function')window.render();
      refreshDetailIf(data.partId);
      if(typeof window.showToast==='function')window.showToast(data.active?'Card restored':'Card deleted');
      closeStatusPopup();
      return;
    }

    if(data.type==='part-active-error'){
      const x=part(data.partId);
      if(x&&Object.prototype.hasOwnProperty.call(pendingActive,data.partId)){
        x.active=!!pendingActive[data.partId];
        saveActiveOverride(data.partId,x.active);
      }
      delete pendingActive[data.partId];
      if(typeof window.render==='function')window.render();
      refreshDetailIf(data.partId);
      if(typeof window.showToast==='function')window.showToast(data.message||'Delete/restore failed.');
      closeStatusPopup();
    }
  }

  window.addEventListener('storage',function(e){
    if(e.key!=='roboticsInventoryBridgeEvent'||!e.newValue)return;
    try{const envelope=JSON.parse(e.newValue);applyMetadataBridge(envelope.payload||null);}catch(err){}
  });
  try{
    const channel=new BroadcastChannel('robotics-inventory');
    channel.onmessage=function(e){applyMetadataBridge(e.data||null);};
  }catch(err){}

  window.addEventListener('load',function(){
    normalizeProgramLinks();
    loadNameOverrides();
    loadActiveOverrides();
    ensureShowDeletedControl();

    if(typeof window.render==='function'){
      const priorRender=window.render;
      window.render=function(){
        normalizeProgramLinks();
        const result=priorRender.apply(this,arguments);
        decorateWorkingImageButtons();
        decorateDetailControls();
        filterDeletedCards();
        return result;
      };
      window.render();
    }else{
      decorateWorkingImageButtons();
      decorateDetailControls();
      filterDeletedCards();
    }

    const grid=document.getElementById('grid');
    if(grid){
      const observer=new MutationObserver(function(){
        decorateWorkingImageButtons();
        filterDeletedCards();
      });
      observer.observe(grid,{childList:true,subtree:true});
    }

    const modal=document.getElementById('modal');
    if(modal){
      const observer=new MutationObserver(function(){decorateDetailControls();});
      observer.observe(modal,{childList:true,subtree:true});
    }
  });
})();
