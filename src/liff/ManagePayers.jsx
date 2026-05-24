import { useState, useEffect } from 'react'
import { fetchSheet, sendToGAS } from './utils'
import BottomNav from '../components/BottomNav.jsx'
import LangToggle from '../components/LangToggle.jsx'
import { getLang } from '../i18n'

const S = {
  wrap:    { maxWidth: 480, margin: '0 auto', padding: '0 0 80px', fontFamily: 'system-ui,sans-serif' },
  header:  { background: '#D4537E', color: '#fff', padding: '16px 20px' },
  htitle:  { fontSize: 18, fontWeight: 700, margin: 0 },
  body:    { padding: '16px 20px' },
  card:    { background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: '12px 14px', marginBottom: 8 },
  cardRow: { display: 'flex', alignItems: 'center', gap: 12 },
  avatar:  { width: 40, height: 40, borderRadius: '50%', background: '#FBEAF0', color: '#D4537E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 },
  cardInfo:{ flex: 1, fontSize: 14, fontWeight: 600 },
  btnDel:  { background: '#FCEBEB', border: 'none', color: '#A32D2D', borderRadius: 8, padding: '6px 10px', fontSize: 12, cursor: 'pointer', flexShrink: 0 },
  btnEdit: { background: '#E6F1FB', border: 'none', color: '#0C447C', borderRadius: 8, padding: '6px 10px', fontSize: 12, cursor: 'pointer', flexShrink: 0 },
  btnSave: { background: '#1D9E75', border: 'none', color: '#fff', borderRadius: 8, padding: '10px', fontSize: 13, cursor: 'pointer', flex: 1, fontWeight: 600 },
  btnCan:  { background: '#f0f0ec', border: 'none', color: '#555', borderRadius: 8, padding: '10px', fontSize: 13, cursor: 'pointer', flex: 1 },
  editBox: { marginTop: 10, paddingTop: 10, borderTop: '1px solid #f0f0ec' },
  divider: { borderTop: '1px solid #eee', margin: '20px 0' },
  section: { fontSize: 14, fontWeight: 700, color: '#555', marginBottom: 12 },
  group:   { marginBottom: 12 },
  label:   { fontSize: 13, color: '#555', marginBottom: 5, display: 'block', fontWeight: 600 },
  input:   { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e0e0d8', fontSize: 14, boxSizing: 'border-box' },
  btnAdd:  { width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: '#D4537E', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' },
  toast:   { position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', color: '#fff', padding: '10px 20px', borderRadius: 20, fontSize: 14, zIndex: 999, whiteSpace: 'nowrap' },
  note:    { background: '#fff9f7', border: '1px solid #f5c4b3', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#993C1D', marginBottom: 16 },
}

export default function ManagePayers() {
  const [members,  setMembers]  = useState([])
  const [lang, setLang] = useState(getLang())
  const [loading,  setLoading]  = useState(true)
  const [toast,    setToast]    = useState('')
  const [newName,  setNewName]  = useState('')
  const [saving,   setSaving]   = useState(false)
  const [editId,   setEditId]   = useState(null)
  const [editName, setEditName] = useState('')

  const load = () => {
    setLoading(true)
    fetchSheet('members').then(mems => {
      setMembers(mems.filter(m => m.active === 'TRUE'))
      setLoading(false)
    })
  }
  useEffect(() => {
    const h = () => setLang(getLang())
    window.addEventListener('langchange', h)
    return () => window.removeEventListener('langchange', h)
  }, [])

  useEffect(() => { load() }, [])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500) }
  const startEdit  = (m) => { setEditId(m.id); setEditName(m.name) }
  const cancelEdit = ()  => setEditId(null)

  const handleEdit = async (id) => {
    if (!editName.trim()) { showToast('กรุณาใส่ชื่อสมาชิก'); return }
    setSaving(true)
    try {
      const data = await sendToGAS({ action: 'editMember', id, name: editName.trim() })
      if (data.status === 'ok') { showToast(lang==='en'?'✅ Updated!':'✅ แก้ไขเรียบร้อยแล้ว'); setEditId(null); load() }
      else showToast('❌ ' + (data.message || 'เกิดข้อผิดพลาด'))
    } catch { showToast('❌ เชื่อมต่อไม่ได้') }
    setSaving(false)
  }

  const handleAdd = async () => {
    if (!newName.trim()) { showToast('กรุณาใส่ชื่อสมาชิก'); return }
    setSaving(true)
    try {
      const data = await sendToGAS({ action: 'addMember', name: newName.trim() })
      if (data.status === 'ok') { showToast('✅ เพิ่มเรียบร้อยแล้ว'); setNewName(''); load() }
      else showToast('❌ ' + (data.message || 'เกิดข้อผิดพลาด'))
    } catch { showToast('❌ เชื่อมต่อไม่ได้') }
    setSaving(false)
  }

  const handleRemove = async (id, name) => {
    if (!confirm(lang==='en'?`Remove "${name}" from system?`:`ลบ "${name}" ออกจากระบบ?`)) return
    try {
      const data = await sendToGAS({ action: 'removeMember', id })
      if (data.status === 'ok') { showToast(lang==='en'?'✅ Deleted!':'✅ ลบเรียบร้อยแล้ว'); load() }
      else showToast('❌ ' + (data.message || 'เกิดข้อผิดพลาด'))
    } catch { showToast('❌ เชื่อมต่อไม่ได้') }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>กำลังโหลด...</div>

  return (
    <div style={S.wrap}>
      {toast && <div style={S.toast}>{toast}</div>}
      <div style={{ ...S.header, display:'flex', justifyContent:'space-between', alignItems:'center' }}><div style={S.htitle}>{lang==='en'?'👤 Manage Members':'👤 จัดการผู้จ่าย'}</div><LangToggle /></div>
      <div style={S.body}>
        <div style={S.note}>{lang==='en'?'⚠️ Removing member will not delete existing records':'⚠️ การลบสมาชิกจะไม่ลบรายการที่บันทึกไปแล้ว'}</div>
        <div style={S.section}>{lang==='en'?`Members (${members.length})`:`สมาชิกปัจจุบัน (${members.length})`}</div>
        {members.length === 0
          ? <div style={{ color: '#aaa', fontSize: 14 }}>ยังไม่มีสมาชิก</div>
          : members.map(m => (
            <div key={m.id} style={S.card}>
              <div style={S.cardRow}>
                <div style={S.avatar}>{m.name.substring(0, 2).toUpperCase()}</div>
                <div style={S.cardInfo}>{m.name}</div>
                <button onClick={() => startEdit(m)} style={S.btnEdit}>{lang==='en'?'Edit':'แก้ไข'}</button>
                <button onClick={() => handleRemove(m.id, m.name)} style={S.btnDel}>{lang==='en'?'Delete':'ลบ'}</button>
              </div>
              {editId === m.id && (
                <div style={S.editBox}>
                  <div style={S.group}>
                    <label style={S.label}>ชื่อใหม่</label>
                    <input value={editName} onChange={e => setEditName(e.target.value)}
                      style={S.input} onKeyDown={e => e.key === 'Enter' && handleEdit(m.id)} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={cancelEdit} style={S.btnCan}>ยกเลิก</button>
                    <button onClick={() => handleEdit(m.id)} style={S.btnSave} disabled={saving}>บันทึก</button>
                  </div>
                </div>
              )}
            </div>
          ))
        }
        <div style={S.divider} />
        <div style={S.section}>เพิ่มสมาชิกใหม่</div>
        <div style={S.group}>
          <label style={S.label}>ชื่อสมาชิก</label>
          <input value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="เช่น Oy, Build" style={S.input}
            onKeyDown={e => e.key === 'Enter' && handleAdd()} />
        </div>
        <button onClick={handleAdd} style={S.btnAdd} disabled={saving}>
          {saving ? 'กำลังเพิ่ม...' : '+ เพิ่มสมาชิก'}
        </button>
      </div>
    <BottomNav />
    </div>
  )
}