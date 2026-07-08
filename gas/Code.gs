/**
 * Main Apps Script backend for Family Expense Dashboard.
 *
 * Storage model:
 * - Settings spreadsheet: members, categories, payment_methods, recurring rules, year_files.
 * - Yearly spreadsheets: monthly transaction tabs named MM-YYYY.
 *
 * Rollback:
 * - action=setStorageMode&mode=legacy writes future monthly transactions to the legacy/settings file.
 * - action=setStorageMode&mode=yearly re-enables year-file writes.
 * - No rollback action deletes yearly files or old tabs.
 */

const FEX_FALLBACK_SETTINGS_SHEET_ID = '1zv-5EH5b08fKpkfrwqOxLcGjStfWE5t-hSn-8s7LWYI';
const FEX_SYSTEM_SETTINGS_SHEET = 'system_settings';
const FEX_YEAR_FILES_SHEET = 'year_files';
const FEX_MEMBERS_SHEET = 'members';
const FEX_CATEGORIES_SHEET = 'categories';
const FEX_PAYMENTS_SHEET = 'payment_methods';
const FEX_TRANSACTIONS_SHEET = 'transactions';
const FEX_SHARED_OWNER = 'ร่วมกัน';

const FEX_SYSTEM_SETTINGS_HEADERS = ['key', 'value', 'updated_at'];
const FEX_YEAR_FILES_HEADERS = ['year', 'spreadsheet_id', 'file_name', 'active', 'created_at', 'updated_at', 'note'];
const FEX_MEMBER_HEADERS = ['id', 'name', 'aliases', 'active', 'order'];
const FEX_CATEGORY_HEADERS = ['id', 'name', 'icon', 'active', 'order'];
const FEX_PAYMENT_HEADERS = ['id', 'type', 'name', 'last4', 'owner', 'active', 'order'];
const FEX_LEGACY_TRANSACTION_HEADERS = ['date', 'name', 'category', 'type', 'amount', 'payer', 'payment_id', 'note', 'created_at'];
const FEX_SETTLEMENT_HEADERS = ['month', 'from', 'to', 'amount', 'status', 'settled_at'];
const FEX_TRANSACTION_HEADERS = ['date', 'name', 'category', 'type', 'amount', 'payer', 'payment_id', 'note', 'to', 'created_at'];

function doGet(e) {
  return fexJson_(handleLiffAction((e && e.parameter) || {}));
}

function doPost(e) {
  let body = {};
  try {
    body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
  } catch (err) {
    body = {};
  }
  return fexJson_(handleLiffAction(Object.assign({}, (e && e.parameter) || {}, body)));
}

function handleLiffAction(b) {
  if (typeof handleRecurringLiffAction_ === 'function') {
    const recurringResult = handleRecurringLiffAction_(b);
    if (recurringResult) return recurringResult;
  }

  const action = String((b && b.action) || '');
  try {
    if (action === 'getStorageStatus') return fexGetStorageStatus_();
    if (action === 'setStorageMode') return fexSetStorageMode_(b.mode);
    if (action === 'enableYearlyStorage') return fexSetStorageMode_('yearly');
    if (action === 'rollbackToLegacyStorage') return fexSetStorageMode_('legacy');
    if (action === 'ensureYearFile') return fexEnsureYearFileAction_(b.year);

    if (action === 'getCategories') return { status: 'ok', data: fexActiveCategories_() };
    if (action === 'getMembers') return { status: 'ok', data: fexActiveMembers_() };
    if (action === 'getPayments') return { status: 'ok', data: fexActivePayments_() };

    if (action === 'addCategory') return fexAddCategory_(b);
    if (action === 'editCategory') return fexEditReference_(FEX_CATEGORIES_SHEET, FEX_CATEGORY_HEADERS, b.id, { name: b.name, icon: b.icon || '📌' });
    if (action === 'removeCategory') return fexDeactivateReference_(FEX_CATEGORIES_SHEET, FEX_CATEGORY_HEADERS, b.id);
    if (action === 'reorderCategories') return fexReorder_(FEX_CATEGORIES_SHEET, FEX_CATEGORY_HEADERS, b.orders);

    if (action === 'addPayment') return fexAddPayment_(b);
    if (action === 'editPayment') return fexEditReference_(FEX_PAYMENTS_SHEET, FEX_PAYMENT_HEADERS, b.id, {
      type: b.type, name: b.name, last4: b.last4 || '', owner: b.owner || FEX_SHARED_OWNER
    });
    if (action === 'removePayment') return fexDeactivateReference_(FEX_PAYMENTS_SHEET, FEX_PAYMENT_HEADERS, b.id);
    if (action === 'reorderPayments') return fexReorder_(FEX_PAYMENTS_SHEET, FEX_PAYMENT_HEADERS, b.orders);

    if (action === 'addMember') return fexAddMember_(b);
    if (action === 'editMember') return fexEditReference_(FEX_MEMBERS_SHEET, FEX_MEMBER_HEADERS, b.id, { name: b.name });
    if (action === 'removeMember') return fexDeactivateReference_(FEX_MEMBERS_SHEET, FEX_MEMBER_HEADERS, b.id);

    if (action === 'addTransaction') return fexAddTransaction_(b);
    if (action === 'editTransaction') return fexEditTransaction_(b);
    if (action === 'deleteTransaction') return fexDeleteTransaction_(b);
    if (action === 'markSettled') return fexMarkSettled_(b);
    if (action === 'checkDuplicate') return fexCheckDuplicate_(b);

    return { status: 'error', message: 'Unknown action: ' + action };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
}

function fexJson_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj || {}))
    .setMimeType(ContentService.MimeType.JSON);
}

function fexNow_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

function fexUuid_(prefix) {
  return prefix + '_' + Utilities.getUuid();
}

function fexSettingsSpreadsheet_() {
  if (typeof SpreadsheetApp === 'undefined') throw new Error('SpreadsheetApp is unavailable');
  if (typeof SETTINGS_SHEET_ID !== 'undefined' && SETTINGS_SHEET_ID) return SpreadsheetApp.openById(SETTINGS_SHEET_ID);
  if (typeof SPREADSHEET_ID !== 'undefined' && SPREADSHEET_ID) return SpreadsheetApp.openById(SPREADSHEET_ID);
  if (typeof SHEET_ID !== 'undefined' && SHEET_ID) return SpreadsheetApp.openById(SHEET_ID);
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SETTINGS_SHEET_ID') || props.getProperty('SHEET_ID') || FEX_FALLBACK_SETTINGS_SHEET_ID;
  return SpreadsheetApp.openById(id);
}

function fexSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return sheet;
  }
  const first = sheet.getRange(1, 1, 1, Math.max(headers.length, sheet.getLastColumn() || 1)).getValues()[0];
  if (String(first[0] || '') !== headers[0]) {
    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

function fexRows_(sheet, headerRow) {
  const startRow = headerRow || 1;
  const values = sheet.getDataRange().getValues();
  if (values.length < startRow + 1) return [];
  const headers = values[startRow - 1].map(String);
  return values.slice(startRow).map(function(row, i) {
    const obj = {};
    headers.forEach(function(h, col) { obj[h] = row[col] === undefined ? '' : row[col]; });
    return { rowNumber: startRow + i + 1, obj: obj };
  });
}

function fexObjects_(sheet, headerRow) {
  return fexRows_(sheet, headerRow).map(function(row) { return row.obj; });
}

function fexEnsureSettings_() {
  const ss = fexSettingsSpreadsheet_();
  const sheet = fexSheet_(ss, FEX_SYSTEM_SETTINGS_SHEET, FEX_SYSTEM_SETTINGS_HEADERS);
  const rows = fexRows_(sheet);
  const existing = {};
  rows.forEach(function(row) { existing[row.obj.key] = true; });
  [
    ['storage_mode', 'yearly'],
    ['yearly_file_pattern', 'Family Expense - {{year}}']
  ].forEach(function(item) {
    if (!existing[item[0]]) sheet.appendRow([item[0], item[1], fexNow_()]);
  });
  fexSheet_(ss, FEX_YEAR_FILES_SHEET, FEX_YEAR_FILES_HEADERS);
  fexSheet_(ss, FEX_MEMBERS_SHEET, FEX_MEMBER_HEADERS);
  fexSheet_(ss, FEX_CATEGORIES_SHEET, FEX_CATEGORY_HEADERS);
  fexSheet_(ss, FEX_PAYMENTS_SHEET, FEX_PAYMENT_HEADERS);
  fexSheet_(ss, FEX_TRANSACTIONS_SHEET, FEX_LEGACY_TRANSACTION_HEADERS);
  return ss;
}

function fexGetSetting_(key, fallback) {
  const ss = fexEnsureSettings_();
  const rows = fexRows_(fexSheet_(ss, FEX_SYSTEM_SETTINGS_SHEET, FEX_SYSTEM_SETTINGS_HEADERS));
  const found = rows.find(function(row) { return row.obj.key === key; });
  return found ? String(found.obj.value || '') : fallback;
}

function fexSetSetting_(key, value) {
  const ss = fexEnsureSettings_();
  const sheet = fexSheet_(ss, FEX_SYSTEM_SETTINGS_SHEET, FEX_SYSTEM_SETTINGS_HEADERS);
  const rows = fexRows_(sheet);
  const found = rows.find(function(row) { return row.obj.key === key; });
  if (found) {
    sheet.getRange(found.rowNumber, 2, 1, 2).setValues([[value, fexNow_()]]);
  } else {
    sheet.appendRow([key, value, fexNow_()]);
  }
}

function fexStorageMode_() {
  const mode = String(fexGetSetting_('storage_mode', 'yearly')).toLowerCase();
  return mode === 'legacy' ? 'legacy' : 'yearly';
}

function fexSetStorageMode_(mode) {
  const normalized = String(mode || '').toLowerCase() === 'legacy' ? 'legacy' : 'yearly';
  fexSetSetting_('storage_mode', normalized);
  fexClearCache_();
  return {
    status: 'ok',
    storage_mode: normalized,
    rollback: normalized === 'legacy',
    message: normalized === 'legacy'
      ? 'Rollback mode enabled. Future writes use the settings/legacy spreadsheet.'
      : 'Yearly storage enabled. Future writes use year files.'
  };
}

function fexGetStorageStatus_() {
  const ss = fexEnsureSettings_();
  const yearFiles = fexObjects_(fexSheet_(ss, FEX_YEAR_FILES_SHEET, FEX_YEAR_FILES_HEADERS));
  return {
    status: 'ok',
    settings_spreadsheet_id: ss.getId(),
    storage_mode: fexStorageMode_(),
    file_name_format: fexGetSetting_('yearly_file_pattern', 'Family Expense - {{year}}'),
    year_files: yearFiles
  };
}

function fexEnsureYearFileAction_(year) {
  const ss = fexEnsureYearSpreadsheet_(String(year || new Date().getFullYear()));
  return { status: 'ok', year: String(year), spreadsheet_id: ss.getId(), file_name: ss.getName() };
}

function fexYearFromDate_(date) {
  const text = String(date || '');
  const match = text.match(/^(\d{4})-/);
  return match ? match[1] : String(new Date().getFullYear());
}

function fexMonthFromDate_(date) {
  const text = String(date || '');
  const match = text.match(/^(\d{4})-(\d{2})-/);
  if (!match) throw new Error('Invalid date');
  return match[2] + '-' + match[1];
}

function fexYearFromMonth_(month) {
  const match = String(month || '').match(/^(\d{2})-(\d{4})$/);
  return match ? match[2] : String(new Date().getFullYear());
}

function fexEnsureYearSpreadsheet_(year) {
  const normalizedYear = String(year || '').trim();
  if (!normalizedYear) throw new Error('Missing year');
  const settingsSs = fexEnsureSettings_();
  const sheet = fexSheet_(settingsSs, FEX_YEAR_FILES_SHEET, FEX_YEAR_FILES_HEADERS);
  const rows = fexRows_(sheet);
  const found = rows.find(function(row) {
    return String(row.obj.year || '') === normalizedYear &&
      String(row.obj.active || 'TRUE').toUpperCase() !== 'FALSE' &&
      row.obj.spreadsheet_id;
  });
  if (found) {
    try {
      return SpreadsheetApp.openById(found.obj.spreadsheet_id);
    } catch (err) {
      found.obj.active = 'FALSE';
      found.obj.note = 'open failed: ' + err.message;
      found.obj.updated_at = fexNow_();
      sheet.getRange(found.rowNumber, 1, 1, FEX_YEAR_FILES_HEADERS.length)
        .setValues([FEX_YEAR_FILES_HEADERS.map(function(h) { return found.obj[h] || ''; })]);
    }
  }

  const pattern = fexGetSetting_('yearly_file_pattern', 'Family Expense - {{year}}');
  const fileName = pattern.replace('{{year}}', normalizedYear);
  const yearSs = SpreadsheetApp.create(fileName);
  try {
    DriveApp.getFileById(yearSs.getId()).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (err) {}
  sheet.appendRow([normalizedYear, yearSs.getId(), fileName, 'TRUE', fexNow_(), fexNow_(), '']);
  return yearSs;
}

function fexExistingYearSpreadsheet_(year) {
  const normalizedYear = String(year || '').trim();
  if (!normalizedYear) return null;
  const settingsSs = fexEnsureSettings_();
  const sheet = fexSheet_(settingsSs, FEX_YEAR_FILES_SHEET, FEX_YEAR_FILES_HEADERS);
  const found = fexRows_(sheet).find(function(row) {
    return String(row.obj.year || '') === normalizedYear &&
      String(row.obj.active || 'TRUE').toUpperCase() !== 'FALSE' &&
      row.obj.spreadsheet_id;
  });
  if (!found) return null;
  try {
    return SpreadsheetApp.openById(found.obj.spreadsheet_id);
  } catch (err) {
    return null;
  }
}

function transactionSpreadsheetForMonth_(month) {
  if (fexStorageMode_() === 'legacy') return fexSettingsSpreadsheet_();
  return fexEnsureYearSpreadsheet_(fexYearFromMonth_(month));
}

function fexTransactionSpreadsheetForDate_(date) {
  if (fexStorageMode_() === 'legacy') return fexSettingsSpreadsheet_();
  return fexEnsureYearSpreadsheet_(fexYearFromDate_(date));
}

function fexCandidateTransactionSpreadsheets_(month) {
  const primary = fexStorageMode_() === 'legacy' ? fexSettingsSpreadsheet_() : fexExistingYearSpreadsheet_(fexYearFromMonth_(month));
  const legacy = fexSettingsSpreadsheet_();
  if (!primary) return [legacy];
  return primary.getId() === legacy.getId() ? [primary] : [primary, legacy];
}

function fexMonthSheet_(ss, month) {
  let sheet = ss.getSheetByName(month);
  if (!sheet) sheet = ss.insertSheet(month);
  if (sheet.getLastRow() < 3) {
    sheet.clear();
    sheet.getRange(1, 1, 1, FEX_SETTLEMENT_HEADERS.length).setValues([FEX_SETTLEMENT_HEADERS]);
    sheet.getRange(2, 1, 1, FEX_SETTLEMENT_HEADERS.length).setValues([[month, '', '', 0, 'pending', '']]);
    sheet.getRange(3, 1, 1, FEX_TRANSACTION_HEADERS.length).setValues([FEX_TRANSACTION_HEADERS]);
  }
  return sheet;
}

function fexActiveMembers_() {
  const sheet = fexSheet_(fexEnsureSettings_(), FEX_MEMBERS_SHEET, FEX_MEMBER_HEADERS);
  return fexObjects_(sheet).filter(function(m) { return String(m.active || 'TRUE').toUpperCase() === 'TRUE'; })
    .sort(fexByOrder_);
}

function fexActiveCategories_() {
  const sheet = fexSheet_(fexEnsureSettings_(), FEX_CATEGORIES_SHEET, FEX_CATEGORY_HEADERS);
  return fexObjects_(sheet).filter(function(c) { return String(c.active || 'TRUE').toUpperCase() === 'TRUE'; })
    .sort(fexByOrder_);
}

function fexActivePayments_() {
  const sheet = fexSheet_(fexEnsureSettings_(), FEX_PAYMENTS_SHEET, FEX_PAYMENT_HEADERS);
  return fexObjects_(sheet).filter(function(p) { return String(p.active || 'TRUE').toUpperCase() === 'TRUE'; })
    .sort(fexByOrder_);
}

function fexByOrder_(a, b) {
  return (parseInt(a.order, 10) || 999) - (parseInt(b.order, 10) || 999);
}

function fexNextOrder_(sheet) {
  return fexObjects_(sheet).reduce(function(max, row) {
    return Math.max(max, parseInt(row.order, 10) || 0);
  }, 0) + 1;
}

function fexAddCategory_(b) {
  const sheet = fexSheet_(fexEnsureSettings_(), FEX_CATEGORIES_SHEET, FEX_CATEGORY_HEADERS);
  sheet.appendRow([fexUuid_('cat'), String(b.name || '').trim(), b.icon || '📌', 'TRUE', fexNextOrder_(sheet)]);
  fexClearCache_();
  return { status: 'ok' };
}

function fexAddPayment_(b) {
  const sheet = fexSheet_(fexEnsureSettings_(), FEX_PAYMENTS_SHEET, FEX_PAYMENT_HEADERS);
  sheet.appendRow([
    fexUuid_('pay'),
    b.type || 'other',
    String(b.name || '').trim(),
    b.last4 || '',
    b.owner || FEX_SHARED_OWNER,
    'TRUE',
    fexNextOrder_(sheet)
  ]);
  fexClearCache_();
  return { status: 'ok' };
}

function fexAddMember_(b) {
  const sheet = fexSheet_(fexEnsureSettings_(), FEX_MEMBERS_SHEET, FEX_MEMBER_HEADERS);
  const name = String(b.name || '').trim();
  sheet.appendRow([fexUuid_('mem'), name, name.toLowerCase(), 'TRUE', fexNextOrder_(sheet)]);
  fexClearCache_();
  return { status: 'ok' };
}

function fexEditReference_(sheetName, headers, id, patch) {
  if (!id) throw new Error('Missing id');
  const sheet = fexSheet_(fexEnsureSettings_(), sheetName, headers);
  const rows = fexRows_(sheet);
  const found = rows.find(function(row) { return row.obj.id === id; });
  if (!found) throw new Error('Item not found');
  Object.keys(patch || {}).forEach(function(key) {
    if (patch[key] !== undefined) found.obj[key] = patch[key];
  });
  sheet.getRange(found.rowNumber, 1, 1, headers.length).setValues([headers.map(function(h) { return found.obj[h] || ''; })]);
  fexClearCache_();
  return { status: 'ok' };
}

function fexDeactivateReference_(sheetName, headers, id) {
  return fexEditReference_(sheetName, headers, id, { active: 'FALSE' });
}

function fexReorder_(sheetName, headers, ordersJson) {
  const orders = JSON.parse(ordersJson || '[]');
  const orderById = {};
  orders.forEach(function(item) { orderById[item.id] = item.order; });
  const sheet = fexSheet_(fexEnsureSettings_(), sheetName, headers);
  fexRows_(sheet).forEach(function(row) {
    if (orderById[row.obj.id] === undefined) return;
    row.obj.order = orderById[row.obj.id];
    sheet.getRange(row.rowNumber, 1, 1, headers.length).setValues([headers.map(function(h) { return row.obj[h] || ''; })]);
  });
  fexClearCache_();
  return { status: 'ok' };
}

function fexPaymentLabel_(paymentId, fallback) {
  if (!paymentId) return fallback || '';
  const payment = fexActivePayments_().find(function(p) { return p.id === paymentId; });
  if (!payment) return fallback || paymentId;
  return payment.name + (payment.last4 ? ' ••••' + payment.last4 : '') + ' (' + (payment.owner || FEX_SHARED_OWNER) + ')';
}

function fexCleanTransaction_(b, existingCreatedAt) {
  const date = String(b.date || '').trim();
  if (!date) throw new Error('Missing date');
  const paymentLabel = b.payment_id || fexPaymentLabel_(b.paymentId, b.paymentId);
  return {
    date: date,
    name: String(b.name || '').trim(),
    category: String(b.category || '').trim(),
    type: String(b.type || 'expense').trim() || 'expense',
    amount: parseFloat(b.amount) || 0,
    payer: String(b.payer || '').trim(),
    payment_id: paymentLabel,
    note: String(b.note || '').trim(),
    to: String(b.to || '').trim(),
    created_at: existingCreatedAt || String(b.created_at || '') || fexNow_()
  };
}

function fexTransactionRow_(tx) {
  return FEX_TRANSACTION_HEADERS.map(function(h) { return tx[h] || ''; });
}

function fexAddTransaction_(b) {
  const tx = fexCleanTransaction_(b);
  const month = fexMonthFromDate_(tx.date);
  const ss = fexTransactionSpreadsheetForDate_(tx.date);
  const sheet = fexMonthSheet_(ss, month);
  sheet.appendRow(fexTransactionRow_(tx));
  updateSettlementAmount(month, ss);
  fexClearCache_();
  return { status: 'ok', month: month, spreadsheet_id: ss.getId(), storage_mode: fexStorageMode_(), created_at: tx.created_at };
}

function fexFindTransaction_(sheet, createdAt) {
  const key = String(createdAt || '').substring(0, 19);
  return fexRows_(sheet, 3).find(function(row) {
    return String(row.obj.created_at || '').substring(0, 19) === key;
  });
}

function fexEditTransaction_(b) {
  const month = String(b.month || '') || fexMonthFromDate_(b.date);
  const createdAt = String(b.created_at || '');
  for (const ss of fexCandidateTransactionSpreadsheets_(month)) {
    const sheet = ss.getSheetByName(month);
    if (!sheet) continue;
    const found = fexFindTransaction_(sheet, createdAt);
    if (!found) continue;
    const tx = fexCleanTransaction_(b, found.obj.created_at);
    sheet.getRange(found.rowNumber, 1, 1, FEX_TRANSACTION_HEADERS.length).setValues([fexTransactionRow_(tx)]);
    updateSettlementAmount(month, ss);
    fexClearCache_();
    return { status: 'ok', spreadsheet_id: ss.getId() };
  }
  return { status: 'error', message: 'Transaction not found' };
}

function fexDeleteTransaction_(b) {
  const month = String(b.month || '');
  const createdAt = String(b.created_at || '');
  for (const ss of fexCandidateTransactionSpreadsheets_(month)) {
    const sheet = ss.getSheetByName(month);
    if (!sheet) continue;
    const found = fexFindTransaction_(sheet, createdAt);
    if (!found) continue;
    sheet.deleteRow(found.rowNumber);
    updateSettlementAmount(month, ss);
    fexClearCache_();
    return { status: 'ok', spreadsheet_id: ss.getId() };
  }
  return { status: 'error', message: 'Transaction not found' };
}

function fexMarkSettled_(b) {
  const month = String(b.month || '');
  if (!month) throw new Error('Missing month');
  let ss = null;
  for (const candidate of fexCandidateTransactionSpreadsheets_(month)) {
    const existing = candidate.getSheetByName(month);
    if (existing && existing.getLastRow() >= 3) {
      ss = candidate;
      break;
    }
  }
  if (!ss) ss = transactionSpreadsheetForMonth_(month);
  const sheet = fexMonthSheet_(ss, month);
  sheet.getRange(2, 5, 1, 2).setValues([['settled', fexNow_()]]);
  fexClearCache_();
  return { status: 'ok', spreadsheet_id: ss.getId() };
}

function fexCheckDuplicate_(b) {
  const date = String(b.date || '');
  const month = String(b.month || '') || fexMonthFromDate_(date);
  const amount = Math.round((parseFloat(b.amount) || 0) * 100) / 100;
  const paymentId = String(b.payment_id || b.paymentId || '');
  const items = [];
  fexCandidateTransactionSpreadsheets_(month).forEach(function(ss) {
    const sheet = ss.getSheetByName(month);
    if (!sheet) return;
    fexObjects_(sheet, 3).forEach(function(tx) {
      if (String(tx.date || '').substring(0, 10) !== date) return;
      if (Math.round((parseFloat(tx.amount) || 0) * 100) / 100 !== amount) return;
      if (String(tx.payment_id || '') !== paymentId) return;
      items.push(tx);
    });
  });
  return { status: items.length ? 'found' : 'ok', items: items };
}

function updateSettlementAmount(month, spreadsheet) {
  const ss = spreadsheet || transactionSpreadsheetForMonth_(month);
  const sheet = fexMonthSheet_(ss, month);
  const members = fexActiveMembers_().map(function(m) { return m.name; });
  const transactions = fexObjects_(sheet, 3);
  const settlement = fexComputeSettlement_(transactions, members);
  const first = settlement.settlements[0] || { from: '', to: '', amount: 0 };
  sheet.getRange(2, 1, 1, FEX_SETTLEMENT_HEADERS.length)
    .setValues([[month, first.from, first.to, first.amount || 0, 'pending', '']]);
}

function fexComputeSettlement_(transactions, members) {
  const paid = {};
  members.forEach(function(member) { paid[member] = 0; });
  let expenseTotal = 0;

  transactions.forEach(function(tx) {
    const type = String(tx.type || 'expense').toLowerCase();
    const amount = parseFloat(tx.amount) || 0;
    if (type === 'expense') {
      expenseTotal += amount;
      const owner = fexOwnerFromPayment_(tx.payment_id, tx.payer);
      if (!owner || owner === FEX_SHARED_OWNER) {
        const share = members.length ? amount / members.length : 0;
        members.forEach(function(member) { paid[member] += share; });
      } else if (paid[owner] !== undefined) {
        paid[owner] += amount;
      }
    } else if (type === 'direct') {
      if (paid[tx.payer] !== undefined) paid[tx.payer] -= amount;
      if (paid[tx.to] !== undefined) paid[tx.to] += amount;
    }
  });

  const perPerson = members.length ? expenseTotal / members.length : 0;
  const balances = members.map(function(member) {
    return { name: member, balance: (paid[member] || 0) - perPerson };
  });
  const debtors = balances.filter(function(b) { return b.balance < -1; }).map(function(b) { return Object.assign({}, b); });
  const creditors = balances.filter(function(b) { return b.balance > 1; }).map(function(b) { return Object.assign({}, b); });
  const settlements = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(-debtors[i].balance, creditors[j].balance);
    if (amount > 1) settlements.push({ from: debtors[i].name, to: creditors[j].name, amount: Math.round(amount) });
    debtors[i].balance += amount;
    creditors[j].balance -= amount;
    if (Math.abs(debtors[i].balance) < 1) i += 1;
    if (Math.abs(creditors[j].balance) < 1) j += 1;
  }
  return { settlements: settlements };
}

function fexOwnerFromPayment_(paymentLabel, payer) {
  const text = String(paymentLabel || '');
  const lower = text.toLowerCase();
  if (lower.indexOf('cash') >= 0 || text.indexOf('เงินสด') >= 0) return payer;
  const match = text.match(/\((.+)\)$/);
  const owner = match ? String(match[1] || '').trim() : '';
  return owner || FEX_SHARED_OWNER;
}

function fexClearCache_() {
  if (typeof CacheService === 'undefined') return;
  try {
    const cache = CacheService.getScriptCache();
    ['members', 'categories', 'payments'].forEach(function(key) { cache.remove(key); });
  } catch (err) {}
}

function clearCache() {
  fexClearCache_();
}
