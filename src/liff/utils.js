// ============================================================
//  LIFF Utilities — shared across all LIFF pages
// ============================================================

export const SHEET_ID  = import.meta.env.VITE_SHEET_ID || ''
export const API_KEY   = import.meta.env.VITE_API_KEY  || ''
export const GAS_URL   = import.meta.env.VITE_GAS_URL  || '' // Web App URL จาก Apps Script

const BASE = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values`

export async function fetchSheet(name) {
  const res  = await fetch(`${BASE}/${encodeURIComponent(name)}?key=${API_KEY}`)
  if (!res.ok) throw new Error(`Cannot fetch ${name}: ${res.status}`)
  const data = await res.json()
  const rows = data.values || []
  if (rows.length < 2) return []
  const headers = rows[0]
  return rows.slice(1).map(row => {
    const obj = {}
    headers.forEach((h, i) => { obj[h] = row[i] || '' })
    return obj
  })
}

export async function sendToGAS(action, payload) {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload })
  })
  return res.json()
}

export function formatDateTH(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function todayISO() {
  const now = new Date()
  const y   = now.getFullYear()
  const m   = String(now.getMonth() + 1).padStart(2, '0')
  const d   = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
