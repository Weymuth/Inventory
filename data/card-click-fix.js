// Reliable card-detail click binding.
// Keeps buttons, toggles, links, and form controls independent while ensuring
// the rest of every card opens its detail window even if an inline handler is
// disrupted by later UI enhancements.
window.addEventListener('load',function(){
  function partIdForCard(card){
    const raw=String(card&&card.getAttribute('onclick')||'');
    const match=raw.match(/P-\d{6}/);
    return match?match[0]:'';
  }

  function bindCards(){
    document.querySelectorAll('#grid .card').forEach(function(card){
      if(card.dataset.detailClickBound==='1')return;
      const partId=partIdForCard(card);
      if(!partId)return;
      card.dataset.detailClickBound='1';
      card.addEventListener('click',function(event){
        if(event.defaultPrevented)return;
        if(event.target&&event.target.closest('button,input,label,a,select,textarea,.quick-flags'))return;
        if(typeof window.openDetail==='function'){
          window.openDetail(partId);
        }
      });
    });
  }

  bindCards();
  const grid=document.getElementById('grid');
  if(grid){
    const observer=new MutationObserver(bindCards);
    observer.observe(grid,{childList:true,subtree:true});
  }
});
