document.write('<script src="data/inventory-data-7.js?v=20260819-0842"><\/script>');
// Student catalog visibility fix.
// The first student build hid VEX parts when the static snapshot had zero units,
// which made real catalog records (including V5 motors) disappear from search.
// This helper runs only on student.html and re-renders the student card grid so
// catalog visibility is separate from orderability.
(function(){
  if(!/\/student\.html$/i.test(location.pathname))return;

  function $id(id){return document.getElementById(id);}
  function items(){return window.INVENTORY_DATA||[];}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function bool(v){return v===true||v===1||String(v).toUpperCase()==='TRUE';}
  function isRetired(x){return bool(x&&x.ret)||String(x&&x.s||'').toUpperCase()==='RETIRED';}
  function isUnavailable(x){return bool(x&&x.ua);}
  function isActive(x){return !(x&&(x.active===false||x.active===0));}
  function isStudy(x){return bool(x&&x.sg);}
  function isNotInventoried(x){
    if(!x)return false;
    if(bool(x.ni))return true;
    if(x.ni===false||x.ni===0)return false;
    if(x.iv===0)return true;
    if(x.iv===1)return false;
    return false;
  }

  function mode(){
    var title=$id('modeTitle');
    return title&&/study/i.test(title.textContent||'')?'study':'order';
  }

  function program(){
    var active=document.querySelector('.pill.active[data-program]');
    return active?active.dataset.program:'VEX';
  }

  function query(){
    var input=$id('studentSearch');
    return String(input&&input.value||'').trim().toLowerCase();
  }

  function visibleRows(){
    var currentMode=mode();
    var currentProgram=program();
    var q=query();
    return items().filter(function(x){
      if(!isActive(x)||x.p!==currentProgram)return false;
      if(currentMode==='order'&&(isRetired(x)||isUnavailable(x)))return false;
      if(currentMode==='study'&&!isStudy(x))return false;
      if(!q)return true;
      return [x.i,x.n,x.m,x.x,x.c,x.p].some(function(v){return String(v||'').toLowerCase().includes(q);});
    });
  }

  function imageHtml(x){
    if(!x.g)return '<div class="missing">No image</div>';
    return '<img src="'+esc(x.g)+'" alt="" loading="lazy" onerror="this.parentElement.innerHTML=\'<div class=&quot;missing&quot;>Image unavailable</div>\'">';
  }

  function orderControl(x){
    var available=Number(x.a||0);
    var referenceOnly=isNotInventoried(x)&&available<=0;
    var disabled=available<=0||referenceOnly;
    var label=referenceOnly?'Reference only':(available<=0?'Out of stock':'Add');
    return '<div class="student-row">'+
      '<div class="available '+(available<=0?'zero':'')+'"><b>'+available+'</b>Available</div>'+
      '<button class="add" type="button" '+(disabled?'disabled':'')+' onclick="addDraft(\''+esc(x.i)+'\')">'+label+'</button>'+
      '</div>';
  }

  function renderFixed(){
    var grid=$id('parts');
    var count=$id('resultCount');
    if(!grid||!count||!$id('workspace')||!$id('workspace').classList.contains('open'))return;

    var currentMode=mode();
    var rows=visibleRows();
    count.textContent=rows.length+' part'+(rows.length===1?'':'s');

    if(!rows.length){
      grid.innerHTML='<div class="empty">'+(currentMode==='study'?'No Study Guide parts match this program and search.':'No catalog parts match this program and search.')+'</div>';
      return;
    }

    grid.innerHTML=rows.map(function(x){
      var right=currentMode==='order'?orderControl(x):'<span class="study-chip">Instructor selected</span>';
      return '<article class="student-part">'+
        '<div class="student-thumb">'+imageHtml(x)+'</div>'+
        '<div class="student-body">'+
          '<div class="program-tag">'+esc(x.p)+'</div>'+
          '<div class="student-name">'+esc(x.n)+'</div>'+
          '<div class="student-meta">'+esc(x.m||'Manufacturer not listed')+(x.x?' · '+esc(x.x):'')+(x.c?'<br>'+esc(x.c):'')+'</div>'+
          right+
        '</div></article>';
    }).join('');
  }

  window.addEventListener('load',function(){
    // Preserve the existing authenticated workspace flow; just correct the grid
    // after it opens or its filters change.
    var originalOpen=window.openWorkspace;
    if(typeof originalOpen==='function'){
      window.openWorkspace=function(nextMode){
        originalOpen(nextMode);
        setTimeout(renderFixed,0);
      };
    }

    var search=$id('studentSearch');
    if(search)search.addEventListener('input',function(){setTimeout(renderFixed,0);});
    document.querySelectorAll('.pill[data-program]').forEach(function(button){
      button.addEventListener('click',function(){setTimeout(renderFixed,0);});
    });

    // If the page was already in a workspace when this helper initialized.
    setTimeout(renderFixed,0);
  });
})();
