import { useState, useEffect } from 'react'
import { fetchSheet, todayISO, GAS_URL } from './utils'

const S = {
  wrap:    { maxWidth: 480, margin: '0 auto', padding: '0 0 80px', fontFamily: 'system-ui,sans-serif' },
  header:  { background: '#1D9E75', color: '#fff', padding: '16px 20px', marginBottom: 0 },
  htitle:  { fontSize: 18, fontWeight: 700, margin: 0 },
  hsub:    { fontSize: 13, opacity: 0.8, marginTop: 4 },
  body:    { padding: '16px 20px' },
  group:   { marginBottom: 16 },
  label:   { fontSize: 13, color: '#555', marginBottom: 6, display: 'block', fontWeight: 600 },
  input:   { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e0e0d8', fontSize: 15, outline: 'none', boxSizing: 'border-box' },
  select:  { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e0e0d8', fontSize: 15, background: '#fff', boxSizing: 'border-box' },
  grid2:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  chip:    { padding: '8px 12px', borderRadius: 20, border: '1.5px solid #e0e0d8', fontSize: 13, cursor: 'pointer', background: '#fff', textAlign: 'center' },
  chipSel: { padding: '8px 12px', borderRadius: 20, border: '1.5px solid #1D9E75', fontSize: 13, cursor: 'pointer', background: '#e8f7f2', color: '#0F6E56', textAlign: 'center', fontWeight: 600 },
  footer:  { position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 20px', background: '#fff', borderTop: '1px solid #eee' },
  btnSave: { width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: '#1D9E75', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer' },
  btnDis:  { width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: '#ccc', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'not-allowed' },
  toast:   { position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', color: '#fff', padding: '10px 20px', borderRadius: 20, fontSize: 14, zIndex: 999 },
  err:     { color: '#D85A30', fontSize: 12, marginTop: 4 },
}

export default function AddTransaction() {
  const [date,       setDate]       = useState(todayISO())
  const [name,       setName]       = useState('')
  const [amount,     setAmount]     = useState('')
  const [category,   setCategory]   = useState('')
  const [payer,      setPayer]      = useState('')
  const [paymentId,  setPaymentId]  = useState('')
  const [note,       setNote]       = useState('')

  const [categories, setCategories] = useState([])
  const [members,    setMembers]    = useState([])
  const [payments,   setPayments]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [toast,      setToast]      = useState('')
  const [errors,     setErrors]     = useState({})

  useEffect(() => {
    Promise.all([
      fetchSheet('categories'),
      fetchSheet('members'),
      fetchSheet('payment_methods'),
    ]).then(([cats, mems, pays]) => {
      setCategories(cats.filter(c => c.active === 'TRUE'))
      setMembers(mems.filter(m => m.active === 'TRUE'))
      setPayments(pays.filter(p => p.active === 'TRUE'))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const validate = () => {
    const e = {}
    if (!name.trim())    e.name    = 'กรุณาใส่ชื่อรายการ'
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) e.amount = 'กรุณาใส่จำนวนเงิน'
    if (!category)       e.category = 'กรุณาเลือกหมวดหมู่'
    if (!payer)          e.payer    = 'กรุณาเลือกผู้จ่าย'
    if (!paymentId)      e.payment  = 'กรุณาเลือกวิธีชำระ'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const res = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addTransaction',
          date, name: name.trim(), category,
          type: 'expense', amount: parseFloat(amount),
          payer, paymentId, note: note.trim()
        })
      })
      const data = await res.json()
      if (data.status === 'ok') {
        showToast('✅ บันทึกเรียบร้อยแล้ว!')
        setTimeout(() => {
          if (window.liff && window.liff.isInClient()) window.liff.closeWindow()
          else { setName(''); setAmount(''); setCategory(''); setPayer(''); setPaymentId(''); setNote('') }
        }, 1200)
      } else {
        showToast('❌ เกิดข้อผิดพลาด กรุณาลองใหม่')
      }
    } catch {
      showToast('❌ เชื่อมต่อไม่ได้ กรุณาลองใหม่')
    }
    setSaving(false)
  }

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const canSave = name && amount && category && payer && paymentId && !saving

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>กำลังโหลด...</div>

  return (
    <div style={S.wrap}>
      {toast && <div style={S.toast}>{toast}</div>}

      <div style={S.header}>
        <div style={S.htitle}>➕ เพิ่มรายการ</div>
        <div style={S.hsub}>กรอกข้อมูลแล้วกด Save</div>
      </div>

      <div style={S.body}>

        {/* วันที่ */}
        <div style={S.group}>
          <label style={S.label}>📅 วันที่</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={S.input} />
        </div>

        {/* ชื่อรายการ */}
        <div style={S.group}>
          <label style={S.label}>🏪 ชื่อรายการ</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="เช่น ค่าข้าว, Netflix" style={{ ...S.input, borderColor: errors.name ? '#D85A30' : '#e0e0d8' }} />
          {errors.name && <div style={S.err}>{errors.name}</div>}
        </div>

        {/* จำนวนเงิน */}
        <div style={S.group}>
          <label style={S.label}>💰 จำนวนเงิน (บาท)</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="0" inputMode="decimal"
            style={{ ...S.input, borderColor: errors.amount ? '#D85A30' : '#e0e0d8', fontSize: 18, fontWeight: 600 }} />
          {errors.amount && <div style={S.err}>{errors.amount}</div>}
        </div>

        {/* หมวดหมู่ */}
        <div style={S.group}>
          <label style={S.label}>🏷 หมวดหมู่ {errors.category && <span style={{ color: '#D85A30' }}>*</span>}</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {categories.map(c => (
              <button key={c.id} onClick={() => setCategory(c.name)}
                style={category === c.name ? S.chipSel : S.chip}>
                {c.icon} {c.name}
              </button>
            ))}
          </div>
          {errors.category && <div style={S.err}>{errors.category}</div>}
        </div>

        {/* ผู้จ่าย */}
        <div style={S.group}>
          <label style={S.label}>👤 ผู้จ่าย {errors.payer && <span style={{ color: '#D85A30' }}>*</span>}</label>
          <div style={S.grid2}>
            {members.map(m => (
              <button key={m.id} onClick={() => setPayer(m.name)}
                style={payer === m.name ? { ...S.chipSel, borderRadius: 8 } : { ...S.chip, borderRadius: 8 }}>
                {m.name}
              </button>
            ))}
          </div>
          {errors.payer && <div style={S.err}>{errors.payer}</div>}
        </div>

        {/* วิธีชำระ */}
        <div style={S.group}>
          <label style={S.label}>💳 วิธีชำระเงิน {errors.payment && <span style={{ color: '#D85A30' }}>*</span>}</label>
          <select value={paymentId} onChange={e => setPaymentId(e.target.value)}
            style={{ ...S.select, borderColor: errors.payment ? '#D85A30' : '#e0e0d8' }}>
            <option value="">-- เลือกวิธีชำระ --</option>
            {payments.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}{p.last4 ? ` ···${p.last4}` : ''} ({p.owner})
              </option>
            ))}
          </select>
          {errors.payment && <div style={S.err}>{errors.payment}</div>}
        </div>

        {/* หมายเหตุ */}
        <div style={S.group}>
          <label style={S.label}>📝 หมายเหตุ (ไม่บังคับ)</label>
          <input type="text" value={note} onChange={e => setNote(e.target.value)}
            placeholder="หมายเหตุเพิ่มเติม" style={S.input} />
        </div>

      </div>

      <div style={S.footer}>
        <button onClick={handleSave} style={canSave ? S.btnSave : S.btnDis} disabled={!canSave}>
          {saving ? 'กำลังบันทึก...' : '✅ Save'}
        </button>
      </div>
    </div>
  )
}
