export const SETTINGS_SHEET_ID = import.meta.env.VITE_SETTINGS_SHEET_ID || import.meta.env.VITE_SHEET_ID || ''
export const LEGACY_SHEET_ID = import.meta.env.VITE_LEGACY_SHEET_ID || import.meta.env.VITE_SHEET_ID || SETTINGS_SHEET_ID
export const API_KEY = import.meta.env.VITE_API_KEY || ''

const valuesBase = (spreadsheetId) => `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values`
const yearFileCache = new Map()
let settingsCache = null

function rowObjects(rows) {
  if (rows.length < 2) return []
  const headers = rows[0]
  return rows.slice(1).map(row => {
    const obj = {}
    headers.forEach((h, i) => { obj[h] = row[i] || '' })
    return obj
  })
}

async function fetchValues(spreadsheetId, sheetName) {
  if (!spreadsheetId) throw new Error('Missing spreadsheet id')
  const res = await fetch(`${valuesBase(spreadsheetId)}/${encodeURIComponent(sheetName)}?key=${API_KEY}`)
  if (!res.ok) throw new Error(`Cannot fetch ${sheetName}: ${res.status}`)
  const data = await res.json()
  return data.values || []
}

export async function fetchSheetFrom(spreadsheetId, sheetName) {
  return rowObjects(await fetchValues(spreadsheetId, sheetName))
}

export async function fetchSettingsSheet(sheetName) {
  return fetchSheetFrom(SETTINGS_SHEET_ID, sheetName)
}

export async function fetchSheet(sheetName) {
  return fetchSettingsSheet(sheetName)
}

async function getSystemSettings() {
  if (settingsCache) return settingsCache
  try {
    const rows = await fetchSettingsSheet('system_settings')
    settingsCache = rows.reduce((acc, row) => {
      if (row.key) acc[row.key] = row.value || ''
      return acc
    }, {})
  } catch {
    settingsCache = {}
  }
  return settingsCache
}

async function storageMode() {
  const settings = await getSystemSettings()
  return String(settings.storage_mode || 'yearly').toLowerCase()
}

async function resolveYearSpreadsheetId(year) {
  const normalizedYear = String(year || '').trim()
  if (!normalizedYear || await storageMode() === 'legacy') return LEGACY_SHEET_ID
  if (yearFileCache.has(normalizedYear)) return yearFileCache.get(normalizedYear)

  try {
    const rows = await fetchSettingsSheet('year_files')
    const match = rows.find(row =>
      String(row.year || '').trim() === normalizedYear &&
      String(row.active || 'TRUE').toUpperCase() !== 'FALSE'
    )
    const spreadsheetId = match && match.spreadsheet_id ? match.spreadsheet_id : LEGACY_SHEET_ID
    yearFileCache.set(normalizedYear, spreadsheetId)
    return spreadsheetId
  } catch {
    yearFileCache.set(normalizedYear, LEGACY_SHEET_ID)
    return LEGACY_SHEET_ID
  }
}

export async function fetchYearSheet(year, sheetName) {
  const spreadsheetId = await resolveYearSpreadsheetId(year)
  return fetchSheetFrom(spreadsheetId, sheetName)
}

export async function fetchMonthSheet(sheetName, year) {
  const spreadsheetId = await resolveYearSpreadsheetId(year || String(sheetName).slice(3, 7))
  const tryIds = spreadsheetId === LEGACY_SHEET_ID ? [spreadsheetId] : [spreadsheetId, LEGACY_SHEET_ID]

  for (let i = 0; i < tryIds.length; i += 1) {
    const id = tryIds[i]
    try {
      const rows = await fetchValues(id, sheetName)
      const source = {
        storage: id === LEGACY_SHEET_ID ? 'legacy' : 'yearly',
        spreadsheetId: id,
        sheetName,
        fallback: i > 0,
        preferredSpreadsheetId: spreadsheetId,
      }
      if (rows.length < 4) {
        if (i < tryIds.length - 1) continue
        return { settlement: null, transactions: [], source }
      }

      const s = rows[1] || []
      const settlement = {
        month: s[0] || '', from: s[1] || '', to: s[2] || '',
        amount: parseFloat(s[3]) || 0, status: s[4] || 'pending', settledAt: s[5] || ''
      }

      const headers = rows[2] || []
      const transactions = rows.slice(3).map(row => {
        const obj = {}
        headers.forEach((h, i) => { obj[h] = row[i] || '' })
        return obj
      })

      return { settlement, transactions, source }
    } catch {}
  }

  return null
}

export function clearSheetResolverCache() {
  yearFileCache.clear()
  settingsCache = null
}
