function getAllBalances_() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.INVENTORY_SHEET);
  if (!sheet) throw new Error('INVENTORY sheet not found.');
  return balancesFromValues_(sheet.getDataRange().getValues());
}

function getPartBalances_(partId) {
  const all = getAllBalances_();
  return all[partId] || emptyBalance_();
}

function balancesFromValues_(values) {
  const result = {};
  if (!values.length) return result;
  const h = headerMap_(values[0]);

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const partId = String(row[h.PartID] || '').trim();
    if (!partId) continue;

    if (!result[partId]) result[partId] = emptyBalance_();
    const state = String(row[h.State] || '').trim().toUpperCase();
    const qtyRaw = row[h.Quantity];
    const qty = typeof qtyRaw === 'number' && isFinite(qtyRaw) ? qtyRaw : Number(qtyRaw || 0);
    const sourceText = String(row[h.SourceQuantityText] || '').trim();
    const sourceTextIsExactNumber = /^\d+(?:\.\d+)?$/.test(sourceText);

    if (sourceText && !qty && !sourceTextIsExactNumber) result[partId].unresolved.push(sourceText);
    if (!qty) continue;

    switch (state) {
      case 'AVAILABLE': result[partId].available += qty; break;
      case 'STORAGE': result[partId].storage += qty; break;
      case 'CHECKED_OUT': result[partId].checkedOut += qty; break;
      case 'UNCLASSIFIED': result[partId].unclassified += qty; break;
      case 'REPAIR': result[partId].repair += qty; break;
      case 'RETIRED': result[partId].retired += qty; break;
    }
  }
  return result;
}

function emptyBalance_() {
  return {
    available: 0,
    storage: 0,
    checkedOut: 0,
    unclassified: 0,
    repair: 0,
    retired: 0,
    unresolved: []
  };
}

function moveInventoryState_(user, request) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const inventory = ss.getSheetByName(CONFIG.INVENTORY_SHEET);
    const transactions = ss.getSheetByName(CONFIG.TRANSACTIONS_SHEET);
    if (!inventory || !transactions) throw new Error('Required inventory sheets are missing.');

    const values = inventory.getDataRange().getValues();
    const h = headerMap_(values[0]);
    const sourceRows = [];
    let sourceTotal = 0;

    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      if (String(row[h.PartID]).trim() !== request.partId) continue;
      if (String(row[h.State]).trim().toUpperCase() !== request.fromState) continue;
      if (String(row[h.LocationID] || '').trim() !== '') continue;
      if (String(row[h.HolderID] || '').trim() !== '') continue;

      const qty = Number(row[h.Quantity] || 0);
      if (qty > 0) {
        sourceRows.push({ rowIndex: r + 1, qty: qty });
        sourceTotal += qty;
      }
    }

    if (sourceTotal < request.quantity) {
      throw new Error('Only ' + sourceTotal + ' units are available in ' + request.fromState + '.');
    }

    let remaining = request.quantity;
    for (const source of sourceRows) {
      if (remaining <= 0) break;
      const take = Math.min(source.qty, remaining);
      inventory.getRange(source.rowIndex, h.Quantity + 1).setValue(source.qty - take);
      remaining -= take;
    }

    let destinationRow = 0;
    let destinationQty = 0;
    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      if (String(row[h.PartID]).trim() !== request.partId) continue;
      if (String(row[h.State]).trim().toUpperCase() !== request.toState) continue;
      if (String(row[h.LocationID] || '').trim() !== '') continue;
      if (String(row[h.HolderID] || '').trim() !== '') continue;
      destinationRow = r + 1;
      destinationQty = Number(row[h.Quantity] || 0);
      break;
    }

    if (destinationRow) {
      inventory.getRange(destinationRow, h.Quantity + 1).setValue(destinationQty + request.quantity);
      if (h.NeedsReview !== undefined) inventory.getRange(destinationRow, h.NeedsReview + 1).setValue(true);
    } else {
      const newRow = new Array(values[0].length).fill('');
      newRow[h.InventoryID] = nextInventoryId_(values, h.InventoryID);
      newRow[h.PartID] = request.partId;
      newRow[h.State] = request.toState;
      newRow[h.LocationID] = '';
      newRow[h.HolderID] = '';
      newRow[h.Quantity] = request.quantity;
      if (h.Notes !== undefined) newRow[h.Notes] = 'State classified via web app; physical location still needs assignment.';
      if (h.NeedsReview !== undefined) newRow[h.NeedsReview] = true;

      const firstOpenRow = findFirstOpenInventoryRow_(values, h);
      inventory.getRange(firstOpenRow, 1, 1, newRow.length).setValues([newRow]);
    }

    const transactionId = appendTransferTransaction_(transactions, user, request, sourceTotal, sourceTotal - request.quantity);
    SpreadsheetApp.flush();

    return {
      transactionId: transactionId,
      balances: getPartBalances_(request.partId)
    };
  } finally {
    lock.releaseLock();
  }
}

function findFirstOpenInventoryRow_(values, h) {
  for (let r = 1; r < values.length; r++) {
    const inventoryId = String(values[r][h.InventoryID] || '').trim();
    const partId = String(values[r][h.PartID] || '').trim();
    if (!inventoryId && !partId) return r + 1;
  }
  return values.length + 1;
}

function nextInventoryId_(values, idIndex) {
  let max = 0;
  for (let r = 1; r < values.length; r++) {
    const match = String(values[r][idIndex] || '').match(/^INV-(\d+)$/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return 'INV-' + String(max + 1).padStart(6, '0');
}

function appendTransferTransaction_(sheet, user, request, beforeQty, afterQty) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const h = headerMap_(headers);
  const row = new Array(headers.length).fill('');
  const transactionId = makeTransactionId_();

  row[h.TransactionID] = transactionId;
  row[h.Timestamp] = new Date();
  row[h.UserEmail] = user.email;
  row[h.StudentID] = user.studentId || '';
  row[h.PartID] = request.partId;
  row[h.Action] = 'TRANSFER';
  row[h.Quantity] = request.quantity;
  row[h.FromState] = request.fromState;
  row[h.ToState] = request.toState;
  row[h.FromLocationID] = '';
  row[h.ToLocationID] = '';
  row[h.BeforeQty] = beforeQty;
  row[h.AfterQty] = afterQty;
  row[h.Source] = 'WEB';
  row[h.Reference] = request.fromState === 'UNCLASSIFIED' ? 'MIGRATION' : 'STATE_TRANSFER';
  row[h.Notes] = 'State-only transfer. Physical location assignment is still pending.';
  sheet.appendRow(row);
  return transactionId;
}

function makeTransactionId_() {
  const stamp = Utilities.formatDate(new Date(), CONFIG.TIME_ZONE, 'yyyyMMdd-HHmmss');
  return 'TX-' + stamp + '-' + Utilities.getUuid().slice(0, 6).toUpperCase();
}
