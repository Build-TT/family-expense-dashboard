/**
 * Recurring transaction helper for the Family Expense Dashboard.
 *
 * Add this file to the existing Apps Script project, then route these actions
 * from handleLiffAction/doGet without changing the existing addTransaction flow:
 *
 *   var recurringResult = handleRecurringLiffAction_(b);
 *   if (recurringResult) return recurringResult;
 *
 * Supported actions:
 * - getRecurringRules
 * - addRecurringRule
 * - updateRecurringRule
 * - deleteRecurringRule
 * - runDueRecurringTransactions
 *
 * Deferred generation:
 * - Saving a recurring rule only writes to recurring_rules.
 * - Monthly transaction rows are created only when
 *   processRecurringDueTransactions() runs on the due date.
 * - Create an Apps Script time trigger for processRecurringDueTransactions()
 *   to run once per day.
 */

const RECURRING_RULES_SHEET = 'recurring_rules';
const RECURRING_OCCURRENCES_SHEET = 'recurring_occurrences';
const RECURRING_RULE_HEADERS = [
  'id', 'name', 'category', 'type', 'amount', 'payer', 'payment_id', 'note', 'to',
  'start_date', 'end_date', 'day_of_month', 'status', 'created_at', 'updated_at'
];
const RECURRING_OCCURRENCE_HEADERS = [
  'rule_id', 'month', 'date', 'created_at', 'status', 'updated_at'
];
const RECURRING_TRANSACTION_HEADERS = [
  'date', 'name', 'category', 'type', 'amount', 'payer', 'payment_id', 'note', 'to', 'created_at'
];

function handleRecurringLiffAction_(b) {
  const action = String((b && b.action) || '');
  if (action === 'getRecurringRules') return getRecurringRules_();
  if (action === 'addRecurringRule') return addRecurringRule_(b);
  if (action === 'updateRecurringRule') return updateRecurringRule_(b);
  if (action === 'deleteRecurringRule') return deleteRecurringRule_(b);
  if (action === 'runDueRecurringTransactions') return runDueRecurringTransactions_(b && b.date);
  return null;
}

function getRecurringRules_() {
  const ss = recurringSpreadsheet_();
  const rules = recurringObjects_(recurringSheet_(ss, RECURRING_RULES_SHEET, RECURRING_RULE_HEADERS))
    .filter(function(rule) { return String(rule.status || 'active') !== 'deleted'; })
    .sort(function(a, b) { return String(b.updated_at || '').localeCompare(String(a.updated_at || '')); });
  return { status: 'ok', data: rules };
}

function addRecurringRule_(b) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const rule = recurringCleanRule_(b);
    rule.id = 'rr_' + Utilities.getUuid();
    rule.status = 'active';
    rule.created_at = recurringNow_();
    rule.updated_at = rule.created_at;

    const ss = recurringSpreadsheet_();
    const sheet = recurringSheet_(ss, RECURRING_RULES_SHEET, RECURRING_RULE_HEADERS);
    sheet.appendRow(RECURRING_RULE_HEADERS.map(function(h) { return rule[h] || ''; }));

    recurringSheet_(ss, RECURRING_OCCURRENCES_SHEET, RECURRING_OCCURRENCE_HEADERS);
    return { status: 'ok', id: rule.id, created: 0, updated: 0, deleted: 0, deferred: true };
  } catch (err) {
    return { status: 'error', message: err.message };
  } finally {
    lock.releaseLock();
  }
}

function updateRecurringRule_(b) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const id = String(b.id || '').trim();
    if (!id) throw new Error('Missing recurring rule id');

    const ss = recurringSpreadsheet_();
    const sheet = recurringSheet_(ss, RECURRING_RULES_SHEET, RECURRING_RULE_HEADERS);
    const rows = recurringRows_(sheet);
    const idx = rows.findIndex(function(row) { return row.obj.id === id; });
    if (idx < 0) throw new Error('Recurring rule not found');

    const current = rows[idx].obj;
    const next = recurringCleanRule_(Object.assign({}, current, b));
    next.id = id;
    next.status = String(current.status || 'active') === 'deleted' ? 'active' : String(current.status || 'active');
    next.created_at = current.created_at || recurringNow_();
    next.updated_at = recurringNow_();

    sheet.getRange(rows[idx].rowNumber, 1, 1, RECURRING_RULE_HEADERS.length)
      .setValues([RECURRING_RULE_HEADERS.map(function(h) { return next[h] || ''; })]);

    const mode = String(b.apply_mode || 'future') === 'all' ? 'all' : 'future';
    const result = recurringSyncGeneratedOccurrences_(ss, next, mode);
    return { status: 'ok', id: id, created: 0, updated: result.updated, deleted: result.deleted, deferred: true };
  } catch (err) {
    return { status: 'error', message: err.message };
  } finally {
    lock.releaseLock();
  }
}

function deleteRecurringRule_(b) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const id = String(b.id || '').trim();
    if (!id) throw new Error('Missing recurring rule id');

    const ss = recurringSpreadsheet_();
    const sheet = recurringSheet_(ss, RECURRING_RULES_SHEET, RECURRING_RULE_HEADERS);
    const rows = recurringRows_(sheet);
    const idx = rows.findIndex(function(row) { return row.obj.id === id; });
    if (idx < 0) throw new Error('Recurring rule not found');

    const rule = rows[idx].obj;
    const mode = String(b.delete_mode || 'future') === 'all' ? 'all' : 'future';
    const cutoff = mode === 'all' ? '0000-00-00' : recurringToday_();
    const deleted = recurringDeleteOccurrences_(ss, id, cutoff);

    rule.status = mode === 'all' ? 'deleted' : 'inactive';
    rule.updated_at = recurringNow_();
    sheet.getRange(rows[idx].rowNumber, 1, 1, RECURRING_RULE_HEADERS.length)
      .setValues([RECURRING_RULE_HEADERS.map(function(h) { return rule[h] || ''; })]);

    return { status: 'ok', id: id, deleted: deleted };
  } catch (err) {
    return { status: 'error', message: err.message };
  } finally {
    lock.releaseLock();
  }
}

function recurringCleanRule_(b) {
  const day = parseInt(b.day_of_month, 10);
  const amount = parseFloat(b.amount);
  const startDate = recurringIsoDate_(b.start_date);
  const endDate = recurringIsoDate_(b.end_date);
  if (!b.name) throw new Error('Missing name');
  if (!b.category) throw new Error('Missing category');
  if (!b.payer) throw new Error('Missing payer');
  if (!b.payment_id) throw new Error('Missing payment method');
  if (!amount || amount <= 0) throw new Error('Invalid amount');
  if (!day || day < 1 || day > 28) throw new Error('day_of_month must be 1-28');
  if (!startDate || !endDate || endDate < startDate) throw new Error('Invalid date range');

  return {
    id: String(b.id || ''),
    name: String(b.name || '').trim(),
    category: String(b.category || '').trim(),
    type: String(b.type || 'expense').trim() || 'expense',
    amount: amount,
    payer: String(b.payer || '').trim(),
    payment_id: String(b.payment_id || '').trim(),
    note: String(b.note || '').trim(),
    to: String(b.to || '').trim(),
    start_date: startDate,
    end_date: endDate,
    day_of_month: day,
    status: String(b.status || 'active').trim() || 'active',
    created_at: String(b.created_at || ''),
    updated_at: String(b.updated_at || '')
  };
}

function runDueRecurringTransactions_(date) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = recurringSpreadsheet_();
    const result = recurringGenerateDueTransactions_(ss, recurringIsoDate_(date) || recurringToday_());
    return { status: 'ok', date: result.date, created: result.created, skipped: result.skipped };
  } catch (err) {
    return { status: 'error', message: err.message };
  } finally {
    lock.releaseLock();
  }
}

function processRecurringDueTransactions() {
  return runDueRecurringTransactions_();
}

function setupRecurringDailyTrigger() {
  const existing = ScriptApp.getProjectTriggers().some(function(trigger) {
    return trigger.getHandlerFunction && trigger.getHandlerFunction() === 'processRecurringDueTransactions';
  });
  if (!existing) {
    ScriptApp.newTrigger('processRecurringDueTransactions')
      .timeBased()
      .everyDays(1)
      .atHour(7)
      .create();
  }
}

function recurringGenerateDueTransactions_(ss, targetDate) {
  const date = recurringIsoDate_(targetDate) || recurringToday_();
  const rules = recurringObjects_(recurringSheet_(ss, RECURRING_RULES_SHEET, RECURRING_RULE_HEADERS))
    .filter(function(rule) { return recurringRuleDueOnDate_(rule, date); });
  const occSheet = recurringSheet_(ss, RECURRING_OCCURRENCES_SHEET, RECURRING_OCCURRENCE_HEADERS);
  const existingKeys = {};
  recurringRows_(occSheet).forEach(function(row) {
    const occ = row.obj;
    if (String(occ.status || 'active') !== 'active') return;
    existingKeys[occ.rule_id + '|' + occ.date] = true;
  });

  let created = 0;
  let skipped = 0;
  rules.forEach(function(rule) {
    const key = rule.id + '|' + date;
    if (existingKeys[key]) {
      skipped += 1;
      return;
    }
    const month = recurringMonthKey_(date);
    const createdAt = recurringCreatedAt_(rule.id, date);
    recurringUpsertMonthlyTransaction_(ss, rule, date, createdAt);
    occSheet.appendRow([rule.id, month, date, createdAt, 'active', recurringNow_()]);
    existingKeys[key] = true;
    created += 1;
  });

  return { date: date, created: created, skipped: skipped };
}

function recurringRuleDueOnDate_(rule, date) {
  if (!rule || String(rule.status || 'active') !== 'active') return false;
  const dueDate = recurringIsoDate_(date);
  const startDate = recurringIsoDate_(rule.start_date);
  const endDate = recurringIsoDate_(rule.end_date);
  const day = parseInt(rule.day_of_month, 10);
  if (!dueDate || !startDate || !endDate || !day) return false;
  return dueDate >= startDate && dueDate <= endDate && parseInt(dueDate.slice(8, 10), 10) === day;
}

function recurringSyncGeneratedOccurrences_(ss, rule, mode) {
  const cutoff = mode === 'all' ? '0000-00-00' : recurringToday_();
  const desired = recurringDesiredDates_(rule);
  const desiredByMonth = {};
  desired.forEach(function(date) { desiredByMonth[recurringMonthKey_(date)] = date; });

  const occSheet = recurringSheet_(ss, RECURRING_OCCURRENCES_SHEET, RECURRING_OCCURRENCE_HEADERS);
  const occRows = recurringRows_(occSheet).filter(function(row) {
    return row.obj.rule_id === rule.id && String(row.obj.status || 'active') === 'active';
  });
  const seen = {};
  const touched = {};
  let created = 0;
  let updated = 0;
  let deleted = 0;

  occRows.forEach(function(row) {
    const occ = row.obj;
    if (String(occ.date || '') < cutoff) {
      seen[occ.month] = true;
      return;
    }
    const desiredDate = desiredByMonth[occ.month];
    if (!desiredDate) {
      if (recurringDeleteMonthlyRow_(ss, occ.month, occ.created_at)) {
        deleted += 1;
        occ.status = 'removed';
        occ.updated_at = recurringNow_();
        touched[occ.month] = true;
        occSheet.getRange(row.rowNumber, 1, 1, RECURRING_OCCURRENCE_HEADERS.length)
          .setValues([RECURRING_OCCURRENCE_HEADERS.map(function(h) { return occ[h] || ''; })]);
      }
      return;
    }
    recurringUpsertMonthlyTransaction_(ss, rule, desiredDate, occ.created_at);
    occ.date = desiredDate;
    occ.updated_at = recurringNow_();
    occSheet.getRange(row.rowNumber, 1, 1, RECURRING_OCCURRENCE_HEADERS.length)
      .setValues([RECURRING_OCCURRENCE_HEADERS.map(function(h) { return occ[h] || ''; })]);
    seen[occ.month] = true;
    touched[occ.month] = true;
    updated += 1;
  });

  recurringRefreshMonths_(ss, Object.keys(touched));
  return { created: created, updated: updated, deleted: deleted };
}

function recurringDesiredDates_(rule) {
  const dates = [];
  const day = String(rule.day_of_month).padStart(2, '0');
  let cursor = rule.start_date.slice(0, 7) + '-' + day;
  for (let guard = 0; guard < 240; guard += 1) {
    if (cursor >= rule.start_date && cursor <= rule.end_date) dates.push(cursor);
    cursor = recurringAddMonth_(cursor);
    if (cursor.slice(0, 7) > rule.end_date.slice(0, 7)) break;
  }
  return dates;
}

function recurringUpsertMonthlyTransaction_(ss, rule, date, createdAt) {
  const month = recurringMonthKey_(date);
  const txSs = recurringTransactionSpreadsheetForMonth_(month);
  const sheet = recurringMonthSheet_(txSs, month);
  const rows = sheet.getDataRange().getValues();
  const row = [date, rule.name, rule.category, rule.type || 'expense', rule.amount, rule.payer, rule.payment_id, rule.note || '', rule.to || '', createdAt];
  for (let i = 3; i < rows.length; i += 1) {
    if (String(rows[i][9] || '').substring(0, 19) === String(createdAt || '').substring(0, 19)) {
      sheet.getRange(i + 1, 1, 1, RECURRING_TRANSACTION_HEADERS.length).setValues([row]);
      recurringRefreshMonth_(month);
      return;
    }
  }
  sheet.appendRow(row);
  recurringRefreshMonth_(month);
}

function recurringDeleteOccurrences_(ss, ruleId, cutoff) {
  const occSheet = recurringSheet_(ss, RECURRING_OCCURRENCES_SHEET, RECURRING_OCCURRENCE_HEADERS);
  const occRows = recurringRows_(occSheet);
  let deleted = 0;
  const touched = {};
  occRows.forEach(function(row) {
    const occ = row.obj;
    if (occ.rule_id !== ruleId || String(occ.status || 'active') !== 'active' || String(occ.date || '') < cutoff) return;
    if (recurringDeleteMonthlyRow_(ss, occ.month, occ.created_at)) deleted += 1;
    occ.status = 'removed';
    occ.updated_at = recurringNow_();
    touched[occ.month] = true;
    occSheet.getRange(row.rowNumber, 1, 1, RECURRING_OCCURRENCE_HEADERS.length)
      .setValues([RECURRING_OCCURRENCE_HEADERS.map(function(h) { return occ[h] || ''; })]);
  });
  recurringRefreshMonths_(ss, Object.keys(touched));
  return deleted;
}

function recurringDeleteMonthlyRow_(ss, month, createdAt) {
  const txSs = recurringTransactionSpreadsheetForMonth_(month);
  const sheet = txSs.getSheetByName(month);
  if (!sheet) return false;
  const rows = sheet.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 3; i -= 1) {
    if (String(rows[i][9] || '').substring(0, 19) === String(createdAt || '').substring(0, 19)) {
      sheet.deleteRow(i + 1);
      recurringRefreshMonth_(month);
      return true;
    }
  }
  return false;
}

function recurringMonthSheet_(ss, month) {
  let sheet = ss.getSheetByName(month);
  if (!sheet) sheet = ss.insertSheet(month);
  if (sheet.getLastRow() < 3) {
    sheet.clear();
    sheet.getRange(1, 1, 1, 6).setValues([['month', 'from', 'to', 'amount', 'status', 'settled_at']]);
    sheet.getRange(2, 1, 1, 6).setValues([[month, '', '', 0, 'pending', '']]);
    sheet.getRange(3, 1, 1, RECURRING_TRANSACTION_HEADERS.length).setValues([RECURRING_TRANSACTION_HEADERS]);
  }
  return sheet;
}

function recurringSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  const existing = sheet.getRange(1, 1, 1, Math.max(headers.length, sheet.getLastColumn() || 1)).getValues()[0];
  if (sheet.getLastRow() === 0 || String(existing[0] || '') !== headers[0]) {
    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

function recurringRows_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1).map(function(row, i) {
    const obj = {};
    headers.forEach(function(h, col) { obj[h] = row[col] === undefined ? '' : row[col]; });
    return { rowNumber: i + 2, obj: obj };
  });
}

function recurringObjects_(sheet) {
  return recurringRows_(sheet).map(function(row) { return row.obj; });
}

function recurringSpreadsheet_() {
  if (typeof SpreadsheetApp === 'undefined') throw new Error('SpreadsheetApp is unavailable');
  if (typeof fexSettingsSpreadsheet_ === 'function') return fexSettingsSpreadsheet_();
  if (typeof SPREADSHEET_ID !== 'undefined' && SPREADSHEET_ID) return SpreadsheetApp.openById(SPREADSHEET_ID);
  if (typeof SHEET_ID !== 'undefined' && SHEET_ID) return SpreadsheetApp.openById(SHEET_ID);
  const propId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  return SpreadsheetApp.openById(propId || '1zv-5EH5b08fKpkfrwqOxLcGjStfWE5t-hSn-8s7LWYI');
}

function recurringTransactionSpreadsheetForMonth_(month) {
  if (typeof transactionSpreadsheetForMonth_ === 'function') return transactionSpreadsheetForMonth_(month);
  return recurringSpreadsheet_();
}

function recurringIsoDate_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  const text = String(value).trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? match[0] : '';
}

function recurringToday_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function recurringNow_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

function recurringAddMonth_(date) {
  const parts = date.split('-').map(Number);
  const next = new Date(parts[0], parts[1], 1);
  return Utilities.formatDate(next, Session.getScriptTimeZone(), 'yyyy-MM') + '-' + String(parts[2]).padStart(2, '0');
}

function recurringMonthKey_(date) {
  return date.slice(5, 7) + '-' + date.slice(0, 4);
}

function recurringCreatedAt_(ruleId, date) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, ruleId + ':' + date);
  const nums = digest.map(function(n) { return n < 0 ? n + 256 : n; });
  const hh = String(nums[0] % 24).padStart(2, '0');
  const mm = String(nums[1] % 60).padStart(2, '0');
  const ss = String(nums[2] % 60).padStart(2, '0');
  return date + 'T' + hh + ':' + mm + ':' + ss;
}

function recurringRefreshMonths_(ss, months) {
  const seen = {};
  months.forEach(function(month) {
    if (!month || seen[month]) return;
    seen[month] = true;
    recurringRefreshMonth_(month);
  });
}

function recurringRefreshMonth_(month) {
  if (typeof updateSettlementAmount === 'function') {
    try { updateSettlementAmount(month); } catch (err) {}
  }
  if (typeof clearCache === 'function') {
    try { clearCache(); } catch (err) {}
  }
}
