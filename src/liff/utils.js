export { API_KEY, SETTINGS_SHEET_ID as SHEET_ID, fetchSheet } from '../sheets'
export const GAS_URL  = import.meta.env.VITE_GAS_URL  || ''

export const LIFF_IDS = {
  add:        '2010315448-TImHYtBm',
  payments:   '2010315448-TImHYtBm',
  categories: '2010315448-TImHYtBm',
  payers:     '2010315448-TImHYtBm',
  recurring:  '2010315448-TImHYtBm',
}

// โหลด LIFF SDK แบบ dynamic — เฉพาะเมื่อเรียก initLiff
// ไม่ redirect login เมื่อเปิดใน browser ปกติ
export async function initLiff(pageKey) {
  try {
    // โหลด SDK เฉพาะเมื่อยังไม่มี
    if (typeof liff === 'undefined') {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js'
        script.charset = 'utf-8'
        script.onload = resolve
        script.onerror = reject
        document.head.appendChild(script)
      })
    }
    const liffId = LIFF_IDS[pageKey]
    if (!liffId) return
    await liff.init({ liffId })
    // login เฉพาะเมื่ออยู่ใน Line app และยังไม่ login
    if (liff.isInClient() && !liff.isLoggedIn()) {
      liff.login()
    }
  } catch (e) {
    console.warn('LIFF init skipped:', e.message)
    // ไม่ crash — ใช้งานได้ใน browser ปกติ
  }
}

export async function sendToGAS(payload) {
  const params = new URLSearchParams(
    Object.fromEntries(Object.entries(payload).map(([k, v]) => [k, String(v)]))
  )
  const res = await fetch(`${GAS_URL}?${params.toString()}`)
  if (!res.ok) throw new Error('GAS error: ' + res.status)
  return res.json()
}

export function todayISO() {
  const now = new Date()
  return now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0')
}
