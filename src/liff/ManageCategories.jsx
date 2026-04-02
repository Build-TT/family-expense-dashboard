import { useState, useEffect } from 'react'
import { fetchSheet, sendToGAS } from './utils'
import BottomNav from '../components/BottomNav.jsx'

const ICON_OPTIONS = ['🍜','🛒','⚡','🚕','🎬','💊','🛍️','🏠','🐕','💳','✈️','🔨','🚗','📱','📌','🏋️','🎵','📚','🧴','🍺']

const S = {
  wrap:    { maxWidth: 480, margin: '0 auto', padding: '0 0 80px', fontFamily: 'system-ui,sans-serif' },
  header:  { background: '#7F77DD', color: '#fff', padding: '16px 20px' },
  htitle:  { fontSize: 18, fontWeight: 700, margin: 0 },
  body:    { padding: '16px 20px' },
  card:    { background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: '12px 14px', marginBottom: 8 },
  cardRow: { display: 'flex', alignItems: 'center', gap: 10 },
  cardInfo:{ flex: 1, fontSize: 14 },
  btnDel:  { background: '#FCEBEB', border: 'none', color: '#A32D2D', borderRadius: 8, padding: '6px 10px', fontSize: 12, cursor: 'pointer', flexShrink: 0 },
  btnEdit: { background: '#E6F1FB', border: 'none', color: '#0C447C', borderRadius: 8, padding: '6px 10px', fontSize: 12, cursor: 'pointer', flexShrink: 0 },
  btnSave: { background: '#1D9E75', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 10px', fontSize: 12, cursor: 'pointer', flexShrink: 0 },
  btnCan:  { background: '#f0f0ec', border: 'none', color: '#555', borderRadius: 8, padding: '6px 10px', fontSize: 12, cursor: 'pointer', flexShrink: 0 },
  editBox: { marginTop: 10, paddingTop: 10, borderTop: '1px solid #f0f0ec' },
  divider: { borderTop: '1px solid #eee', margin: '20px 0' },
  section: { fontSize: 14, fontWeight: 700, color: '#555', marginBottom: 12 },
  group:   { marginBottom: 12 },
  label:   { fontSize: 13, color: '#555', marginBottom: 5, display: 'block', fontWeight: 600 },
  input:   { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e0e0d8', fontSize: 14, boxSizing: 'border-box' },
  iconGrid:{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  iconBtn: { width: 36, height: 36, borderRadius: 8, border: '1.5px solid #e0e0d8', fontSize: 18, cursor: 'pointer', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  iconSel: { width: 36, height: 36, borderRadius: 8, border: '2px solid #7F77DD', fontSize: 18, cursor: 'pointer', background: '#EEEDFE', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  btnAdd:  { width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: '#7F77DD', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' },
  toast:   { position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', color: '#fff', padding: '10px 20px', borderRadius: 20, fontSize: 14, zIndex: 999, whiteSpace: 'nowrap' },
}

export default function ManageCategories() {
  const [categories, setCategories] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [toast,      setToast]      = useState('')
  const [newName,    setNewName]    = useState('')
  const [newIcon,    setNewIcon]    = useState('📌')
  const [saving,     setSaving]     = useState(false)
  const [editId,     setEditId]     = useState(null)
  const [editName,   setEditName]   = useState('')
  const [editIcon,   setEditIcon]   = useState('')

  const load = () => {
    setLoading(true)
    fetchSheet('categories').then(cats => {
      setCategories(cats.filter(c => c.active === 'TRUE'))
      setLoading(false)
    })
  }
  useEffect(() => { load() }, [])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const startEdit = (c) => { setEditId(c.id); setEditName(c.name); setEditIcon(c.icon) }
  const cancelEdit = ()  => { setEditId(null) }

  const handleEdit = async (id) => {
    if (!editName.trim()) { showToast('กรุณาใส่ชื่อหมวดหมู่'); return }
    setSaving(true)
    try {
      const data = await sendToGAS({ action: 'editCategory', id, name: editName.trim(), icon: editIcon })
      if (data.status === 'ok') { showToast('✅ แก้ไขเรียบร้อยแล้ว'); setEditId(null); load() }
      else showToast('❌ ' + (data.message || 'เกิดข้อผิดพลาด'))
    } catch { showToast('❌ เชื่อมต่อไม่ได้') }
    setSaving(false)
  }

  const handleAdd = async () => {
    if (!newName.trim()) { showToast('กรุณาใส่ชื่อหมวดหมู่'); return }
    setSaving(true)
    try {
      const data = await sendToGAS({ action: 'addCategory', name: newName.trim(), icon: newIcon })
      if (data.status === 'ok') { showToast('✅ เพิ่มเรียบร้อยแล้ว'); setNewName(''); load() }
      else showToast('❌ ' + (data.message || 'เกิดข้อผิดพลาด'))
    } catch { showToast('❌ เชื่อมต่อไม่ได้') }
    setSaving(false)
  }

  const handleRemove = async (id, name) => {
    if (!confirm(`ลบหมวด "${name}" ออกจากระบบ?`)) return
    try {
      const data = await sendToGAS({ action: 'removeCategory', id })
      if (data.status === 'ok') { showToast('✅ ลบเรียบร้อยแล้ว'); load() }
      else showToast('❌ ' + (data.message || 'เกิดข้อผิดพลาด'))
    } catch { showToast('❌ เชื่อมต่อไม่ได้') }
  }

  const IconPicker = ({ value, onChange }) => (
    <>
      <div style={S.iconGrid}>
        {ICON_OPTIONS.map(icon => (
          <button key={icon} onClick={() => onChange(icon)}
            style={value === icon ? S.iconSel : S.iconBtn}>{icon}</button>
        ))}
      </div>
      <input value={value} onChange={e => onChange(e.target.value)}
        style={{ ...S.input, width: 60, textAlign: 'center', fontSize: 20 }} maxLength={4} />
    </>
  )

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
              <div style={S.cardRow}>
                <div style={{ fontSize: 22, flexShrink: 0 }}>{c.icon}</div>
                <div style={S.cardInfo}>{c.name}</div>
                <button onClick={() => startEdit(c)} style={S.btnEdit}>แก้ไข</button>
                <button onClick={() => handleRemove(c.id, c.name)} style={S.btnDel}>ลบ</button>
              </div>
              {editId === c.id && (
                <div style={S.editBox}>
                  <div style={S.group}>
                    <label style={S.label}>ชื่อหมวดหมู่</label>
                    <input value={editName} onChange={e => setEditName(e.target.value)} style={S.input} />
                  </div>
                  <div style={S.group}>
                    <label style={S.label}>Icon</label>
                    <IconPicker value={editIcon} onChange={setEditIcon} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={cancelEdit} style={{ ...S.btnCan, flex: 1, padding: '10px' }}>ยกเลิก</button>
                    <button onClick={() => handleEdit(c.id)} style={{ ...S.btnSave, flex: 1, padding: '10px' }} disabled={saving}>บันทึก</button>
                  </div>
                </div>
              )}
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
          <IconPicker value={newIcon} onChange={setNewIcon} />
        </div>
        <button onClick={handleAdd} style={S.btnAdd} disabled={saving}>
          {saving ? 'กำลังเพิ่ม...' : '+ เพิ่มหมวดหมู่'}
        </button>
      </div>
    <BottomNav />
    </div>
  )
}
