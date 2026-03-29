import { useState, useEffect } from 'react'
import { fetchSheet, sendToGAS } from './utils'

const S = {
  wrap:    { maxWidth: 480, margin: '0 auto', padding: '0 0 20px', fontFamily: 'system-ui,sans-serif' },
  header:  { background: '#D4537E', color: '#fff', padding: '16px 20px' },
  htitle:  { fontSize: 18, fontWeight: 700, margin: 0 },
  body:    { padding: '16px 20px' },
  card:    { background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 },
  avatar:  { width: 40, height: 40, borderRadius: '50%', background: '#FBEAF0', color: '#D4537E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 },
  cardInfo:{ flex: 1, fontSize: 14, fontWeight: 600 },
  btnDel:  { background: '#FCEBEB', border: 'none', color: '#A32D2D', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', flexShrink: 0 },
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
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast,   setToast]   = useState('')
  const [newName, setNewName] = useState('')
  const [saving,  setSaving]  = useState(false)

  const load = () => {
    setLoading(true)
    fetchSheet('members').then(mems => {
      setMembers(mems.filter(m => m.active === 'TRUE'))
      setLoading(false)
    })
  }
  useEffect(() => { load() }, [])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const handleAdd = async () => {
    if (!newName.trim()) { showToast('กรุณาใส่ชื่อสมาชิก'); return }
    setSaving(true)
    try {
      const data = await sendToGAS({ action: 'addMember', name: newName.trim() })
      if (data.status === 'ok') { showToast('✅ เพิ่มเรียบร้อยแล้ว'); setNewName(''); load() }
      else showToast('❌ ' + (data.message || 'เกิดข้อผิดพลาด'))
    } catch (e) { showToast('❌ เชื่อมต่อไม่ได้') }
    setSaving(false)
  }

  const handleRemove = async (id, name) => {
    if (!confirm(`ลบ "${name}" ออกจากระบบ?`)) return
    try {
      const data = await sendToGAS({ action: 'removeMember', id })
      if (data.status === 'ok') { showToast('✅ ลบเรียบร้อยแล้ว'); load() }
      else showToast('❌ ' + (data.message || 'เกิดข้อผิดพลาด'))
    } catch (e) { showToast('❌ เชื่อมต่อไม่ได้') }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>กำลังโหลด...</div>

  return (
    <div style={S.wrap}>
      {toast && <div style={S.toast}>{toast}</div>}
      <div style={S.header}><div style={S.htitle}>👤 จัดการผู้จ่าย</div></div>
      <div style={S.body}>
        <div style={S.note}>⚠️ การลบสมาชิกจะไม่ลบรายการที่บันทึกไปแล้ว</div>
        <div style={S.section}>สมาชิกปัจจุบัน ({members.length})</div>
        {members.length === 0
          ? <div style={{ color: '#aaa', fontSize: 14 }}>ยังไม่มีสมาชิก</div>
          : members.map(m => (
            <div key={m.id} style={S.card}>
              <div style={S.avatar}>{m.name.substring(0, 2).toUpperCase()}</div>
              <div style={S.cardInfo}>{m.name}</div>
              <button onClick={() => handleRemove(m.id, m.name)} style={S.btnDel}>ลบ</button>
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
    </div>
  )
}
