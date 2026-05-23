import { useState, useEffect } from 'react'
import { fetchSheet, sendToGAS, todayISO, GAS_URL } from './utils'

const S = {
  wrap:    { maxWidth: 480, margin: '0 auto', padding: '0 0 130px', fontFamily: 'system-ui,sans-serif' },
  header:  { color: '#fff', padding: '16px 20px' },
  htitle:  { fontSize: 18, fontWeight: 700, margin: 0 },
  hsub:    { fontSize: 13, opacity: 0.8, marginTop: 4 },
  body:    { padding: '16px 20px' },
  group:   { marginBottom: 16 },
  label:   { fontSize: 13, color: '#555', marginBottom: 6, display: 'block', fontWeight: 600 },
  input:   { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e0e0d8', fontSize: 15, outline: 'none', boxSizing: 'border-box' },
  select:  { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e0e0d8', fontSize: 15, background: '#fff', boxSizing: 'border-box' },
  chip:    { padding: '8px 12px', borderRadius: 20, border: '1.5px solid #e0e0d8', fontSize: 13, cursor: 'pointer', background: '#fff', textAlign: 'center' },
  chipSel: { padding: '8px 12px', borderRadius: 20, border: '1.5px solid #1D9E75', fontSize: 13, cursor: 'pointer', background: '#e8f7f2', color: '#0F6E56', textAlign: 'center', fontWeight: 600 },
  chipOrg: { padding: '8px 12px', borderRadius: 20, border: '1.5px solid #BA7517', fontSize: 13, cursor: 'pointer', background: '#fff8e6', color: '#7A4D00', textAlign: 'center', fontWeight: 600 },
  grid2:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  footer:  { position: 'fixed', bottom: 60, left: 0, right: 0, padding: '12px 20px', background: '#fff', borderTop: '1px solid #eee' },
  btnSave: { width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: '#1D9E75', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer' },
  btnOrg:  { width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: '#BA7517', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer' },
  btnDis:  { width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: '#ccc', color: '#fff', fontSize: 16, fontWeight: 700 },
  toast:   { position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', color: '#fff', padding: '10px 20px', borderRadius: 20, fontSize: 14, zIndex: 999, whiteSpace: 'nowrap' },
  err:     { color: '#D85A30', fontSize: 12, marginTop: 4 },
  tab:     { flex: 1, padding: '10px', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', borderBottom: '2px solid transparent' },
  tabAct:  { flex: 1, padding: '10px', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', borderBottom: '2px solid currentColor' },
}


// DatePicker — ใช้ select dropdown แทน input[type=date] เพราะ LIFF บน Line บล็อก
function DatePicker({ value, onChange }) {
  const now = new Date()
  const toISO = (y, m, d) => `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`

  // parse value
  const [selY, selM, selD] = value ? value.split('-').map(Number) : [now.getFullYear(), now.getMonth()+1, now.getDate()]

  const years  = [now.getFullYear() - 1, now.getFullYear()]
  const months = Array.from({length: 12}, (_, i) => i + 1)
  const daysInMonth = new Date(selY, selM, 0).getDate()
  const days   = Array.from({length: daysInMonth}, (_, i) => i + 1)

  const thMonths = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']

  const handleChange = (y, m, d) => {
    const maxD = new Date(y, m, 0).getDate()
    onChange(toISO(y, m, Math.min(d, maxD)))
  }

  // quick buttons
  const today     = toISO(now.getFullYear(), now.getMonth()+1, now.getDate())
  const yesterday = (() => { const d = new Date(now); d.setDate(d.getDate()-1); return toISO(d.getFullYear(), d.getMonth()+1, d.getDate()) })()
  const twoDays   = (() => { const d = new Date(now); d.setDate(d.getDate()-2); return toISO(d.getFullYear(), d.getMonth()+1, d.getDate()) })()

  const selStyle  = { flex:1, padding:'7px 4px', borderRadius:8, border:'1.5px solid #1D9E75', background:'#e8f7f2', color:'#0F6E56', fontSize:12, fontWeight:700, cursor:'pointer' }
  const normStyle = { flex:1, padding:'7px 4px', borderRadius:8, border:'1.5px solid #e0e0d8', background:'#fff', color:'#555', fontSize:12, cursor:'pointer' }
  const selEl = { padding:'9px 4px', borderRadius:8, border:'1.5px solid #e0e0d8', fontSize:14, background:'#fff', flex:1 }

  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:8 }}>
        <select value={selD} onChange={e => handleChange(selY, selM, Number(e.target.value))} style={selEl}>
          {days.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={selM} onChange={e => handleChange(selY, Number(e.target.value), selD)} style={selEl}>
          {months.map(m => <option key={m} value={m}>{thMonths[m-1]}</option>)}
        </select>
        <select value={selY} onChange={e => handleChange(Number(e.target.value), selM, selD)} style={selEl}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <div style={{ display:'flex', gap:8 }}>
        {[{label:'วันนี้', val:today},{label:'เมื่อวาน', val:yesterday},{label:'2 วันก่อน', val:twoDays}].map(q => (
          <button key={q.val} onClick={() => onChange(q.val)}
            style={value === q.val ? selStyle : normStyle}>
            {q.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function AddTransaction() {
  const [tab,        setTab]        = useState('expense') // 'expense' | 'direct'
  // expense fields
  const [date,       setDate]       = useState(todayISO())
  const [name,       setName]       = useState('')
  const [amount,     setAmount]     = useState('')
  const [category,   setCategory]   = useState('')
  const [payer,      setPayer]      = useState('')
  const [paymentId,  setPaymentId]  = useState('')
  const [note,       setNote]       = useState('')
  // direct debt fields
  const [dDate,      setDDate]      = useState(todayISO())
  const [dFrom,      setDFrom]      = useState('')
  const [dTo,        setDTo]        = useState('')
  const [dAmount,    setDAmount]    = useState('')
  const [dNote,      setDNote]      = useState('')
  // shared
  const [categories, setCategories] = useState([])
  const [members,    setMembers]    = useState([])
  const [payments,   setPayments]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [toast,      setToast]      = useState('')
  const [errors,     setErrors]     = useState({})

  useEffect(() => {
    Promise.all([fetchSheet('categories'), fetchSheet('members'), fetchSheet('payment_methods')])
      .then(([cats, mems, pays]) => {
        const sortByOrder = (arr) => [...arr].sort((a, b) => (parseInt(a.order) || 999) - (parseInt(b.order) || 999))
        setCategories(sortByOrder(cats.filter(c => c.active === 'TRUE')))
        setMembers(sortByOrder(mems.filter(m => m.active === 'TRUE')))
        setPayments(sortByOrder(pays.filter(p => p.active === 'TRUE')))
        setLoading(false)
      }).catch(() => setLoading(false))
  }, [])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const validate = () => {
    const e = {}
    if (!name.trim())  e.name     = 'กรุณาใส่ชื่อรายการ'
    if (!amount || parseFloat(amount) <= 0) e.amount = 'กรุณาใส่จำนวนเงิน'
    if (!category)     e.category = 'กรุณาเลือกหมวดหมู่'
    if (!payer)        e.payer    = 'กรุณาเลือกผู้จ่าย'
    if (!paymentId)    e.payment  = 'กรุณาเลือกวิธีชำระ'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const validateDirect = () => {
    const e = {}
    if (!dFrom)                              e.from   = 'กรุณาเลือกผู้เป็นหนี้'
    if (!dTo)                                e.to     = 'กรุณาเลือกผู้รับเงิน'
    if (dFrom && dTo && dFrom === dTo)       e.to     = 'ต้องเป็นคนละคนกัน'
    if (!dAmount || parseFloat(dAmount) <= 0) e.amount = 'กรุณาใส่จำนวนเงิน'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSaveExpense = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const data = await sendToGAS({
        action: 'addTransaction', date, name: name.trim(),
        category, type: 'expense', amount: parseFloat(amount),
        payer, paymentId, note: note.trim()
      })
      if (data.status === 'ok') {
        showToast('✅ บันทึกเรียบร้อยแล้ว!')
        setTimeout(() => {
          setName(''); setAmount(''); setCategory(''); setPayer(''); setPaymentId(''); setNote('')
          setErrors({})
        }, 1200)
      } else showToast('❌ ' + (data.message || 'เกิดข้อผิดพลาด'))
    } catch (e) { showToast('❌ เชื่อมต่อไม่ได้') }
    setSaving(false)
  }

  const handleSaveDirect = async () => {
    if (!validateDirect()) return
    setSaving(true)
    try {
      const data = await sendToGAS({
        action: 'addTransaction', date: dDate,
        name: dNote.trim() || 'หนี้โดยตรง',
        category: '-', type: 'direct',
        amount: parseFloat(dAmount),
        payer: dFrom, paymentId: '', note: dNote.trim(), to: dTo
      })
      if (data.status === 'ok') {
        showToast('✅ บันทึกหนี้เรียบร้อยแล้ว!')
        setTimeout(() => { setDFrom(''); setDTo(''); setDAmount(''); setDNote(''); setErrors({}) }, 1200)
      } else showToast('❌ ' + (data.message || 'เกิดข้อผิดพลาด'))
    } catch (e) { showToast('❌ เชื่อมต่อไม่ได้') }
    setSaving(false)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>กำลังโหลด...</div>

  return (
    <div style={S.wrap}>
      {toast && <div style={S.toast}>{toast}</div>}

      {/* TABS */}
      <div style={{ display: 'flex', borderBottom: '1px solid #eee', background: '#fff' }}>
        <button onClick={() => { setTab('expense'); setErrors({}) }}
          style={{ ...( tab === 'expense' ? S.tabAct : S.tab), color: tab === 'expense' ? '#1D9E75' : '#999', background: 'none' }}>
          ➕ รายจ่ายปกติ
        </button>
        <button onClick={() => { setTab('direct'); setErrors({}) }}
          style={{ ...(tab === 'direct' ? S.tabAct : S.tab), color: tab === 'direct' ? '#BA7517' : '#999', background: 'none' }}>
          💸 หนี้โดยตรง
        </button>
      </div>

      {/* ===== TAB: EXPENSE ===== */}
      {tab === 'expense' && <>
        <div style={{ ...S.header, background: '#1D9E75' }}>
          <div style={S.htitle}>➕ เพิ่มรายจ่าย</div>
          <div style={S.hsub}>กรอกข้อมูลแล้วกด Save</div>
        </div>
        <div style={S.body}>
          <div style={S.group}>
            <label style={S.label}>📅 วันที่</label>
            <DatePicker value={date} onChange={setDate} />
          </div>
          <div style={S.group}>
            <label style={S.label}>🏪 ชื่อรายการ</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="เช่น ค่าข้าว, Netflix"
              style={{ ...S.input, borderColor: errors.name ? '#D85A30' : '#e0e0d8' }} />
            {errors.name && <div style={S.err}>{errors.name}</div>}
          </div>
          <div style={S.group}>
            <label style={S.label}>💰 จำนวนเงิน (บาท)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="0" inputMode="decimal"
              style={{ ...S.input, borderColor: errors.amount ? '#D85A30' : '#e0e0d8', fontSize: 18, fontWeight: 600 }} />
            {errors.amount && <div style={S.err}>{errors.amount}</div>}
          </div>
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
          <div style={S.group}>
            <label style={S.label}>📝 หมายเหตุ (ไม่บังคับ)</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)}
              placeholder="หมายเหตุเพิ่มเติม" style={S.input} />
          </div>
        </div>
        <div style={S.footer}>
          <button onClick={handleSaveExpense} style={saving ? S.btnDis : S.btnSave} disabled={saving}>
            {saving ? 'กำลังบันทึก...' : '✅ Save'}
          </button>
        </div>
      </>}

      {/* ===== TAB: DIRECT DEBT ===== */}
      {tab === 'direct' && <>
        <div style={{ ...S.header, background: '#BA7517' }}>
          <div style={S.htitle}>💸 หนี้โดยตรง</div>
          <div style={S.hsub}>รายการที่ไม่ต้องหาร คิดเต็มจำนวน</div>
        </div>
        <div style={S.body}>
          <div style={S.group}>
            <label style={S.label}>📅 วันที่</label>
            <DatePicker value={dDate} onChange={setDDate} />
          </div>

          {/* From → To แบบ visual */}
          <div style={{ background: '#fff8e6', borderRadius: 12, padding: '14px 16px', marginBottom: 16, border: '1px solid #f0d080' }}>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 10, fontWeight: 600 }}>ใครเป็นหนี้ใคร?</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>ผู้เป็นหนี้</div>
                <div style={S.grid2}>
                  {members.map(m => (
                    <button key={m.id} onClick={() => setDFrom(m.name)}
                      style={dFrom === m.name ? { ...S.chipOrg, borderRadius: 8 } : { ...S.chip, borderRadius: 8 }}>
                      {m.name}
                    </button>
                  ))}
                </div>
                {errors.from && <div style={S.err}>{errors.from}</div>}
              </div>
              <div style={{ fontSize: 20, color: '#BA7517', flexShrink: 0, paddingTop: 16 }}>→</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>ผู้รับเงิน</div>
                <div style={S.grid2}>
                  {members.map(m => (
                    <button key={m.id} onClick={() => setDTo(m.name)}
                      style={dTo === m.name ? { ...S.chipSel, borderRadius: 8 } : { ...S.chip, borderRadius: 8 }}>
                      {m.name}
                    </button>
                  ))}
                </div>
                {errors.to && <div style={S.err}>{errors.to}</div>}
              </div>
            </div>
          </div>

          <div style={S.group}>
            <label style={S.label}>💰 จำนวนเงิน (บาท)</label>
            <input type="number" value={dAmount} onChange={e => setDAmount(e.target.value)}
              placeholder="0" inputMode="decimal"
              style={{ ...S.input, borderColor: errors.amount ? '#D85A30' : '#e0e0d8', fontSize: 18, fontWeight: 600 }} />
            {errors.amount && <div style={S.err}>{errors.amount}</div>}
          </div>
          <div style={S.group}>
            <label style={S.label}>📝 รายละเอียด (ไม่บังคับ)</label>
            <input type="text" value={dNote} onChange={e => setDNote(e.target.value)}
              placeholder="เช่น ค่าของที่ซื้อแทน" style={S.input} />
          </div>

          {/* Preview */}
          {dFrom && dTo && dAmount && (
            <div style={{ background: '#f0faf5', borderRadius: 10, padding: '12px 14px', marginBottom: 8, border: '1px solid #a8dfc4' }}>
              <div style={{ fontSize: 13, color: '#1D9E75', fontWeight: 600 }}>
                {dFrom} เป็นหนี้ {dTo} จำนวน ฿{parseFloat(dAmount).toLocaleString()}
              </div>
              {dNote && <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{dNote}</div>}
            </div>
          )}
        </div>
        <div style={S.footer}>
          <button onClick={handleSaveDirect} style={saving ? S.btnDis : S.btnOrg} disabled={saving}>
            {saving ? 'กำลังบันทึก...' : '💸 บันทึกหนี้'}
          </button>
        </div>
      </>}
    </div>
  )
}
