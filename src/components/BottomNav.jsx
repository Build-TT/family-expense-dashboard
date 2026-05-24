import { getLang } from '../i18n'

const NAV_LABELS = {
  th: { dashboard: 'Dashboard', add: 'เพิ่ม', payments: 'บัตร', categories: 'หมวด', payers: 'คน' },
  en: { dashboard: 'Dashboard', add: 'Add',   payments: 'Cards', categories: 'Cats', payers: 'Members' },
}

export default function BottomNav() {
  const current = window.location.pathname
  const lang    = getLang()
  const L       = NAV_LABELS[lang] || NAV_LABELS.th

  const NAV_ITEMS = [
    { path: '/',                icon: '📊', label: L.dashboard },
    { path: '/liff/add',        icon: '➕', label: L.add },
    { path: '/liff/payments',   icon: '💳', label: L.payments },
    { path: '/liff/categories', icon: '🏷', label: L.categories },
    { path: '/liff/payers',     icon: '👤', label: L.payers },
  ]

  const go = (path) => { if (path !== current) window.location.href = path }

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
      background: '#fff', borderTop: '1px solid #e8e8e0',
      display: 'flex', alignItems: 'stretch',
      paddingBottom: 'env(safe-area-inset-bottom)',
      boxShadow: '0 -2px 12px rgba(0,0,0,0.06)'
    }}>
      {NAV_ITEMS.map(item => {
        const active = current === item.path || (item.path !== '/' && current.startsWith(item.path))
        return (
          <button key={item.path} onClick={() => go(item.path)} style={{
            flex: 1, padding: '8px 4px 6px', border: 'none', background: 'none',
            cursor: 'pointer', display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 2
          }}>
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            <span style={{
              fontSize: 10, fontWeight: active ? 700 : 400,
              color: active ? '#1D9E75' : '#999', letterSpacing: '-0.2px'
            }}>{item.label}</span>
            {active && <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#1D9E75' }} />}
          </button>
        )
      })}
    </div>
  )
}
