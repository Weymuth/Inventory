const CONFIG = Object.freeze({
  SPREADSHEET_ID: '1qgV-9SOsLiF6lWj1-Ah2jCujwF7Dk_TSoA8X4nu92h0',
  FRONTEND_ORIGIN: 'https://weymuth.github.io',
  USERS_SHEET: 'USERS',
  INVENTORY_SHEET: 'INVENTORY',
  TRANSACTIONS_SHEET: 'TRANSACTIONS',
  TIME_ZONE: 'America/New_York'
});

function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || 'status').toLowerCase();

    if (action === 'status') {
      const user = requireInventoryUser_();
      return simplePage_('Inventory backend online', 'Signed in as ' + user.firstName + ' ' + user.lastName + ' (' + user.role + ').');
    }

    if (action === 'bootstrap') {
      const user = requireInventoryUser_();
      return postMessageAndClose_({
        source: 'robotics-inventory-backend',
        type: 'bootstrap',
        ok: true,
        user: publicUser_(user),
        balances: getAllBalances_()
      });
    }

    if (action === 'move') {
      const user = requireTeacherOrAdmin_();
      const request = normalizeMoveRequest_(e.parameter);
      const current = getPartBalances_(request.partId);
      const sourceKey = stateKey_(request.fromState);
      const available = Number(current[sourceKey] || 0);
      if (available < request.quantity) {
        throw new Error('Only ' + available + ' units are currently in ' + request.fromState + '.');
      }
      const nonce = issueNonce_(user.email, request);
      return confirmationPage_(user, request, nonce, available);
    }

    throw new Error('Unknown backend action.');
  } catch (err) {
    return simplePage_('Inventory backend error', safeError_(err));
  }
}

function doPost(e) {
  try {
    const user = requireTeacherOrAdmin_();
    const request = normalizeMoveRequest_(e.parameter);
    verifyNonce_(user.email, request, String(e.parameter.nonce || ''));
    const result = moveInventoryState_(user, request);

    return postMessageAndClose_({
      source: 'robotics-inventory-backend',
      type: 'inventory-updated',
      ok: true,
      partId: request.partId,
      balances: result.balances,
      transactionId: result.transactionId
    });
  } catch (err) {
    return postMessageAndClose_({
      source: 'robotics-inventory-backend',
      type: 'inventory-error',
      ok: false,
      message: safeError_(err)
    });
  }
}

function normalizeMoveRequest_(p) {
  const partId = String(p.partId || '').trim().toUpperCase();
  const fromState = String(p.fromState || '').trim().toUpperCase();
  const toState = String(p.toState || '').trim().toUpperCase();
  const quantity = Number(p.quantity || 0);

  if (!/^P-\d{6}$/.test(partId)) throw new Error('Invalid PartID.');
  if (!['UNCLASSIFIED', 'STORAGE', 'AVAILABLE'].includes(fromState)) throw new Error('Invalid source state.');
  if (!['STORAGE', 'AVAILABLE'].includes(toState)) throw new Error('Invalid destination state.');
  if (fromState === toState) throw new Error('Source and destination states must be different.');
  if (!Number.isFinite(quantity) || quantity <= 0 || Math.floor(quantity) !== quantity) throw new Error('Quantity must be a positive whole number.');

  return { partId: partId, fromState: fromState, toState: toState, quantity: quantity };
}

function stateKey_(state) {
  return {
    AVAILABLE: 'available',
    STORAGE: 'storage',
    CHECKED_OUT: 'checkedOut',
    UNCLASSIFIED: 'unclassified',
    REPAIR: 'repair',
    RETIRED: 'retired'
  }[state];
}

function issueNonce_(email, request) {
  const nonce = Utilities.getUuid();
  CacheService.getScriptCache().put('move:' + nonce, JSON.stringify({ email: email, request: request }), 600);
  return nonce;
}

function verifyNonce_(email, request, nonce) {
  if (!nonce) throw new Error('Confirmation token is missing or expired.');
  const cache = CacheService.getScriptCache();
  const key = 'move:' + nonce;
  const stored = cache.get(key);
  cache.remove(key);
  if (!stored) throw new Error('Confirmation token is missing or expired.');
  const payload = JSON.parse(stored);
  if (payload.email !== email || JSON.stringify(payload.request) !== JSON.stringify(request)) {
    throw new Error('Confirmation token does not match this inventory change.');
  }
}

function confirmationPage_(user, request, nonce, available) {
  const title = request.fromState === 'UNCLASSIFIED' ? 'Classify inventory' : 'Move inventory';
  const body = `
    <div class="card">
      <div class="eyebrow">Robotics Inventory</div>
      <h1>${escapeHtml_(title)}</h1>
      <p>You are signed in as <strong>${escapeHtml_(user.firstName + ' ' + user.lastName)}</strong> (${escapeHtml_(user.role)}).</p>
      <dl>
        <dt>Part</dt><dd>${escapeHtml_(request.partId)}</dd>
        <dt>Quantity</dt><dd>${request.quantity}</dd>
        <dt>From</dt><dd>${escapeHtml_(request.fromState)}</dd>
        <dt>To</dt><dd>${escapeHtml_(request.toState)}</dd>
        <dt>Current source quantity</dt><dd>${available}</dd>
      </dl>
      <p class="note">This first migration step changes inventory state only. Physical room/cabinet/bin assignment will be added next.</p>
      <form method="post">
        <input type="hidden" name="partId" value="${escapeAttr_(request.partId)}">
        <input type="hidden" name="fromState" value="${escapeAttr_(request.fromState)}">
        <input type="hidden" name="toState" value="${escapeAttr_(request.toState)}">
        <input type="hidden" name="quantity" value="${request.quantity}">
        <input type="hidden" name="nonce" value="${escapeAttr_(nonce)}">
        <button type="submit">Confirm change</button>
      </form>
    </div>`;
  return page_(title, body);
}

function postMessageAndClose_(payload) {
  const json = JSON.stringify(payload).replace(/</g, '\\u003c');
  const body = `
    <div class="card"><h1>${payload.ok ? 'Done' : 'Inventory error'}</h1>
      <p>${payload.ok ? 'The inventory website will update automatically.' : escapeHtml_(payload.message || 'Unknown error')}</p>
    </div>
    <script>
      const payload = ${json};
      if (window.opener) window.opener.postMessage(payload, '${CONFIG.FRONTEND_ORIGIN}');
      setTimeout(() => window.close(), 700);
    </script>`;
  return page_(payload.ok ? 'Inventory updated' : 'Inventory error', body);
}

function simplePage_(title, message) {
  return page_(title, `<div class="card"><div class="eyebrow">Robotics Inventory</div><h1>${escapeHtml_(title)}</h1><p>${escapeHtml_(message)}</p></div>`);
}

function page_(title, body) {
  return HtmlService.createHtmlOutput(`<!doctype html><html><head><base target="_top"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml_(title)}</title><style>body{font-family:Arial,sans-serif;background:#f5f6f4;color:#17202a;margin:0;padding:28px}.card{max-width:620px;margin:auto;background:#fff;border-top:6px solid #0B1A2E;border-radius:10px;padding:24px;box-shadow:0 10px 30px rgba(11,26,46,.12)}.eyebrow{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#7B6240;font-weight:700}h1{color:#0B1A2E;margin:6px 0 18px}dl{display:grid;grid-template-columns:180px 1fr;gap:8px 14px}dt{font-weight:700;color:#3D5266}dd{margin:0}.note{background:#F5F2E9;padding:12px;border-left:4px solid #C9A463}button{background:#0B1A2E;color:#fff;border:0;border-radius:7px;padding:11px 16px;font-weight:700;cursor:pointer}</style></head><body>${body}</body></html>`);
}

function safeError_(err) {
  return String(err && err.message ? err.message : err || 'Unknown error');
}

function escapeHtml_(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function escapeAttr_(value) {
  return escapeHtml_(value);
}
