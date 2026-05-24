import { useState, useEffect } from 'react'
import { fetchSheet, sendToGAS, todayISO, GAS_URL, initLiff } from './utils'

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


// DatePicker — ใช้ div+onTouchEnd แทน button+onClick เพราะ LIFF Android บล็อก onClick
function DatePicker({ value, onChange }) {
  const now     = new Date()
  const toISO   = (y, m, d) => `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  const parsed  = value ? value.split('-').map(Number) : [now.getFullYear(), now.getMonth()+1, now.getDate()]
  const [selY, selM, selD] = parsed
  const [showCal, setShowCal] = useState(false)
  const [viewY,   setViewY]   = useState(selY)
  const [viewM,   setViewM]   = useState(selM)

  const thMonths  = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
  const thDays    = ['อา','จ','อ','พ','พฤ','ศ','ส']
  const today     = toISO(now.getFullYear(), now.getMonth()+1, now.getDate())
  const yesterday = (() => { const d=new Date(now); d.setDate(d.getDate()-1); return toISO(d.getFullYear(),d.getMonth()+1,d.getDate()) })()
  const twoDays   = (() => { const d=new Date(now); d.setDate(d.getDate()-2); return toISO(d.getFullYear(),d.getMonth()+1,d.getDate()) })()

  const daysInMonth = new Date(viewY, viewM, 0).getDate()
  const firstDay    = new Date(viewY, viewM - 1, 1).getDay()

  // ใช้ onTouchEnd + onClick ทั้งคู่เพื่อรองรับ LIFF ทุก platform
  const tap = (fn) => ({ onClick: fn, onTouchEnd: (e) => { e.preventDefault(); fn(e) } })

  const prevMonth = () => { if (viewM===1){setViewM(12);setViewY(y=>y-1)}else setViewM(m=>m-1) }
  const nextMonth = () => { if (viewM===12){setViewM(1);setViewY(y=>y+1)}else setViewM(m=>m+1) }

  const selectDay = (d) => { onChange(toISO(viewY, viewM, d)); setShowCal(false) }
  const displayDate = value ? `${selD} ${thMonths[selM-1]} ${selY}` : 'เลือกวันที่'

  const tapStyle  = { WebkitTapHighlightColor:'transparent', userSelect:'none', cursor:'pointer' }
  const qActive   = { flex:1, padding:'9px 4px', borderRadius:8, border:'1.5px solid #1D9E75', background:'#e8f7f2', color:'#0F6E56', fontSize:13, fontWeight:700, textAlign:'center', ...tapStyle }
  const qNormal   = { flex:1, padding:'9px 4px', borderRadius:8, border:'1.5px solid #e0e0d8', background:'#fff', color:'#555', fontSize:13, textAlign:'center', ...tapStyle }

  return (
    <div style={{ position:'relative' }}>

      {/* Display button — div ไม่ใช่ button */}
      <div {...tap(() => setShowCal(s => !s))}
        style={{ width:'100%', padding:'11px 14px', borderRadius:8, border:`1.5px solid ${showCal?'#1D9E75':'#e0e0d8'}`, background:'#fff', fontSize:15, display:'flex', justifyContent:'space-between', alignItems:'center', boxSizing:'border-box', ...tapStyle }}>
        <span>📅 {displayDate}</span>
        <span style={{ fontSize:12, color:'#888' }}>{showCal ? '▲' : '▼'}</span>
      </div>

      {/* Quick select */}
      <div style={{ display:'flex', gap:8, marginTop:8 }}>
        {[{l:'วันนี้',v:today},{l:'เมื่อวาน',v:yesterday},{l:'2 วันก่อน',v:twoDays}].map(q => (
          <div key={q.v} {...tap(() => { onChange(q.v); setShowCal(false) })}
            style={value===q.v ? qActive : qNormal}>
            {q.l}
          </div>
        ))}
      </div>

      {/* Calendar */}
      {showCal && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:9999, background:'#fff', border:'1.5px solid #e0e0d8', borderRadius:12, padding:12, marginTop:4, boxShadow:'0 8px 32px rgba(0,0,0,0.15)' }}>

          {/* Month nav */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <div {...tap(prevMonth)} style={{ padding:'6px 16px', border:'1px solid #e0e0d8', borderRadius:8, background:'#f8f8f8', fontSize:18, ...tapStyle }}>‹</div>
            <span style={{ fontWeight:700, fontSize:15 }}>{thMonths[viewM-1]} {viewY}</span>
            <div {...tap(nextMonth)} style={{ padding:'6px 16px', border:'1px solid #e0e0d8', borderRadius:8, background:'#f8f8f8', fontSize:18, ...tapStyle }}>›</div>
          </div>

          {/* Day headers */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:4 }}>
            {thDays.map(d => <div key={d} style={{ textAlign:'center', fontSize:11, color:'#888', padding:'2px 0' }}>{d}</div>)}
          </div>

          {/* Days */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3 }}>
            {Array.from({length:firstDay}).map((_,i) => <div key={'e'+i} />)}
            {Array.from({length:daysInMonth},(_,i)=>i+1).map(d => {
              const iso = toISO(viewY, viewM, d)
              const isSel   = iso === value
              const isToday = iso === today
              return (
                <div key={d} {...tap(() => selectDay(d))}
                  style={{ padding:'8px 2px', borderRadius:8, background: isSel?'#1D9E75': isToday?'#e8f7f2':'transparent', color: isSel?'#fff': isToday?'#0F6E56':'#222', fontWeight: isSel||isToday?700:400, fontSize:14, textAlign:'center', ...tapStyle }}>
                  {d}
                </div>
              )
            })}
          </div>

          {/* Close */}
          <div {...tap(() => setShowCal(false))}
            style={{ marginTop:12, padding:'9px', border:'1px solid #e0e0d8', borderRadius:8, background:'#f8f8f8', color:'#555', fontSize:13, textAlign:'center', ...tapStyle }}>
            ปิด
          </div>
        </div>
      )}
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

  useEffect(() => { initLiff('add') }, [])

  useEffect(() => {
    // ดึงข้อมูลผ่าน GAS เพื่อรองรับ LIFF WebView ที่บล็อก Google Sheets API โดยตรง
    const sortByOrder = (arr) => [...arr].sort((a, b) => (parseInt(a.order) || 999) - (parseInt(b.order) || 999))
    const loadFromGAS = async () => {
      try {
        const [catsRes, memsRes, paysRes] = await Promise.all([
          fetch(`${GAS_URL}?action=getCategories`).then(r => r.json()),
          fetch(`${GAS_URL}?action=getMembers`).then(r => r.json()),
          fetch(`${GAS_URL}?action=getPayments`).then(r => r.json()),
        ])
        if (catsRes.status === 'ok') setCategories(sortByOrder(catsRes.data))
        if (memsRes.status === 'ok') setMembers(sortByOrder(memsRes.data))
        if (paysRes.status === 'ok') setPayments(sortByOrder(paysRes.data))
      } catch {
        // fallback ไป fetchSheet ถ้า GAS ไม่มี endpoint นี้
        try {
          const [cats, mems, pays] = await Promise.all([
            fetchSheet('categories'), fetchSheet('members'), fetchSheet('payment_methods')
          ])
          setCategories(sortByOrder(cats.filter(c => c.active === 'TRUE')))
          setMembers(sortByOrder(mems.filter(m => m.active === 'TRUE')))
          setPayments(sortByOrder(pays.filter(p => p.active === 'TRUE' || p.active === true)))
        } catch {}
      }
      setLoading(false)
    }
    loadFromGAS()
  }, [])

  // DEBUG: แสดงจำนวน payments ที่โหลดได้ — ลบออกหลัง debug
  useEffect(() => {
    if (!loading) {
      setToast(`payments: ${payments.length} | cats: ${categories.length} | mems: ${members.length}`)
    }
  }, [loading])

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

    // ตรวจสอบรายการซ้ำ — เช็ค date + amount + payment_id
    try {
      const pm = payments.find(p => p.id === paymentId)
      const pmLabel = pm ? `${pm.name}${pm.last4 ? ' ···' + pm.last4 : ''} (${pm.owner})` : ''
      const mm = date.substring(5,7), yyyy = date.substring(0,4)
      const monthKey = `${mm}-${yyyy}`
      const checkRes = await fetch(
        `${GAS_URL}?action=checkDuplicate` +
        `&date=${encodeURIComponent(date)}` +
        `&amount=${encodeURIComponent(amount)}` +
        `&payment_id=${encodeURIComponent(pmLabel)}` +
        `&month=${monthKey}`
      )
      const checkData = await checkRes.json()
      if (checkData.status === 'found' && checkData.items && checkData.items.length > 0) {
        setDupItems(checkData.items)
        return
      }
    } catch (e) { console.warn('dup check error', e) }

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

  const confirmSave = async () => {
    setDupItems([])
    setSaving(true)
    try {
      const data = await sendToGAS({
        action: 'addTransaction', date, name: name.trim(),
        category, type: 'expense', amount: parseFloat(amount),
        payer, paymentId, note: note.trim()
      })
      if (data.status === 'ok') {
        setToast(lang === 'th' ? '✅ บันทึกแล้ว!' : '✅ Saved!')
        setTimeout(() => { setName(''); setAmount(''); setCategory(''); setPayer(''); setPaymentId(''); setNote('') }, 1200)
      } else { setToast('❌ ' + (data.message || 'Error')) }
    } catch(e) { setToast('❌ ' + e.message) }
    setSaving(false)
  }

  return (
    <div style={S.wrap}>

      {/* Duplicate Warning Modal */}
      {dupItems.length > 0 && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:'#fff', borderRadius:16, padding:20, width:'100%', maxWidth:420 }}>
            <div style={{ fontSize:16, fontWeight:700, color:'#D85A30', marginBottom:8 }}>⚠️ พบรายการที่คล้ายกัน</div>
            <div style={{ fontSize:13, color:'#666', marginBottom:12 }}>มีรายการที่มีวันที่ จำนวนเงิน และบัตรตรงกันอยู่แล้ว:</div>
            {dupItems.map((item, i) => (
              <div key={i} style={{ background:'#fff9f7', border:'1px solid #f5c4b3', borderRadius:8, padding:'10px 12px', marginBottom:8 }}>
                <div style={{ fontWeight:600, fontSize:14 }}>{item.name}</div>
                <div style={{ color:'#888', fontSize:12, marginTop:3 }}>{item.date} · ฿{Number(item.amount).toLocaleString()} · {item.payment_id}</div>
              </div>
            ))}
            <div style={{ display:'flex', gap:10, marginTop:16 }}>
              <label onClick={() => setDupItems([])}
                style={{ flex:1, padding:'12px', borderRadius:10, border:'1.5px solid #e0e0d8', background:'#fff', fontSize:14, textAlign:'center', cursor:'pointer', color:'#555', fontWeight:600 }}>
                ❌ ยกเลิก
              </label>
              <label onClick={confirmSave}
                style={{ flex:1, padding:'12px', borderRadius:10, background:'#1D9E75', fontSize:14, textAlign:'center', cursor:'pointer', color:'#fff', fontWeight:700 }}>
                ✅ ยืนยันบันทึก
              </label>
            </div>
          </div>
        </div>
      )}
      {toast && <div style={S.toast}>{toast}</div>}

      {/* TABS */}
      <div style={{ display: 'flex', borderBottom: '1px solid #eee', background: '#fff' }}>
        <button onClick={() => { setTab('expense'); setErrors({}) }} onTouchEnd={e => { e.preventDefault(); setTab('expense'); setErrors({}) }}
          style={{ ...( tab === 'expense' ? S.tabAct : S.tab), color: tab === 'expense' ? '#1D9E75' : '#999', background: 'none' }}>
          ➕ รายจ่ายปกติ
        </button>
        <button onClick={() => { setTab('direct'); setErrors({}) }} onTouchEnd={e => { e.preventDefault(); setTab('direct'); setErrors({}) }}
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
                <label key={c.id} style={category === c.name ? {...S.chipSel, WebkitTapHighlightColor:'transparent'} : {...S.chip, WebkitTapHighlightColor:'transparent'}}>
                  <input type="radio" name="category" value={c.name} checked={category===c.name} onChange={() => setCategory(c.name)}
                    style={{ position:'absolute', opacity:0, width:0, height:0 }} />
                  {c.icon} {c.name}
                </label>
              ))}
            </div>
            {errors.category && <div style={S.err}>{errors.category}</div>}
          </div>
          <div style={S.group}>
            <label style={S.label}>👤 ผู้จ่าย {errors.payer && <span style={{ color: '#D85A30' }}>*</span>}</label>
            <div style={S.grid2}>
              {members.map(m => (
                <label key={m.id} style={payer === m.name ? { ...S.chipSel, borderRadius:8, WebkitTapHighlightColor:'transparent' } : { ...S.chip, borderRadius:8, WebkitTapHighlightColor:'transparent' }}>
                  <input type="radio" name="payer" value={m.name} checked={payer===m.name} onChange={() => setPayer(m.name)}
                    style={{ position:'absolute', opacity:0, width:0, height:0 }} />
                  {m.name}
                </label>
              ))}
            </div>
            {errors.payer && <div style={S.err}>{errors.payer}</div>}
          </div>
          <div style={S.group}>
            <label style={S.label}>💳 วิธีชำระเงิน {errors.payment && <span style={{ color: '#D85A30' }}>*</span>}</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {payments.map(p => {
                const label = `${p.name}${p.last4 ? ` ···${p.last4}` : ''} (${p.owner})`
                const isSel = paymentId === p.id
                return (
                  <label key={p.id} style={{ display:'block', padding:'11px 14px', borderRadius:8, border:`1.5px solid ${isSel?'#1D9E75':'#e0e0d8'}`, background:isSel?'#e8f7f2':'#fff', color:isSel?'#0F6E56':'#333', fontWeight:isSel?700:400, fontSize:14, cursor:'pointer', WebkitTapHighlightColor:'transparent' }}>
                    <input type="radio" name="paymentId" value={p.id} checked={isSel} onChange={() => setPaymentId(p.id)}
                      style={{ position:'absolute', opacity:0, width:0, height:0 }} />
                    {isSel ? '✓ ' : ''}{label}
                  </label>
                )
              })}
            </div>
            {errors.payment && <div style={S.err}>{errors.payment}</div>}
          </div>
          <div style={S.group}>
            <label style={S.label}>📝 หมายเหตุ (ไม่บังคับ)</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)}
              placeholder="หมายเหตุเพิ่มเติม" style={S.input} />
          </div>
        </div>
        <div style={S.footer}>
          <button onClick={handleSaveExpense} onTouchEnd={e => { e.preventDefault(); if(!saving) handleSaveExpense() }} style={saving ? S.btnDis : S.btnSave} disabled={saving}>
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
                    <div key={m.id} onClick={() => setDFrom(m.name)}
                      onTouchEnd={e => { e.preventDefault(); setDFrom(m.name) }}
                      style={dFrom === m.name ? { ...S.chipOrg, borderRadius:8, WebkitTapHighlightColor:'transparent' } : { ...S.chip, borderRadius:8, WebkitTapHighlightColor:'transparent' }}>
                      {m.name}
                    </div>
                  ))}
                </div>
                {errors.from && <div style={S.err}>{errors.from}</div>}
              </div>
              <div style={{ fontSize: 20, color: '#BA7517', flexShrink: 0, paddingTop: 16 }}>→</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>ผู้รับเงิน</div>
                <div style={S.grid2}>
                  {members.map(m => (
                    <div key={m.id} onClick={() => setDTo(m.name)}
                      onTouchEnd={e => { e.preventDefault(); setDTo(m.name) }}
                      style={dTo === m.name ? { ...S.chipSel, borderRadius:8, WebkitTapHighlightColor:'transparent' } : { ...S.chip, borderRadius:8, WebkitTapHighlightColor:'transparent' }}>
                      {m.name}
                    </div>
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
          <button onClick={handleSaveDirect} onTouchEnd={e => { e.preventDefault(); if(!saving) handleSaveDirect() }} style={saving ? S.btnDis : S.btnOrg} disabled={saving}>
            {saving ? 'กำลังบันทึก...' : '💸 บันทึกหนี้'}
          </button>
        </div>
      </>}
    </div>
  )
}
