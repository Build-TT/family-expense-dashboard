import { useState, useEffect } from 'react'
import { fetchSheet, sendToGAS } from './utils'
import BottomNav from '../components/BottomNav.jsx'

const TYPE_OPTIONS = [
  { value: 'credit',  label: '💳 บัตรเครดิต' },
  { value: 'debit',   label: '💳 บัตรเดบิต' },
  { value: 'prompt',  label: '📱 พร้อมเพย์' },
  { value: 'ewallet', label: '👜 E-Wallet' },
  { value: 'cash',    label: '💵 เงินสด' },
  { value: 'other',   label: '🔖 อื่นๆ' },
]

const S = {
  wrap:    { maxWidth: 480, margin: '0 auto', padding: '0 0 80px', fontFamily: 'system-ui,sans-serif' },
  header:  { background: '#378ADD', color: '#fff', padding: '16px 20px' },
  htitle:  { fontSize: 18, fontWeight: 700, margin: 0 },
  body:    { padding: '16px 20px' },
  card:    { background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: '12px 14px', marginBottom: 8 },
  cardRow: { display: 'flex', alignItems: 'center', gap: 10 },
  cardInfo:{ flex: 1 },
  cardName:{ fontSize: 14, fontWeight: 600 },
  cardSub: { fontSize: 12, color: '#888', marginTop: 2 },
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
  select:  { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e0e0d8', fontSize: 14, background: '#fff', boxSizing: 'border-box' },
  grid2:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  btnAdd:  { width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: '#378ADD', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 4 },
  toast:   { position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', color: '#fff', padding: '10px 20px', borderRadius: 20, fontSize: 14, zIndex: 999, whiteSpace: 'nowrap' },
}

export default function ManagePayments() {
  const [payments,  setPayments]  = useState([])
  const [members,   setMembers]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [toast,     setToast]     = useState('')
  const [saving,    setSaving]    = useState(false)
  const [editId,    setEditId]    = useState(null)
  const [editName,  setEditName]  = useState('')
  const [editLast4, setEditLast4] = useState('')
  const [editType,  setEditType]  = useState('credit')
  const [editOwner, setEditOwner] = useState('')
  const [newType,   setNewType]   = useState('credit')
  const [newName,   setNewName]   = useState('')
  const [newLast4,  setNewLast4]  = useState('')
  const [newOwner,  setNewOwner]  = useState('')

  const load = () => {
    setLoading(true)
    Promise.all([fetchSheet('payment_methods'), fetchSheet('members')]).then(([pays, mems]) => {
      setPayments(pays.filter(p => p.active === 'TRUE'))
      setMembers(mems.filter(m => m.active === 'TRUE'))
      if (mems.length > 0 && !newOwner) setNewOwner(mems[0].name)
      setLoading(false)
    })
  }
  useEffect(() => { load() }, [])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const startEdit = (p) => {
    setEditId(p.id); setEditName(p.name)
    setEditLast4(p.last4); setEditType(p.type); setEditOwner(p.owner)
  }
  const cancelEdit = () => setEditId(null)

  const handleEdit = async (id) => {
    if (!editName.trim()) { showToast('กรุณาใส่ชื่อบัตร'); return }
    setSaving(true)
    try {
      const data = await sendToGAS({ action: 'editPayment', id, type: editType, name: editName.trim(), last4: editLast4.trim(), owner: editOwner })
      if (data.status === 'ok') { showToast('✅ แก้ไขเรียบร้อยแล้ว'); setEditId(null); load() }
      else showToast('❌ ' + (data.message || 'เกิดข้อผิดพลาด'))
    } catch { showToast('❌ เชื่อมต่อไม่ได้') }
    setSaving(false)
  }

  const handleAdd = async () => {
    if (!newName.trim()) { showToast('กรุณาใส่ชื่อบัตร'); return }
    setSaving(true)
    try {
      const data = await sendToGAS({ action: 'addPayment', type: newType, name: newName.trim(), last4: newLast4.trim(), owner: newOwner || 'ร่วมกัน' })
      if (data.status === 'ok') { showToast('✅ เพิ่มเรียบร้อยแล้ว'); setNewName(''); setNewLast4(''); load() }
      else showToast('❌ ' + (data.message || 'เกิดข้อผิดพลาด'))
    } catch { showToast('❌ เชื่อมต่อไม่ได้') }
    setSaving(false)
  }

  const handleRemove = async (id, name) => {
    if (!confirm(`ลบ "${name}" ออกจากระบบ?`)) return
    try {
      const data = await sendToGAS({ action: 'removePayment', id })
      if (data.status === 'ok') { showToast('✅ ลบเรียบร้อยแล้ว'); load() }
      else showToast('❌ ' + (data.message || 'เกิดข้อผิดพลาด'))
    } catch { showToast('❌ เชื่อมต่อไม่ได้') }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>กำลังโหลด...</div>

  const OwnerSelect = ({ value, onChange }) => (
    <select value={value} onChange={e => onChange(e.target.value)} style={S.select}>
      <option value="ร่วมกัน">ร่วมกัน</option>
      {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
    </select>
  )

  return (
    <div style={S.wrap}>
      {toast && <div style={S.toast}>{toast}</div>}
      <div style={S.header}><div style={S.htitle}>💳 จัดการวิธีชำระเงิน</div></div>
      <div style={S.body}>
        <div style={S.section}>รายการปัจจุบัน ({payments.length})</div>
        {payments.length === 0
          ? <div style={{ color: '#aaa', fontSize: 14 }}>ยังไม่มีวิธีชำระเงิน</div>
          : payments.map(p => (
            <div key={p.id} style={S.card}>
              <div style={S.cardRow}>
                <div style={S.cardInfo}>
                  <div style={S.cardName}>{p.name}{p.last4 ? ` ···${p.last4}` : ''}</div>
                  <div style={S.cardSub}>{TYPE_OPTIONS.find(t => t.value === p.type)?.label || p.type} · {p.owner}</div>
                </div>
                <button onClick={() => startEdit(p)} style={S.btnEdit}>แก้ไข</button>
                <button onClick={() => handleRemove(p.id, p.name)} style={S.btnDel}>ลบ</button>
              </div>
              {editId === p.id && (
                <div style={S.editBox}>
                  <div style={S.group}>
                    <label style={S.label}>ประเภท</label>
                    <select value={editType} onChange={e => setEditType(e.target.value)} style={S.select}>
                      {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div style={S.grid2}>
                    <div style={S.group}>
                      <label style={S.label}>ชื่อบัตร</label>
                      <input value={editName} onChange={e => setEditName(e.target.value)} style={S.input} />
                    </div>
                    <div style={S.group}>
                      <label style={S.label}>4 ตัวท้าย</label>
                      <input value={editLast4} onChange={e => setEditLast4(e.target.value.replace(/\D/g,'').slice(0,4))} maxLength={4} style={S.input} />
                    </div>
                  </div>
                  <div style={S.group}>
                    <label style={S.label}>เจ้าของ</label>
                    <OwnerSelect value={editOwner} onChange={setEditOwner} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={cancelEdit} style={S.btnCan}>ยกเลิก</button>
                    <button onClick={() => handleEdit(p.id)} style={S.btnSave} disabled={saving}>บันทึก</button>
                  </div>
                </div>
              )}
            </div>
          ))
        }

        <div style={S.divider} />
        <div style={S.section}>เพิ่มวิธีชำระใหม่</div>
        <div style={S.group}>
          <label style={S.label}>ประเภท</label>
          <select value={newType} onChange={e => setNewType(e.target.value)} style={S.select}>
            {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div style={S.grid2}>
          <div style={S.group}>
            <label style={S.label}>ชื่อบัตร / วิธีชำระ</label>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="เช่น KBank Visa" style={S.input} />
          </div>
          <div style={S.group}>
            <label style={S.label}>เลข 4 ตัวท้าย</label>
            <input value={newLast4} onChange={e => setNewLast4(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="1234" maxLength={4} style={S.input} />
          </div>
        </div>
        <div style={S.group}>
          <label style={S.label}>เจ้าของ</label>
          <OwnerSelect value={newOwner} onChange={setNewOwner} />
        </div>
        <button onClick={handleAdd} style={S.btnAdd} disabled={saving}>
          {saving ? 'กำลังเพิ่ม...' : '+ เพิ่มวิธีชำระ'}
        </button>
      </div>
    <BottomNav />
    </div>
  )
}
