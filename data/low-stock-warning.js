(function(){
  if(!/\/Inventory\/(?:index\.html)?$/i.test(location.pathname)&&!/\/Inventory\/$/i.test(location.pathname))return;
  const THRESHOLD=4;
  const bool=v=>v===true||v===1||String(v).toUpperCase()==='TRUE';
  const active=x=>!(x&&(x.active===false||x.active===0));
  const retired=x=>bool(x&&x.ret)||String(x&&x.s||'').toUpperCase()==='RETIRED';
  const unavailable=x=>bool(x&&x.ua);
  const notInventoried=x=>bool(x&&x.ni)||x&&x.iv===0;
  const total=x=>Number(x&&x.a||0)+Number(x&&x.t||0)+Number(x&&x.o||0)+Number(x&&x.z||0);
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function installStyle(){
    if(document.getElementById('vex-low-stock-css'))return;
    const style=document.createElement('style');style.id='vex-low-stock-css';
    style.textContent='.low-stock-warning{display:none;background:#fff4d7;border:1px solid #ead39d;border-left:5px solid #C9A463;border-radius:8px;padding:12px 15px;margin-bottom:14px;color:#6f4b12}.low-stock-warning.open{display:block}.low-stock-warning strong{color:#0B1A2E}.low-stock-items{margin-top:6px;font-size:12px;line-height:1.45}.low-stock-pill{display:inline-block;background:white;border:1px solid #e3c87f;border-radius:999px;padding:3px 7px;margin:3px 4px 0 0;font-weight:750}';
    document.head.appendChild(style);
  }

  function ensureBox(){
    let box=document.getElementById('vexLowStockWarning');
    if(box)return box;
    box=document.createElement('div');box.id='vexLowStockWarning';box.className='low-stock-warning';
    const status=document.querySelector('.status');
    if(status&&status.parentNode)status.parentNode.insertBefore(box,status.nextSibling);
    else{const main=document.querySelector('main');if(main)main.insertBefore(box,main.firstChild);}
    return box;
  }

  function lowStockRows(){
    return (window.INVENTORY_DATA||[]).filter(x=>x&&x.p==='VEX'&&active(x)&&!retired(x)&&!unavailable(x)&&!notInventoried(x)&&total(x)<THRESHOLD)
      .sort((a,b)=>total(a)-total(b)||String(a.n||'').localeCompare(String(b.n||'')));
  }

  function render(){
    installStyle();
    const box=ensureBox();if(!box)return;
    const rows=lowStockRows();
    if(!rows.length){box.classList.remove('open');box.innerHTML='';return;}
    const shown=rows.slice(0,12);
    box.innerHTML='<strong>VEX low-stock warning:</strong> '+rows.length+' inventoried part'+(rows.length===1?' is':'s are')+' below '+THRESHOLD+' total units.'+
      '<div class="low-stock-items">'+shown.map(x=>'<span class="low-stock-pill">'+esc(x.n||x.i)+' · '+total(x)+'</span>').join('')+(rows.length>shown.length?' <span>+'+(rows.length-shown.length)+' more</span>':'')+'</div>';
    box.classList.add('open');
  }

  window.addEventListener('load',function(){
    render();
    if(typeof window.render==='function'){
      const prior=window.render;
      window.render=function(){const result=prior.apply(this,arguments);render();return result;};
    }
    window.addEventListener('storage',function(e){if(e.key==='roboticsInventoryBridgeEvent')setTimeout(render,0);});
    try{const channel=new BroadcastChannel('robotics-inventory');channel.onmessage=function(){setTimeout(render,0);};}catch(e){}
  });
})();
