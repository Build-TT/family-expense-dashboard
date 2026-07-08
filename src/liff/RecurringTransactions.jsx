import { useEffect, useRef, useState } from 'react'
import { fetchSheet, sendToGAS, todayISO, GAS_URL, initLiff } from './utils'
import LangToggle from '../components/LangToggle.jsx'
import { getLang } from '../i18n'
import { getCache, setCache } from '../cache'

const S = {
  wrap: { maxWidth: 480, margin: '0 auto', padding: '0 0 130px', fontFamily: 'system-ui,sans-serif' },
  header: { color: '#fff', padding: '16px 20px', background: '#7F77DD' },
  htitle: { fontSize: 18, fontWeight: 700, margin: 0 },
  hsub: { fontSize: 13, opacity: 0.85, marginTop: 4 },
  body: { padding: '16px 20px' },
  group: { marginBottom: 16 },
  label: { fontSize: 13, color: '#555', marginBottom: 6, display: 'block', fontWeight: 600 },
  input: { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e0e0d8', fontSize: 15, outline: 'none', boxSizing: 'border-box', background: '#fff' },
  select: { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e0e0d8', fontSize: 15, background: '#fff', boxSizing: 'border-box' },
  chip: { padding: '8px 12px', borderRadius: 20, border: '1.5px solid #e0e0d8', fontSize: 13, cursor: 'pointer', background: '#fff', textAlign: 'center', WebkitTapHighlightColor: 'transparent' },
  chipSel: { padding: '8px 12px', borderRadius: 20, border: '1.5px solid #7F77DD', fontSize: 13, cursor: 'pointer', background: '#f0efff', color: '#4c45a5', textAlign: 'center', fontWeight: 600, WebkitTapHighlightColor: 'transparent' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  footer: { position: 'fixed', bottom: 60, left: 0, right: 0, padding: '12px 20px', background: '#fff', borderTop: '1px solid #eee' },
  btnSave: { width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: '#7F77DD', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer' },
  btnDis: { width: '100%', padding: '14px', borderRadius: 10, border: 'none', background: '#ccc', color: '#fff', fontSize: 16, fontWeight: 700, pointerEvents: 'none' },
  toast: { position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', color: '#fff', padding: '10px 20px', borderRadius: 20, fontSize: 14, zIndex: 999, whiteSpace: 'nowrap' },
  err: { color: '#D85A30', fontSize: 12, marginTop: 4 },
  card: { background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: '12px 14px', marginBottom: 10 },
}

const DAY_OPTIONS = Array.from({ length: 28 }, (_, i) => i + 1)

function addMonthsIso(date, months) {
  const [y, m, d] = date.split('-').map(Number)
  const next = new Date(y, m - 1 + months, 1)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function monthCount(startDate, endDate, dayOfMonth) {
  if (!startDate || !endDate || !dayOfMonth) return 0
  let count = 0
  let cursor = `${startDate.slice(0, 7)}-${String(dayOfMonth).padStart(2, '0')}`
  const last = endDate
  for (let guard = 0; guard < 240; guard += 1) {
    if (cursor >= startDate && cursor <= last) count += 1
    cursor = addMonthsIso(cursor, 1)
    if (cursor > last.slice(0, 7) + '-28') break
  }
  return count
}

function normalizeIsoDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? match[0] : ''
}

function parseLocalDate(value) {
  const iso = normalizeIsoDate(value)
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function addCalendarMonths(date, months) {
  const y = date.getFullYear()
  const m = date.getMonth() + months
  const d = date.getDate()
  const lastDay = new Date(y, m + 1, 0).getDate()
  return new Date(y, m, Math.min(d, lastDay))
}

function addCalendarYears(date, years) {
  const y = date.getFullYear() + years
  const m = date.getMonth()
  const d = date.getDate()
  const lastDay = new Date(y, m + 1, 0).getDate()
  return new Date(y, m, Math.min(d, lastDay))
}

function formatDateRangeDuration(startDate, endDate, lang) {
  const start = parseLocalDate(startDate)
  const end = parseLocalDate(endDate)
  if (!start || !end || end < start) return lang === 'en' ? '0 days' : '0 วัน'

  let years = end.getFullYear() - start.getFullYear()
  let cursor = addCalendarYears(start, years)
  if (cursor > end) {
    years -= 1
    cursor = addCalendarYears(start, years)
  }

  let months = (end.getFullYear() - cursor.getFullYear()) * 12 + (end.getMonth() - cursor.getMonth())
  let monthCursor = addCalendarMonths(cursor, months)
  if (monthCursor > end) {
    months -= 1
    monthCursor = addCalendarMonths(cursor, months)
  }

  const days = Math.floor((end - monthCursor) / (24 * 60 * 60 * 1000))
  if (lang === 'en') {
    const parts = []
    if (years) parts.push(`${years} ${years === 1 ? 'year' : 'years'}`)
    if (months) parts.push(`${months} ${months === 1 ? 'month' : 'months'}`)
    if (days) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`)
    return parts.length ? parts.join(' ') : '0 days'
  }
  const parts = []
  if (years) parts.push(`${years} ปี`)
  if (months) parts.push(`${months} เดือน`)
  if (days) parts.push(`${days} วัน`)
  return parts.length ? parts.join(' ') : '0 วัน'
}

function samePaymentLabel(a, b) {
  return String(a || '').replace(/\s+/g, ' ').trim() === String(b || '').replace(/\s+/g, ' ').trim()
}

export default function RecurringTransactions() {
  const [lang, setLang] = useState(getLang())
  const [categories, setCategories] = useState([])
  const [members, setMembers] = useState([])
  const [payments, setPayments] = useState([])
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [toast, setToast] = useState('')
  const [errors, setErrors] = useState({})
  const [editingId, setEditingId] = useState('')

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [payer, setPayer] = useState('')
  const [paymentId, setPaymentId] = useState('')
  const [note, setNote] = useState('')
  const [startDate, setStartDate] = useState(todayISO())
  const [endDate, setEndDate] = useState(addMonthsIso(todayISO(), 11))
  const [dayOfMonth, setDayOfMonth] = useState(String(Math.min(new Date().getDate(), 28)))
  const [applyMode, setApplyMode] = useState('future')

  useEffect(() => { initLiff('recurring') }, [])

  useEffect(() => {
    const h = () => setLang(getLang())
    window.addEventListener('langchange', h)
    return () => window.removeEventListener('langchange', h)
  }, [])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const sortByOrder = (arr) => [...arr].sort((a, b) => (parseInt(a.order) || 999) - (parseInt(b.order) || 999))

  const loadRefs = async () => {
    const cached = getCache('add_refs')
    if (cached) {
      setCategories(cached.cats)
      setMembers(cached.mems)
      setPayments(cached.pays)
      return
    }
    try {
      const [catsRes, memsRes, paysRes] = await Promise.all([
        fetch(`${GAS_URL}?action=getCategories`).then(r => r.json()),
        fetch(`${GAS_URL}?action=getMembers`).then(r => r.json()),
        fetch(`${GAS_URL}?action=getPayments`).then(r => r.json()),
      ])
      const cats = catsRes.status === 'ok' ? sortByOrder(catsRes.data) : []
      const mems = memsRes.status === 'ok' ? sortByOrder(memsRes.data) : []
      const pays = paysRes.status === 'ok' ? sortByOrder(paysRes.data) : []
      if (cats.length || mems.length || pays.length) {
        setCategories(cats); setMembers(mems); setPayments(pays)
        if (cats.length && mems.length) setCache('add_refs', { cats, mems, pays })
        return
      }
    } catch {}

    const [cats, mems, pays] = await Promise.all([
      fetchSheet('categories'), fetchSheet('members'), fetchSheet('payment_methods')
    ])
    const fc = sortByOrder(cats.filter(c => c.active === 'TRUE'))
    const fm = sortByOrder(mems.filter(m => m.active === 'TRUE'))
    const fp = sortByOrder(pays.filter(p => p.active === 'TRUE' || p.active === true))
    setCategories(fc); setMembers(fm); setPayments(fp)
    if (fc.length && fm.length) setCache('add_refs', { cats: fc, mems: fm, pays: fp })
  }

  const loadRules = async () => {
    try {
      const data = await sendToGAS({ action: 'getRecurringRules' })
      setRules(data.status === 'ok' && Array.isArray(data.data) ? data.data : [])
    } catch {
      setRules([])
    }
  }

  const load = async () => {
    setLoading(true)
    try {
      await Promise.all([loadRefs(), loadRules()])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const paymentLabel = (id = paymentId) => {
    const p = payments.find(x => x.id === id)
    if (!p) return ''
    return `${p.name}${p.last4 ? ` ···${p.last4}` : ''} (${p.owner || 'ร่วมกัน'})`
  }

  const resetForm = () => {
    setEditingId('')
    setName('')
    setAmount('')
    setCategory('')
    setPayer('')
    setPaymentId('')
    setNote('')
    setStartDate(todayISO())
    setEndDate(addMonthsIso(todayISO(), 11))
    setDayOfMonth(String(Math.min(new Date().getDate(), 28)))
    setApplyMode('future')
    setErrors({})
  }

  const validate = () => {
    const e = {}
    const day = parseInt(dayOfMonth, 10)
    if (!name.trim()) e.name = lang === 'en' ? 'Required' : 'กรุณาใส่ชื่อรายการ'
    if (!amount || parseFloat(amount) <= 0) e.amount = lang === 'en' ? 'Required' : 'กรุณาใส่จำนวนเงิน'
    if (!category) e.category = lang === 'en' ? 'Required' : 'กรุณาเลือกหมวดหมู่'
    if (!payer) e.payer = lang === 'en' ? 'Required' : 'กรุณาเลือกผู้จ่าย'
    if (!paymentId) e.payment = lang === 'en' ? 'Required' : 'กรุณาเลือกวิธีชำระ'
    if (!startDate) e.startDate = lang === 'en' ? 'Required' : 'กรุณาเลือกวันที่เริ่ม'
    if (!endDate) e.endDate = lang === 'en' ? 'Required' : 'กรุณาเลือกวันที่สิ้นสุด'
    if (startDate && endDate && endDate < startDate) e.endDate = lang === 'en' ? 'End date must be after start date' : 'วันที่สิ้นสุดต้องอยู่หลังวันที่เริ่ม'
    if (!day || day < 1 || day > 28) e.day = lang === 'en' ? 'Choose day 1-28' : 'เลือกได้เฉพาะวันที่ 1-28'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (savingRef.current) return
    if (!validate()) return
    savingRef.current = true
    setSaving(true)
    try {
      const data = await sendToGAS({
        action: editingId ? 'updateRecurringRule' : 'addRecurringRule',
        id: editingId,
        name: name.trim(),
        category,
        type: 'expense',
        amount: parseFloat(amount),
        payer,
        paymentId,
        payment_id: paymentLabel(),
        note: note.trim(),
        start_date: startDate,
        end_date: endDate,
        day_of_month: parseInt(dayOfMonth, 10),
        apply_mode: applyMode,
      })
      if (data.status === 'ok') {
        showToast(lang === 'en' ? 'Saved' : 'บันทึกแล้ว')
        resetForm()
        await loadRules()
      } else {
        showToast('Error: ' + (data.message || 'Unknown'))
      }
    } catch (e) {
      showToast('Error: ' + e.message)
    }
    savingRef.current = false
    setSaving(false)
  }

  const editRule = (rule) => {
    const label = rule.payment_id || ''
    const foundPayment = payments.find(p => samePaymentLabel(paymentLabel(p.id), label))
    setEditingId(rule.id || '')
    setName(rule.name || '')
    setAmount(rule.amount || '')
    setCategory(rule.category || '')
    setPayer(rule.payer || '')
    setPaymentId(rule.paymentId || rule.payment_id_id || (foundPayment ? foundPayment.id : ''))
    setNote(rule.note || '')
    setStartDate(rule.start_date || todayISO())
    setEndDate(rule.end_date || addMonthsIso(todayISO(), 11))
    setDayOfMonth(String(rule.day_of_month || 1))
    setApplyMode('future')
    setErrors({})
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const deleteRule = async (rule, mode) => {
    const msg = mode === 'all'
      ? (lang === 'en' ? 'Delete this rule and all generated transactions?' : 'ลบกฎนี้และรายการที่สร้างไว้ทั้งหมด?')
      : (lang === 'en' ? 'Stop this rule for future months?' : 'หยุดรายการนี้สำหรับเดือนถัดไป?')
    if (!confirm(msg)) return
    try {
      const data = await sendToGAS({ action: 'deleteRecurringRule', id: rule.id, delete_mode: mode })
      if (data.status === 'ok') {
        showToast(lang === 'en' ? 'Updated' : 'อัปเดตแล้ว')
        await loadRules()
        if (editingId === rule.id) resetForm()
      } else showToast('Error: ' + (data.message || 'Unknown'))
    } catch (e) {
      showToast('Error: ' + e.message)
    }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>{lang === 'en' ? 'Loading...' : 'กำลังโหลด...'}</div>

  const previewCount = monthCount(startDate, endDate, parseInt(dayOfMonth, 10))
  const previewDuration = formatDateRangeDuration(startDate, endDate, lang)
  const isEditing = Boolean(editingId)

  return (
    <div style={S.wrap}>
      {toast && <div style={S.toast}>{toast}</div>}

      <div style={S.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={S.htitle}>🔁 {lang === 'en' ? 'Recurring Expense' : 'รายการรายเดือน'}</div>
          <LangToggle />
        </div>
        <div style={S.hsub}>{lang === 'en' ? 'Create monthly transactions in the existing month sheets' : 'สร้างรายการลงชีตเดือนเดิมเพื่อคำนวณยอดทันที'}</div>
      </div>

      <div style={S.body}>
        <div style={{ ...S.card, background: '#f7f6ff', borderColor: '#dad7ff' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#4c45a5', marginBottom: 10 }}>
            {isEditing ? (lang === 'en' ? 'Edit rule' : 'แก้ไขกฎ recurring') : (lang === 'en' ? 'New rule' : 'ตั้งรายการใหม่')}
          </div>

          <div style={S.group}>
            <label style={S.label}>🏪 {lang === 'en' ? 'Item name' : 'ชื่อรายการ'}</label>
            <input value={name} onChange={e => setName(e.target.value)} style={{ ...S.input, borderColor: errors.name ? '#D85A30' : '#e0e0d8' }} placeholder={lang === 'en' ? 'e.g. Netflix' : 'เช่น Netflix'} />
            {errors.name && <div style={S.err}>{errors.name}</div>}
          </div>

          <div style={S.group}>
            <label style={S.label}>💰 {lang === 'en' ? 'Amount' : 'จำนวนเงิน'}</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" style={{ ...S.input, borderColor: errors.amount ? '#D85A30' : '#e0e0d8', fontSize: 18, fontWeight: 600 }} placeholder="0" />
            {errors.amount && <div style={S.err}>{errors.amount}</div>}
          </div>

          <div style={S.group}>
            <label style={S.label}>🏷 {lang === 'en' ? 'Category' : 'หมวดหมู่'}</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {categories.map(c => (
                <div key={c.id} onClick={() => setCategory(c.name)} onTouchEnd={e => { e.preventDefault(); setCategory(c.name) }} style={category === c.name ? S.chipSel : S.chip}>
                  {c.icon} {c.name}
                </div>
              ))}
            </div>
            {errors.category && <div style={S.err}>{errors.category}</div>}
          </div>

          <div style={S.group}>
            <label style={S.label}>👤 {lang === 'en' ? 'Paid by' : 'ผู้จ่าย'}</label>
            <div style={S.grid2}>
              {members.map(m => (
                <div key={m.id} onClick={() => setPayer(m.name)} onTouchEnd={e => { e.preventDefault(); setPayer(m.name) }} style={payer === m.name ? { ...S.chipSel, borderRadius: 8 } : { ...S.chip, borderRadius: 8 }}>
                  {m.name}
                </div>
              ))}
            </div>
            {errors.payer && <div style={S.err}>{errors.payer}</div>}
          </div>

          <div style={S.group}>
            <label style={S.label}>💳 {lang === 'en' ? 'Payment method' : 'วิธีชำระเงิน'}</label>
            <select value={paymentId} onChange={e => setPaymentId(e.target.value)} style={{ ...S.select, borderColor: errors.payment ? '#D85A30' : '#e0e0d8' }}>
              <option value="">{lang === 'en' ? '-- Select payment --' : '-- เลือกวิธีชำระ --'}</option>
              {payments.map(p => <option key={p.id} value={p.id}>{paymentLabel(p.id)}</option>)}
            </select>
            {errors.payment && <div style={S.err}>{errors.payment}</div>}
          </div>

          <div style={S.group}>
            <label style={S.label}>📝 {lang === 'en' ? 'Note' : 'หมายเหตุ'} ({lang === 'en' ? 'optional' : 'ไม่บังคับ'})</label>
            <input value={note} onChange={e => setNote(e.target.value)} style={S.input} />
          </div>

          <div style={S.grid2}>
            <div style={S.group}>
              <label style={S.label}>📅 {lang === 'en' ? 'Start date' : 'วันที่เริ่ม'}</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ ...S.input, borderColor: errors.startDate ? '#D85A30' : '#e0e0d8' }} />
              {errors.startDate && <div style={S.err}>{errors.startDate}</div>}
            </div>
            <div style={S.group}>
              <label style={S.label}>📅 {lang === 'en' ? 'End date' : 'วันที่สิ้นสุด'}</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ ...S.input, borderColor: errors.endDate ? '#D85A30' : '#e0e0d8' }} />
              {errors.endDate && <div style={S.err}>{errors.endDate}</div>}
            </div>
          </div>

          <div style={S.group}>
            <label style={S.label}>🔁 {lang === 'en' ? 'Day of every month' : 'เพิ่มทุกวันที่ของเดือน'}</label>
            <select value={dayOfMonth} onChange={e => setDayOfMonth(e.target.value)} style={{ ...S.select, borderColor: errors.day ? '#D85A30' : '#e0e0d8' }}>
              {DAY_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            {errors.day && <div style={S.err}>{errors.day}</div>}
          </div>

          {isEditing && (
            <div style={S.group}>
              <label style={S.label}>{lang === 'en' ? 'Apply edit to' : 'ให้การแก้ไขกระทบ'}</label>
              <select value={applyMode} onChange={e => setApplyMode(e.target.value)} style={S.select}>
                <option value="future">{lang === 'en' ? 'Future generated items only' : 'รายการใหม่/เดือนถัดไปเท่านั้น'}</option>
                <option value="all">{lang === 'en' ? 'All generated items from this rule' : 'รายการทั้งหมดที่เคยสร้างจากกฎนี้'}</option>
              </select>
            </div>
          )}

          <div style={{ fontSize: 13, color: '#666', background: '#fff', borderRadius: 8, padding: '10px 12px', border: '1px solid #e8e6ff' }}>
            {lang === 'en' ? 'Preview' : 'ตัวอย่าง'}: {previewCount} {lang === 'en' ? 'transactions' : 'รายการ'} · {lang === 'en' ? 'Effective for' : 'ช่วงที่มีผล'} {previewDuration} · {lang === 'en' ? 'monthly day' : 'ทุกวันที่'} {dayOfMonth || '-'}
          </div>
        </div>

        <div style={{ marginTop: 18, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{lang === 'en' ? 'Saved rules' : 'รายการที่ตั้งไว้'}</div>
          {isEditing && <button onClick={resetForm} style={{ border: '1px solid #ddd', background: '#fff', borderRadius: 8, padding: '7px 10px', fontSize: 12 }}>{lang === 'en' ? 'Cancel edit' : 'ยกเลิกแก้ไข'}</button>}
        </div>

        {rules.length === 0 && (
          <div style={{ fontSize: 14, color: '#888', background: '#fff', borderRadius: 10, padding: 16, border: '1px solid #eee' }}>
            {lang === 'en' ? 'No recurring rules yet' : 'ยังไม่มีรายการรายเดือน'}
          </div>
        )}

        {rules.map(rule => {
          const active = (rule.status || 'active') === 'active'
          const ruleCount = monthCount(rule.start_date, rule.end_date, parseInt(rule.day_of_month, 10))
          const ruleDuration = formatDateRangeDuration(rule.start_date, rule.end_date, lang)
          return (
            <div key={rule.id} style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rule.name}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>
                    ฿{Number(rule.amount || 0).toLocaleString()} · {rule.category} · {lang === 'en' ? 'day' : 'วันที่'} {rule.day_of_month} · {ruleDuration}
                  </div>
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>
                    {rule.start_date} → {rule.end_date} · {active ? (lang === 'en' ? 'active' : 'ใช้งาน') : (lang === 'en' ? 'stopped' : 'หยุดแล้ว')}
                  </div>
                </div>
                <div style={{ fontSize: 18 }}>🔁</div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button onClick={() => editRule(rule)} style={{ flex: 1, padding: '9px 8px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', fontSize: 13, fontWeight: 600 }}>
                  {lang === 'en' ? 'Edit' : 'แก้ไข'}
                </button>
                {active && (
                  <button onClick={() => deleteRule(rule, 'future')} style={{ flex: 1, padding: '9px 8px', borderRadius: 8, border: 'none', background: '#BA7517', color: '#fff', fontSize: 13, fontWeight: 700 }}>
                    {lang === 'en' ? 'Stop' : 'หยุด'}
                  </button>
                )}
                <button onClick={() => deleteRule(rule, 'all')} style={{ flex: 1, padding: '9px 8px', borderRadius: 8, border: 'none', background: '#D85A30', color: '#fff', fontSize: 13, fontWeight: 700 }}>
                  {lang === 'en' ? 'Delete all' : 'ลบทั้งหมด'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div style={S.footer}>
        <button onClick={handleSave} onTouchEnd={e => { e.preventDefault(); handleSave() }} style={saving ? S.btnDis : S.btnSave} disabled={saving}>
          {saving ? (lang === 'en' ? 'Saving...' : 'กำลังบันทึก...') : isEditing ? (lang === 'en' ? 'Save Changes' : 'บันทึกการแก้ไข') : (lang === 'en' ? 'Create Recurring' : 'สร้างรายการรายเดือน')}
        </button>
      </div>
    </div>
  )
}
