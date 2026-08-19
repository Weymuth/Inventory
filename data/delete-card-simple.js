// Simple soft-delete UI for inventory cards.
// No MutationObserver and no card-click interception: the original page keeps
// ownership of card opening and rendering.
window.addEventListener('load', function () {
  const BACKEND = 'https://script.google.com/a/macros/mercersburg.edu/s/AKfycbwO-eAB-qrabGBpqbTpLWAkSUQUITiJQ3KPLIZEwjCJBN-wb8yyTgInNT-bXRbPinTA/exec';
  const STORAGE_KEY = 'roboticsInventoryActiveOverrides';
  const SHOW_KEY = 'roboticsInventoryShowDeleted';
  const pending = {};
  let activePopup = null;

  function inventoryItems() { return window.INVENTORY_DATA || []; }
  function part(id) { return inventoryItems().find(function (x) { return x.i === id; }); }
  function isActive(x) { return !(x && (x.active === false || x.active === 0)); }
  function inventoryTotal(x) {
    return Number(x && x.a || 0) + Number(x && x.t || 0) + Number(x && x.o || 0) + Number(x && x.z || 0);
  }
  function currentDetailPartId() {
    const el = document.getElementById('detailId');
    const id = String(el && el.textContent || '').trim().toUpperCase();
    return /^P-\d{6}$/.test(id) ? id : '';
  }
  function saveOverride(id, active) {
    try {
      const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      all[id] = !!active;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch (e) {}
  }
  function loadOverrides() {
    try {
      const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      inventoryItems().forEach(function (x) {
        if (Object.prototype.hasOwnProperty.call(all, x.i)) x.active = !!all[x.i];
        else if (x.active !== false && x.active !== 0) x.active = true;
      });
    } catch (e) {}
  }
  function showDeleted() {
    const box = document.getElementById('showDeletedCards');
    return !!(box && box.checked);
  }
  function partIdForCard(card) {
    const raw = String(card && card.getAttribute('onclick') || '');
    const match = raw.match(/P-\d{6}/);
    return match ? match[0] : '';
  }
  function applyVisibility() {
    const show = showDeleted();
    let visible = 0;
    document.querySelectorAll('#grid .card').forEach(function (card) {
      const x = part(partIdForCard(card));
      if (!x) return;
      const keep = isActive(x) || show;
      card.style.display = keep ? '' : 'none';
      card.style.opacity = isActive(x) ? '' : '.62';
      if (keep) visible++;
    });
    const result = document.getElementById('resultCount');
    if (result) result.textContent = visible + ' part' + (visible === 1 ? '' : 's') + ' shown';
    const stat = document.getElementById('statParts');
    if (stat) stat.textContent = inventoryItems().filter(isActive).length;
  }
  function ensureStyles() {
    if (document.getElementById('delete-card-simple-css')) return;
    const style = document.createElement('style');
    style.id = 'delete-card-simple-css';
    style.textContent = '.delete-card-button{margin-top:8px;margin-left:8px;border:1px solid #efb8b3;background:#8f2d25;color:#fff;border-radius:7px;padding:5px 9px;font-size:10px;font-weight:800;cursor:pointer}.delete-card-button.restore{border-color:#9bd2b3;background:#1f6e46}.show-deleted-simple{display:flex;align-items:center;gap:7px;border:1px solid #cbd1d5;border-radius:8px;padding:9px 11px;background:#fafbfa;color:#3D5266;font-size:11px;font-weight:800;white-space:nowrap}.show-deleted-simple input{accent-color:#0B1A2E}';
    document.head.appendChild(style);
  }
  function ensureShowDeleted() {
    if (document.getElementById('showDeletedCards')) return;
    const toolbar = document.querySelector('.toolbar');
    if (!toolbar) return;
    const label = document.createElement('label');
    label.className = 'show-deleted-simple';
    label.innerHTML = '<input id="showDeletedCards" type="checkbox"> Show Deleted';
    const input = label.querySelector('input');
    try { input.checked = localStorage.getItem(SHOW_KEY) === '1'; } catch (e) {}
    input.addEventListener('change', function () {
      try { localStorage.setItem(SHOW_KEY, input.checked ? '1' : '0'); } catch (e) {}
      if (typeof window.render === 'function') window.render();
    });
    toolbar.appendChild(label);
  }
  function updateDeleteButton() {
    const button = document.getElementById('deleteCardButton');
    if (!button) return;
    const x = part(currentDetailPartId());
    if (!x) return;
    button.textContent = isActive(x) ? 'Delete Card' : 'Restore Card';
    button.classList.toggle('restore', !isActive(x));
  }
  function ensureDeleteButton() {
    const name = document.getElementById('detailName');
    if (!name || !name.parentElement) return;
    let button = document.getElementById('deleteCardButton');
    if (!button) {
      button = document.createElement('button');
      button.id = 'deleteCardButton';
      button.type = 'button';
      button.className = 'delete-card-button';
      button.addEventListener('click', function (event) {
        event.stopPropagation();
        const id = currentDetailPartId();
        const x = part(id);
        if (!x) return;
        const nextActive = !isActive(x);
        if (!nextActive) {
          const total = inventoryTotal(x);
          if (total > 0) {
            if (typeof window.showToast === 'function') window.showToast('This card still has ' + total + ' inventory unit' + (total === 1 ? '' : 's') + '. Move or adjust that inventory before deleting it.');
            return;
          }
          if (!window.confirm('Delete "' + x.n + '"?\n\nThis hides the card by setting Active = FALSE. It does not erase its PartID or history.')) return;
        }
        const url = new URL(BACKEND);
        url.searchParams.set('action', 'partactive');
        url.searchParams.set('partId', id);
        url.searchParams.set('active', nextActive ? '1' : '0');
        const popup = window.open(url.toString(), 'partActiveAction', 'popup,width=470,height=300,resizable=yes,scrollbars=yes');
        if (!popup) {
          if (typeof window.showToast === 'function') window.showToast('Popup blocked. Allow popups to delete or restore cards.');
          return;
        }
        activePopup = popup;
        pending[id] = isActive(x);
        x.active = nextActive;
        saveOverride(id, nextActive);
        if (!nextActive && typeof window.closeDetail === 'function') window.closeDetail();
        if (typeof window.render === 'function') window.render();
        updateDeleteButton();
      });
      name.parentElement.appendChild(button);
    }
    updateDeleteButton();
  }
  function closePopup() {
    if (!activePopup) return;
    try { if (!activePopup.closed) activePopup.close(); } catch (e) {}
    activePopup = null;
  }
  function applyBridge(data) {
    if (!data || data.source !== 'robotics-inventory-backend') return;
    if (data.type === 'part-active-updated' && data.ok) {
      const x = part(data.partId);
      if (x) {
        x.active = !!data.active;
        saveOverride(data.partId, !!data.active);
      }
      delete pending[data.partId];
      if (typeof window.render === 'function') window.render();
      if (typeof window.showToast === 'function') window.showToast(data.active ? 'Card restored' : 'Card deleted');
      closePopup();
    } else if (data.type === 'part-active-error') {
      const x = part(data.partId);
      if (x && Object.prototype.hasOwnProperty.call(pending, data.partId)) {
        x.active = !!pending[data.partId];
        saveOverride(data.partId, x.active);
      }
      delete pending[data.partId];
      if (typeof window.render === 'function') window.render();
      if (typeof window.showToast === 'function') window.showToast(data.message || 'Delete/restore failed.');
      closePopup();
    }
  }

  window.addEventListener('storage', function (e) {
    if (e.key !== 'roboticsInventoryBridgeEvent' || !e.newValue) return;
    try { const envelope = JSON.parse(e.newValue); applyBridge(envelope.payload || null); } catch (err) {}
  });
  try {
    const channel = new BroadcastChannel('robotics-inventory');
    channel.onmessage = function (e) { applyBridge(e.data || null); };
  } catch (e) {}

  ensureStyles();
  loadOverrides();
  ensureShowDeleted();

  if (typeof window.render === 'function') {
    const originalRender = window.render;
    window.render = function () {
      const result = originalRender.apply(this, arguments);
      applyVisibility();
      return result;
    };
  }

  if (typeof window.openDetail === 'function') {
    const originalOpenDetail = window.openDetail;
    window.openDetail = function () {
      const result = originalOpenDetail.apply(this, arguments);
      ensureDeleteButton();
      return result;
    };
  }

  applyVisibility();
});
