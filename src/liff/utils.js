export const SHEET_ID = import.meta.env.VITE_SHEET_ID || ''
export const API_KEY  = import.meta.env.VITE_API_KEY  || ''
export const GAS_URL  = import.meta.env.VITE_GAS_URL  || ''

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

export async function sendToGAS(payload) {
  // ส่งเป็น GET + query string เพื่อหลีกเลี่ยง CORS
  const params = new URLSearchParams(
    Object.fromEntries(
      Object.entries(payload).map(([k, v]) => [k, String(v)])
    )
  )
  const res = await fetch(`${GAS_URL}?${params.toString()}`)
  if (!res.ok) throw new Error('GAS error: ' + res.status)
  return res.json()
}

export function todayISO() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
