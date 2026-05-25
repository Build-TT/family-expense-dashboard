const TTL = 5 * 60 * 1000  // 5 minutes

export function getCache(key) {
  try {
    const raw = localStorage.getItem('fex_' + key)
    if (!raw) return null
    const { data, exp } = JSON.parse(raw)
    if (Date.now() > exp) { localStorage.removeItem('fex_' + key); return null }
    return data
  } catch { return null }
}

export function setCache(key, data, ttl = TTL) {
  try {
    localStorage.setItem('fex_' + key, JSON.stringify({ data, exp: Date.now() + ttl }))
  } catch {}
}

export function bustCache(...keys) {
  keys.forEach(k => { try { localStorage.removeItem('fex_' + k) } catch {} })
}
