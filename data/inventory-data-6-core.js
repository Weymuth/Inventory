window.INVENTORY_DATA=(window.INVENTORY_DATA||[]).concat([
{"i":"P-000195","p":"VEX","n":"V5 Robot Battery Li-Ion","m":"VEX Robotics","x":"276-4811","c":"Power","g":"https://content.vexrobotics.com/docs/276-4811-v5-battery.jpg","r":0,"a":0,"t":0,"o":0,"z":0,"w":"","s":"Current","iv":0},
{"i":"P-000196","p":"VEX","n":"V5 Robot Battery Charger","m":"VEX Robotics","x":"276-4812","c":"Power","g":"https://content.vexrobotics.com/docs/276-4812-v5-charger.jpg","r":0,"a":0,"t":0,"o":0,"z":0,"w":"","s":"Current","iv":0},
{"i":"P-000197","p":"VEX","n":"V5 Smart Cable Stock (50 ft)","m":"VEX Robotics","x":"276-4815","c":"Electronics","g":"https://content.vexrobotics.com/docs/276-4815-v5-cable-stock.jpg","r":0,"a":0,"t":0,"o":0,"z":0,"w":"","s":"Current","iv":0},
{"i":"P-000198","p":"VEX","n":"V5 Smart Cable Crimping Tool","m":"VEX Robotics","x":"276-4832","c":"Tools","g":"https://content.vexrobotics.com/docs/276-4832-crimp-tool.jpg","r":0,"a":0,"t":0,"o":0,"z":0,"w":"","s":"Current","iv":0},
{"i":"P-000199","p":"VEX","n":"V5 System Bundle","m":"VEX Robotics","x":"276-7000","c":"Kits","g":"https://content.vexrobotics.com/docs/276-7000-v5-system-bundle.jpg","r":0,"a":0,"t":0,"o":0,"z":0,"w":"","s":"Current","iv":0},
{"i":"P-000200","p":"VEX","n":"V5 Competition Starter Kit","m":"VEX Robotics","x":"276-7010","c":"Kits","g":"https://content.vexrobotics.com/docs/276-7010-v5-starter-kit.jpg","r":0,"a":0,"t":0,"o":0,"z":0,"w":"","s":"Current","iv":0},
{"i":"P-000201","p":"VEX","n":"V5 Competition Super Kit","m":"VEX Robotics","x":"276-7020","c":"Kits","g":"https://content.vexrobotics.com/docs/276-7020-v5-super-kit.jpg","r":0,"a":0,"t":0,"o":0,"z":0,"w":"","s":"Current","iv":0},
{"i":"P-000202","p":"VEX","n":"VEX ARM Cortex-based Microcontroller","m":"VEX Robotics","x":"276-2194","c":"Electronics","g":"https://content.vexrobotics.com/docs/276-2194-cortex.jpg","r":0,"a":0,"t":0,"o":0,"z":0,"w":"","s":"Retired","iv":0},
{"i":"P-000203","p":"VEX","n":"VEXnet Joystick","m":"VEX Robotics","x":"276-2192","c":"Electronics","g":"https://content.vexrobotics.com/docs/276-2192-joystick.jpg","r":0,"a":0,"t":0,"o":0,"z":0,"w":"","s":"Retired","iv":0},
{"i":"P-000204","p":"VEX","n":"VEXnet Key 2.0","m":"VEX Robotics","x":"276-3245","c":"Electronics","g":"https://content.vexrobotics.com/docs/276-3245-vexnet-key.jpg","r":0,"a":0,"t":0,"o":0,"z":0,"w":"","s":"Retired","iv":0},
{"i":"P-000205","p":"VEX","n":"VEX 2-Wire Motor 393","m":"VEX Robotics","x":"276-2181","c":"Motion","g":"https://content.vexrobotics.com/docs/276-2181-motor-393.jpg","r":0,"a":0,"t":0,"o":0,"z":0,"w":"","s":"Retired","iv":0},
{"i":"P-000206","p":"VEX","n":"Motor Controller 29","m":"VEX Robotics","x":"276-2193","c":"Electronics","g":"https://content.vexrobotics.com/docs/276-2193-mc29.jpg","r":0,"a":0,"t":0,"o":0,"z":0,"w":"","s":"Retired","iv":0},
{"i":"P-000207","p":"VEX","n":"VEX Robot Battery NiMH 7.2V 3000mAh","m":"VEX Robotics","x":"276-2177","c":"Power","g":"https://content.vexrobotics.com/docs/276-2177-battery.jpg","r":0,"a":0,"t":0,"o":0,"z":0,"w":"","s":"Retired","iv":0}
]);

// Frontend persistence + popup-control shim. The main page defines setPartFlag/
// saveLocalFlags later. Wrap quick-status saves after load so the selected state
// survives refresh immediately, while Apps Script remains authoritative.
window.addEventListener('load',function(){
  let activeFlagPopup=null;
  const pendingStudyGuide={};

  function closeFlagPopup(){
    if(!activeFlagPopup)return;
    try{if(!activeFlagPopup.closed)activeFlagPopup.close();}catch(e){}
    activeFlagPopup=null;
  }

  if(typeof window.setPartFlag==='function'&&typeof window.saveLocalFlags==='function'){
    const originalSetPartFlag=window.setPartFlag;
    window.setPartFlag=function(partId,flag,enabled,event){
      const nativeOpen=window.open;
      let opened=null;
      window.open=function(){
        opened=nativeOpen.apply(window,arguments);
        return opened;
      };
      try{
        originalSetPartFlag.call(this,partId,flag,enabled,event);
      }finally{
        window.open=nativeOpen;
      }
      if(opened)activeFlagPopup=opened;
      const x=(window.INVENTORY_DATA||[]).find(function(item){return item.i===partId;});
      if(x)window.saveLocalFlags(x);
    };
  }

  function isStudyGuide(x){return !!(x&&(x.sg===true||x.sg===1));}

  function saveStudyGuide(x){
    if(!x)return;
    try{
      const all=JSON.parse(localStorage.getItem('roboticsInventoryStudyGuide')||'{}');
      all[x.i]=isStudyGuide(x);
      localStorage.setItem('roboticsInventoryStudyGuide',JSON.stringify(all));
    }catch(e){}
  }

  function loadStudyGuide(){
    try{
      const all=JSON.parse(localStorage.getItem('roboticsInventoryStudyGuide')||'{}');
      (window.INVENTORY_DATA||[]).forEach(function(x){
        if(Object.prototype.hasOwnProperty.call(all,x.i))x.sg=all[x.i]?1:0;
        else if(x.sg!==1&&x.sg!==true)x.sg=0;
      });
    }catch(e){
      (window.INVENTORY_DATA||[]).forEach(function(x){if(x.sg!==1&&x.sg!==true)x.sg=0;});
    }
  }

  function ensureStudyGuideAssets(){
    if(!document.getElementById('bootstrap-icons-css')){
      const link=document.createElement('link');
      link.id='bootstrap-icons-css';
      link.rel='stylesheet';
      link.href='https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css';
      document.head.appendChild(link);
    }
    if(!document.getElementById('study-guide-book-css')){
      const style=document.createElement('style');
      style.id='study-guide-book-css';
      style.textContent='.card .body{position:relative;padding-right:42px}.study-book{position:absolute;top:8px;right:9px;width:30px;height:30px;border:0;background:transparent;padding:0;display:flex;align-items:center;justify-content:center;color:#b42318;font-size:22px;cursor:pointer;border-radius:6px;transition:transform .12s ease,color .12s ease,background .12s ease}.study-book:hover{background:#f5f6f4;transform:scale(1.08)}.study-book.in-guide{color:#1f7a46}.study-book:focus-visible{outline:2px solid #0B1A2E;outline-offset:2px}';
      document.head.appendChild(style);
    }
  }

  function decorateStudyBooks(){
    ensureStudyGuideAssets();
    document.querySelectorAll('.card').forEach(function(card){
      const body=card.querySelector('.body');
      if(!body||body.querySelector('.study-book'))return;
      const raw=card.getAttribute('onclick')||'';
      const match=raw.match(/P-\d{6}/);
      if(!match)return;
      const partId=match[0];
      const x=(window.INVENTORY_DATA||[]).find(function(item){return item.i===partId;});
      if(!x)return;
      const enabled=isStudyGuide(x);
      const button=document.createElement('button');
      button.type='button';
      button.className='study-book'+(enabled?' in-guide':'');
      button.setAttribute('aria-pressed',enabled?'true':'false');
      button.setAttribute('aria-label',enabled?'Remove from Study Guide':'Add to Study Guide');
      button.title=enabled?'Included in Study Guide — click to remove':'Not in Study Guide — click to add';
      button.innerHTML='<i class="bi bi-book-fill" aria-hidden="true"></i>';
      button.addEventListener('click',function(event){
        event.stopPropagation();
        window.setStudyGuide(partId,!isStudyGuide(x),event);
      });
      body.appendChild(button);
    });
  }

  window.setStudyGuide=function(partId,enabled,event){
    if(event)event.stopPropagation();
    const x=(window.INVENTORY_DATA||[]).find(function(item){return item.i===partId;});
    if(!x)return;
    const oldValue=isStudyGuide(x);
    const u=new URL(window.BACKEND_URL||'https://script.google.com/a/macros/mercersburg.edu/s/AKfycbwO-eAB-qrabGBpqbTpLWAkSUQUITiJQ3KPLIZEwjCJBN-wb8yyTgInNT-bXRbPinTA/exec');
    u.searchParams.set('action','partflag');
    u.searchParams.set('partId',partId);
    u.searchParams.set('flag','STUDY_GUIDE');
    u.searchParams.set('enabled',enabled?'1':'0');
    const popup=window.open(u.toString(),'partFlagAction','popup,width=430,height=260,resizable=yes,scrollbars=yes');
    if(!popup){
      if(typeof window.showToast==='function')window.showToast('Popup blocked. Allow popups for this site to save Study Guide selections.');
      return;
    }
    activeFlagPopup=popup;
    pendingStudyGuide[partId]=oldValue;
    x.sg=enabled?1:0;
    saveStudyGuide(x);
    if(typeof window.render==='function')window.render();
  };

  function applyBridgePayload(data){
    if(!data||data.source!=='robotics-inventory-backend')return;
    if(data.type==='part-flag-updated'&&data.ok){
      const x=(window.INVENTORY_DATA||[]).find(function(item){return item.i===data.partId;});
      if(x&&typeof window.setLocalFlag==='function'&&typeof window.saveLocalFlags==='function'){
        window.setLocalFlag(x,'RETIRED',!!data.flags.retired);
        window.setLocalFlag(x,'UNAVAILABLE',!!data.flags.unavailable);
        window.setLocalFlag(x,'NOT_INVENTORIED',!!data.flags.notInventoried);
        window.saveLocalFlags(x);
      }
      if(x&&data.flags&&Object.prototype.hasOwnProperty.call(data.flags,'studyGuide')){
        x.sg=data.flags.studyGuide?1:0;
        saveStudyGuide(x);
        delete pendingStudyGuide[data.partId];
      }
      if(typeof window.render==='function')window.render();
      if(window.selectedItem&&window.selectedItem.i===data.partId&&typeof window.refreshDetail==='function')window.refreshDetail();
      closeFlagPopup();
    }else if(data.type==='part-flag-error'){
      const flag=String(data.flag||'').toUpperCase().replace(/-/g,'_');
      if(flag==='STUDY_GUIDE'&&Object.prototype.hasOwnProperty.call(pendingStudyGuide,data.partId)){
        const x=(window.INVENTORY_DATA||[]).find(function(item){return item.i===data.partId;});
        if(x){x.sg=pendingStudyGuide[data.partId]?1:0;saveStudyGuide(x);}
        delete pendingStudyGuide[data.partId];
        if(typeof window.render==='function')window.render();
      }
      closeFlagPopup();
    }
  }

  window.addEventListener('storage',function(e){
    if(e.key!=='roboticsInventoryBridgeEvent'||!e.newValue)return;
    try{const envelope=JSON.parse(e.newValue);applyBridgePayload(envelope.payload||null);}catch(err){}
  });

  try{
    const channel=new BroadcastChannel('robotics-inventory');
    channel.onmessage=function(e){applyBridgePayload(e.data||null);};
  }catch(err){}

  loadStudyGuide();
  if(typeof window.render==='function'){
    const originalRender=window.render;
    window.render=function(){
      const result=originalRender.apply(this,arguments);
      decorateStudyBooks();
      return result;
    };
  }
  decorateStudyBooks();
});

// Missing/broken image editor. A teacher/admin only pastes the URL; the backend
// validates it and writes PARTS.ImageURL. Local overrides keep the new image
// visible immediately while the static catalog snapshot catches up later.
window.addEventListener('load',function(){
  const pendingImages={};
  let activeImagePopup=null;

  function normalizeImageInput(value){
    let text=String(value||'').trim();
    const m=text.match(/^=IMAGE\(\s*["'](.+?)["']\s*\)$/i);
    if(m)text=String(m[1]||'').trim();
    return text;
  }

  function saveImageOverride(partId,url){
    try{
      const all=JSON.parse(localStorage.getItem('roboticsInventoryImageOverrides')||'{}');
      if(url)all[partId]=url;else delete all[partId];
      localStorage.setItem('roboticsInventoryImageOverrides',JSON.stringify(all));
    }catch(e){}
  }

  function loadImageOverrides(){
    try{
      const all=JSON.parse(localStorage.getItem('roboticsInventoryImageOverrides')||'{}');
      (window.INVENTORY_DATA||[]).forEach(function(x){if(all[x.i])x.g=all[x.i];});
    }catch(e){}
  }

  function ensureImageEditorAssets(){
    if(document.getElementById('image-link-editor-css'))return;
    const style=document.createElement('style');
    style.id='image-link-editor-css';
    style.textContent='.thumb.image-missing{flex-direction:column;gap:7px;padding:7px}.thumb.image-missing .placeholder{padding:0}.image-link-button{border:1px solid #b8c0c5;background:white;color:#0B1A2E;border-radius:6px;padding:5px 7px;font-size:9px;font-weight:850;cursor:pointer;line-height:1.15}.image-link-button:hover{background:#F5F2E9;border-color:#C9A463}';
    document.head.appendChild(style);
  }

  function partIdForCard(card){
    const raw=card&&card.getAttribute('onclick')||'';
    const match=raw.match(/P-\d{6}/);
    return match?match[0]:'';
  }

  function decorateImageButtons(){
    ensureImageEditorAssets();
    document.querySelectorAll('.card').forEach(function(card){
      const thumb=card.querySelector('.thumb');
      if(!thumb||thumb.querySelector('.image-link-button')||!thumb.querySelector('.placeholder'))return;
      const partId=partIdForCard(card);
      if(!partId)return;
      const x=(window.INVENTORY_DATA||[]).find(function(item){return item.i===partId;});
      if(!x)return;
      thumb.classList.add('image-missing');
      const button=document.createElement('button');
      button.type='button';
      button.className='image-link-button';
      button.textContent=x.g?'Fix Image Link':'Add Image Link';
      button.addEventListener('click',function(event){
        event.stopPropagation();
        const pasted=window.prompt('Paste the image web link for '+x.n+':',x.g||'');
        if(pasted==null)return;
        window.setPartImageUrl(partId,pasted,event);
      });
      thumb.appendChild(button);
    });
  }

  window.setPartImageUrl=function(partId,value,event){
    if(event)event.stopPropagation();
    const x=(window.INVENTORY_DATA||[]).find(function(item){return item.i===partId;});
    if(!x)return;
    const imageUrl=normalizeImageInput(value);
    if(!/^https?:\/\/\S+$/i.test(imageUrl)){
      if(typeof window.showToast==='function')window.showToast('Paste a complete http:// or https:// image link.');
      return;
    }

    const oldUrl=x.g||'';
    const u=new URL(window.BACKEND_URL||'https://script.google.com/a/macros/mercersburg.edu/s/AKfycbwO-eAB-qrabGBpqbTpLWAkSUQUITiJQ3KPLIZEwjCJBN-wb8yyTgInNT-bXRbPinTA/exec');
    u.searchParams.set('action','imageurl');
    u.searchParams.set('partId',partId);
    u.searchParams.set('imageUrl',imageUrl);
    const popup=window.open(u.toString(),'partImageAction','popup,width=470,height=300,resizable=yes,scrollbars=yes');
    if(!popup){
      if(typeof window.showToast==='function')window.showToast('Popup blocked. Allow popups for this site to save image links.');
      return;
    }

    activeImagePopup=popup;
    pendingImages[partId]=oldUrl;
    x.g=imageUrl;
    saveImageOverride(partId,imageUrl);
    if(typeof window.render==='function')window.render();
  };

  function closeImagePopup(){
    if(!activeImagePopup)return;
    try{if(!activeImagePopup.closed)activeImagePopup.close();}catch(e){}
    activeImagePopup=null;
  }

  function applyImageBridge(data){
    if(!data||data.source!=='robotics-inventory-backend')return;
    if(data.type==='part-image-updated'&&data.ok){
      const x=(window.INVENTORY_DATA||[]).find(function(item){return item.i===data.partId;});
      if(x&&data.imageUrl){x.g=data.imageUrl;saveImageOverride(data.partId,data.imageUrl);}
      delete pendingImages[data.partId];
      if(typeof window.render==='function')window.render();
      if(typeof window.showToast==='function')window.showToast('Image link saved');
      closeImagePopup();
    }else if(data.type==='part-image-error'){
      const x=(window.INVENTORY_DATA||[]).find(function(item){return item.i===data.partId;});
      if(x&&Object.prototype.hasOwnProperty.call(pendingImages,data.partId)){
        x.g=pendingImages[data.partId]||'';
        saveImageOverride(data.partId,x.g);
      }
      delete pendingImages[data.partId];
      if(typeof window.render==='function')window.render();
      if(typeof window.showToast==='function')window.showToast(data.message||'Image link update failed.');
      closeImagePopup();
    }
  }

  window.addEventListener('storage',function(e){
    if(e.key!=='roboticsInventoryBridgeEvent'||!e.newValue)return;
    try{const envelope=JSON.parse(e.newValue);applyImageBridge(envelope.payload||null);}catch(err){}
  });

  try{
    const imageChannel=new BroadcastChannel('robotics-inventory');
    imageChannel.onmessage=function(e){applyImageBridge(e.data||null);};
  }catch(err){}

  loadImageOverrides();
  if(typeof window.render==='function'){
    const priorRender=window.render;
    window.render=function(){
      const result=priorRender.apply(this,arguments);
      decorateImageButtons();
      return result;
    };
    window.render();
  }else{
    decorateImageButtons();
  }

  const grid=document.getElementById('grid');
  if(grid){
    const observer=new MutationObserver(function(){decorateImageButtons();});
    observer.observe(grid,{childList:true,subtree:true});
  }
});

// Manufacturer-confirmed image corrections. This runs synchronously because
// inventory-data-6.js is the final catalog chunk loaded before index.html renders.
(function(){
  const imageFixes={
    38:'https://cdn-shop.adafruit.com/970x728/5302-07.jpg',
    39:'https://cdn-shop.adafruit.com/970x728/2124-09.jpg',
    42:'https://cdn-shop.adafruit.com/970x728/3500-10.jpg',
    43:'https://cdn-shop.adafruit.com/970x728/3316-09.jpg',
    44:'https://cdn-shop.adafruit.com/970x728/1552-06.jpg',
    45:'https://cdn-shop.adafruit.com/970x728/1083-07.jpg',
    47:'https://cdn-shop.adafruit.com/970x728/935-11.jpg',
    48:'https://cdn-shop.adafruit.com/970x728/2010-10.jpg',
    49:'https://cdn-shop.adafruit.com/970x728/1501-13.jpg',
    50:'https://cdn-shop.adafruit.com/970x728/2000-11.jpg',
    51:'https://cdn-shop.adafruit.com/970x728/1334-04.jpg',
    52:'https://cdn-shop.adafruit.com/970x728/3317-06.jpg',
    53:'https://cdn-shop.adafruit.com/970x728/2345-13.jpg',
    54:'https://cdn-shop.adafruit.com/970x728/4416-05.jpg',
    56:'https://cdn-shop.adafruit.com/970x728/1770-06.jpg',
    57:'https://cdn-shop.adafruit.com/970x728/805-03.jpg',
    60:'https://cdn-shop.adafruit.com/970x728/2717-05.jpg',
    61:'https://cdn-shop.adafruit.com/970x728/4464-04.jpg',
    63:'https://cdn-shop.adafruit.com/970x728/358-11.jpg',
    64:'https://cdn-shop.adafruit.com/970x728/641-05.jpg',
    65:'https://cdn-shop.adafruit.com/970x728/640-06.jpg',
    94:'https://www.sparkfun.com/media/catalog/product/cache/f3020b7489dcfc4d1d147cf4dad07b7f/1/1/11697-01b.jpg',
    95:'https://www.sparkfun.com/media/catalog/product/cache/f3020b7489dcfc4d1d147cf4dad07b7f/1/3/13231-01.jpg',
    96:'https://www.sparkfun.com/media/catalog/product/cache/f3020b7489dcfc4d1d147cf4dad07b7f/1/3/13711-01.jpg',
    100:'https://www.sparkfun.com/media/catalog/product/cache/f3020b7489dcfc4d1d147cf4dad07b7f/0/9/09267-01.jpg',
    101:'https://www.sparkfun.com/media/catalog/product/cache/f3020b7489dcfc4d1d147cf4dad07b7f/0/8/08463-01.jpg',
    102:'https://www.sparkfun.com/media/catalog/product/cache/f3020b7489dcfc4d1d147cf4dad07b7f/1/2/12049-LilyPad_Arduino_USB_-_ATmega32U4_Board-01.jpg',
    104:'https://www.sparkfun.com/media/catalog/product/cache/f3020b7489dcfc4d1d147cf4dad07b7f/1/1/11113-01b.jpg',
    106:'https://www.sparkfun.com/media/catalog/product/cache/f3020b7489dcfc4d1d147cf4dad07b7f/0/9/09716-SparkFun_FTDI_Basic_Breakout_-_5V-01.jpg',
    107:'https://www.sparkfun.com/media/catalog/product/cache/f3020b7489dcfc4d1d147cf4dad07b7f/1/5/15123-SparkFun_RedBoard_Qwiic-01a.jpg',
    108:'https://www.sparkfun.com/media/catalog/product/cache/f3020b7489dcfc4d1d147cf4dad07b7f/1/3/13907-01.jpg',
    109:'https://www.sparkfun.com/media/catalog/product/cache/f3020b7489dcfc4d1d147cf4dad07b7f/1/3/13716-01.jpg',
    124:'https://www.sparkfun.com/media/catalog/product/cache/f3020b7489dcfc4d1d147cf4dad07b7f/1/4/14844-SparkFun_IR_Array_Breakout_-_55_Degree_FOV__MLX90640__Qwiic_-01.jpg',
    149:'https://www.sparkfun.com/media/catalog/product/cache/f3020b7489dcfc4d1d147cf4dad07b7f/1/1/11678-01.jpg'
  };
  (window.INVENTORY_DATA||[]).forEach(function(x){
    const n=Number(String(x.i||'').replace(/^P-/,''));
    if(imageFixes[n])x.g=imageFixes[n];
  });
})();
