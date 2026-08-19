// Reliable card-detail opening.
// Owns non-control card clicks at document capture level so later card controls
// cannot break the detail window. It intentionally does not depend on the
// legacy inline openDetail() implementation.
window.addEventListener('load',function(){
  function inventoryItems(){return window.INVENTORY_DATA||[];}

  function partIdForCard(card){
    const raw=String(card&&card.getAttribute('onclick')||'');
    const match=raw.match(/P-\d{6}/);
    return match?match[0]:'';
  }

  function isRetired(x){
    return x&&(x.ret===true||x.ret===1||String(x.s||'').toUpperCase()==='RETIRED');
  }
  function isUnavailable(x){return !!(x&&(x.ua===true||x.ua===1));}
  function inventoryTotal(x){
    return Number(x&&x.a||0)+Number(x&&x.t||0)+Number(x&&x.o||0)+Number(x&&x.z||0);
  }
  function isNotInventoried(x){
    if(!x)return false;
    if(x.ni===true||x.ni===1)return true;
    if(x.ni===false||x.ni===0)return false;
    if(x.iv===0)return true;
    if(x.iv===1)return false;
    return x.p==='VEX'&&inventoryTotal(x)===0&&!x.w;
  }
  function statusSummarySafe(x){
    const values=[];
    if(isRetired(x))values.push('Retired');
    if(isUnavailable(x))values.push('Unavailable');
    if(isNotInventoried(x))values.push('Not inventoried');
    return values.length?values.join(' · '):'No quick-status flags';
  }

  function setText(id,value){
    const el=document.getElementById(id);
    if(el)el.textContent=value==null?'':String(value);
  }

  function openDetailSafe(partId){
    const x=inventoryItems().find(function(item){return item.i===partId;});
    if(!x)return;

    // Keep the original page-level selectedItem in sync for inventory actions.
    try{selectedItem=x;}catch(e){}
    try{window.selectedItem=x;}catch(e){}

    setText('detailProgram',x.p||'');
    setText('detailName',x.n||'');
    setText('detailId',x.i||'');
    setText('detailManufacturer',x.m||'Not listed');
    setText('detailPartNumber',x.x||'Not listed');
    setText('detailCategory',x.c||'Not categorized');
    setText('detailInventoryStatus',statusSummarySafe(x));
    setText('detailReview',x.r?'Needs review':'No review flag');
    setText('detailAvailable',Number(x.a||0));
    setText('detailStorage',Number(x.t||0));
    setText('detailChecked',Number(x.o||0));
    setText('detailUnclassified',Number(x.z||0));

    const detailImage=document.getElementById('detailImage');
    if(detailImage){
      detailImage.innerHTML='';
      if(x.g){
        const img=document.createElement('img');
        img.src=x.g;
        img.alt='';
        detailImage.appendChild(img);
      }else{
        const placeholder=document.createElement('div');
        placeholder.className='placeholder';
        placeholder.textContent='No image available';
        detailImage.appendChild(placeholder);
      }
    }

    const unresolved=document.getElementById('detailUnresolved');
    if(unresolved){
      unresolved.style.display=x.w?'block':'none';
      unresolved.textContent=x.w?'Unresolved source count: '+x.w:'';
    }

    const toStorage=document.getElementById('toStorageBtn');
    const toAvailable=document.getElementById('toAvailableBtn');
    const storageAvailable=document.getElementById('storageAvailableBtn');
    if(toStorage)toStorage.disabled=Number(x.z||0)<=0;
    if(toAvailable)toAvailable.disabled=Number(x.z||0)<=0;
    if(storageAvailable)storageAvailable.disabled=Number(x.t||0)<=0;

    const modal=document.getElementById('modal');
    if(modal)modal.classList.add('open');
    document.body.style.overflow='hidden';

    // Let enhancement scripts add Rename/Delete/Update Image after the modal
    // fields have been populated.
    setTimeout(function(){
      try{
        if(typeof window.decorateDetailControls==='function')window.decorateDetailControls();
      }catch(e){}
    },0);
  }

  // Replace the legacy global for inline handlers and other callers.
  window.openDetail=openDetailSafe;

  // Capture before the card's legacy inline onclick. Controls intentionally keep
  // their own behavior and do not open the detail window.
  document.addEventListener('click',function(event){
    const target=event.target;
    if(!target||typeof target.closest!=='function')return;
    const card=target.closest('#grid .card');
    if(!card)return;
    if(target.closest('button,input,label,a,select,textarea,.quick-flags'))return;

    const partId=partIdForCard(card);
    if(!partId)return;

    event.preventDefault();
    event.stopPropagation();
    openDetailSafe(partId);
  },true);
});
