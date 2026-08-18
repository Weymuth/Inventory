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

// Load the authoritative image map synchronously before index.html renders cards.
document.write('<script src="data/inventory-images.js?v=04563206a471bc8625e112c3b9f7b07b773ee28c"><\\/script>');
