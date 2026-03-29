import { useState, useEffect } from 'react'
import { fetchSheet, GAS_URL } from './utils'

const ICON_OPTIONS = ['🍜','🛒','⚡','🚕','🎬','💊','🛍️','🏠','🐕','💳','✈️','🔨','🚗','📱','📌']

const S = {
  wrap:    { maxWidth: 480, margin: '0 auto', padding: '0 0 20px', fontFamily: 'system-ui,sans-serif' },
  header:  { background: '#7F77DD', color: '#fff', padding: '16px 20px' },
  htitle:  { fontSize: 18, fontWeight: 700, margin: 0 },
  body:    { padding: '16px 20px' },
  card:    { background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 },
  cardInfo:{ flex: 1, fontSize: 14 },
  btnDel:  { background: '#FCEBEB', border: 'none', color: '#A32D2D', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' },
  divider: { borderTop: '1px solid #eee', margin: '20px 0' },
  section: { fontSize: 14, fontWeight: 700, color: '#555', marginBottom: 12 },
  group:   { marginBottom: 12 },
  label:   { fontSize: 13, color: '#555', marginBottom: 5, display: 'block', fontWeight: 600 },
  input:   { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e0e0d8', fontSize: 14, boxSizing: 'border-box' },
  iconGrid:{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  iconBtn: { width: 40, height: 40, borderRadius: 8, border: '1.5px solid #e0e0d8', fontSize: 20, cursor: 'pointer', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  iconSel: { width: 40, height: 40, borderRadius: 8, border: '2px solid #7F77DD', fontSize: 20, cursor: 'pointer', background: '#EEEDFE', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  btnAdd:  { width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: '#7F77DD', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' },
  toast:   { position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', color: '#fff', padding: '10px 20px', borderRadius: 20, fontSize: 14, zIndex: 999 },
}

export default function ManageCategories() {
  const [categories, setCategories] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [toast,      setToast]      = useState('')
  const [newName,    setNewName]    = useState('')
  const [newIcon,    setNewIcon]    = useState('📌')
  const [saving,     setSaving]     = useState(false)

  const load = () => {
    setLoading(true)
    fetchSheet('categories').then(cats => {
      setCategories(cats.filter(c => c.active === 'TRUE'))
      setLoading(false)
    })
  }
  useEffect(() => { load() }, [])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const handleAdd = async () => {
    if (!newName.trim()) { showToast('กรุณาใส่ชื่อหมวดหมู่'); return }
    setSaving(true)
    try {
      const res  = await fetch(GAS_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'addCategory', name: newName.trim(), icon: newIcon })
      })
      const data = await res.json()
      if (data.status === 'ok') { showToast('✅ เพิ่มเรียบร้อยแล้ว'); setNewName(''); load() }
      else showToast('❌ เกิดข้อผิดพลาด')
    } catch { showToast('❌ เชื่อมต่อไม่ได้') }
    setSaving(false)
  }

  const handleRemove = async (id, name) => {
    if (!confirm(`ลบหมวด "${name}" ออกจากระบบ?`)) return
    try {
      const res  = await fetch(GAS_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'removeCategory', id })
      })
      const data = await res.json()
      if (data.status === 'ok') { showToast('✅ ลบเรียบร้อยแล้ว'); load() }
      else showToast('❌ เกิดข้อผิดพลาด')
    } catch { showToast('❌ เชื่อมต่อไม่ได้') }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>กำลังโหลด...</div>

  return (
    <div style={S.wrap}>
      {toast && <div style={S.toast}>{toast}</div>}
      <div style={S.header}><div style={S.htitle}>🏷 จัดการหมวดหมู่</div></div>
      <div style={S.body}>
        <div style={S.section}>หมวดหมู่ปัจจุบัน ({categories.length})</div>
        {categories.length === 0
          ? <div style={{ color: '#aaa', fontSize: 14 }}>ยังไม่มีหมวดหมู่</div>
          : categories.map(c => (
            <div key={c.id} style={S.card}>
              <div style={{ fontSize: 22 }}>{c.icon}</div>
              <div style={S.cardInfo}>{c.name}</div>
              <button onClick={() => handleRemove(c.id, c.name)} style={S.btnDel}>ลบ</button>
            </div>
          ))
        }

        <div style={S.divider} />
        <div style={S.section}>เพิ่มหมวดหมู่ใหม่</div>

        <div style={S.group}>
          <label style={S.label}>ชื่อหมวดหมู่</label>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="เช่น อาหาร, เดินทาง" style={S.input} />
        </div>

        <div style={S.group}>
          <label style={S.label}>เลือก Icon</label>
          <div style={S.iconGrid}>
            {ICON_OPTIONS.map(icon => (
              <button key={icon} onClick={() => setNewIcon(icon)}
                style={newIcon === icon ? S.iconSel : S.iconBtn}>{icon}</button>
            ))}
          </div>
          <div style={{ fontSize: 13, color: '#888' }}>เลือกแล้ว: {newIcon} หรือพิมพ์ emoji เองได้</div>
          <input value={newIcon} onChange={e => setNewIcon(e.target.value)} style={{ ...S.input, marginTop: 6, width: 60, textAlign: 'center', fontSize: 20 }} maxLength={4} />
        </div>

        <button onClick={handleAdd} style={S.btnAdd} disabled={saving}>
          {saving ? 'กำลังเพิ่ม...' : '+ เพิ่มหมวดหมู่'}
        </button>
      </div>
    </div>
  )
}
