// v11
import { useState, useEffect, useCallback } from 'react'
import BottomNav from './components/BottomNav.jsx'
import LangToggle from './components/LangToggle.jsx'
import { getLang, t } from './i18n'
import { getCache, setCache, bustCache } from './cache'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts'

const SHEET_ID     = import.meta.env.VITE_SHEET_ID  || 'YOUR_SPREADSHEET_ID'
const API_KEY      = import.meta.env.VITE_API_KEY   || 'YOUR_GOOGLE_API_KEY'
const GAS_URL      = import.meta.env.VITE_GAS_URL   || ''
const SHEETS_BASE  = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values`
const MONTHS_TH    = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
const MONTHS_EN    = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const CAT_COLORS   = ['#1D9E75','#378ADD','#D85A30','#BA7517','#7F77DD','#D4537E','#639922','#0F6E56']
const MEMBER_COLORS= ['#378ADD','#D4537E','#1D9E75','#BA7517']

const fmt = (n) => '฿' + Math.round(n).toLocaleString()

// ============================================================
//  FETCH HELPERS
// ============================================================
async function fetchSheet(name) {
  const res  = await fetch(`${SHEETS_BASE}/${encodeURIComponent(name)}?key=${API_KEY}`)
  if (!res.ok) throw new Error(`Cannot fetch ${name}: ${res.status}`)
  const data = await res.json()
  const rows = data.values || []
  if (rows.length < 2) return []
  const headers = rows[0]
  return rows.slice(1).map(row => {
    const obj = {}
    headers.forEach((h, i) => { obj[h] = row[i] || '' })
    return obj
  })
}

async function fetchMonthSheet(sheetName) {
  // Sheet เดือน format: row1=settlement header, row2=settlement data, row3=tx header, row4+=tx data
  const res  = await fetch(`${SHEETS_BASE}/${encodeURIComponent(sheetName)}?key=${API_KEY}`)
  if (!res.ok) return null
  const data = await res.json()
  const rows = data.values || []
  if (rows.length < 4) return { settlement: null, transactions: [] }

  // Row 2 = settlement data [month, from, to, amount, status, settled_at]
  const s = rows[1] || []
  const settlement = {
    month: s[0] || '', from: s[1] || '', to: s[2] || '',
    amount: parseFloat(s[3]) || 0, status: s[4] || 'pending', settledAt: s[5] || ''
  }

  // Row 3 = headers, Row 4+ = transactions
  const headers = rows[2] || []
  const transactions = rows.slice(3).map(row => {
    const obj = {}
    headers.forEach((h, i) => { obj[h] = row[i] || '' })
    return obj
  })

  return { settlement, transactions }
}

async function sendToGAS(payload) {
  const params = new URLSearchParams(
    Object.fromEntries(Object.entries(payload).map(([k, v]) => [k, String(v)]))
  )
  const res = await fetch(`${GAS_URL}?${params.toString()}`)
  if (!res.ok) throw new Error('GAS error: ' + res.status)
  return res.json()
}

// ============================================================
//  RESOLVE OWNER (จาก payment string "SCB ···1234 (Oy)")
// ============================================================
function resolveOwnerFromLabel(paymentLabel, payer) {
  if (!paymentLabel) return payer
  const lower = paymentLabel.toLowerCase()
  if (lower.includes('เงินสด') || lower.includes('cash')) return payer

  // ✅ T1 นับเป็นรายจ่ายของ Build
  if (lower.includes('t1')) return 'Build'

  const ownerMatch = paymentLabel.match(/\((.+)\)$/)
  const owner = ownerMatch ? ownerMatch[1].trim() : ''
  if (!owner || owner === 'ร่วมกัน') return 'ร่วมกัน'
  return owner
}

// ============================================================
//  SETTLEMENT CALCULATION
// ============================================================
function computeSettlement(transactions, members) {
  const paid = {}
  members.forEach(m => paid[m] = 0)
  let total = 0

  transactions.forEach(t => {
    const type  = (t.type || '').toLowerCase().trim()
    const amt   = parseFloat(t.amount) || 0
    const payer = (t.payer || '').trim()
    const to    = (t.to   || '').trim()

    if (type === 'expense') {
      total += amt
      const owner = resolveOwnerFromLabel(t.payment_id, payer)
      if (owner === 'ร่วมกัน' || !owner) {
        const share = amt / (members.length || 1)
        members.forEach(m => { if (paid[m] !== undefined) paid[m] += share })
      } else {
        if (paid[owner] !== undefined) paid[owner] += amt
      }
    } else if (type === 'direct') {
      // direct debt: NOT counted in total; debtor (payer) paid less, creditor (to) paid more
      if (paid[payer] !== undefined) paid[payer] -= amt
      if (paid[to]    !== undefined) paid[to]    += amt
    }
  })

  const expenseTotal = transactions
    .filter(t => (t.type || '').toLowerCase() === 'expense')
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0)
  const perPerson = members.length > 0 ? expenseTotal / members.length : 0

  const balances = members.map(m => ({
    name: m, paid: Math.round(paid[m] || 0),
    balance: (paid[m] || 0) - perPerson
  }))

  const settlements = []
  const debtors   = balances.filter(b => b.balance < -1).map(b => ({ ...b }))
  const creditors = balances.filter(b => b.balance >  1).map(b => ({ ...b }))
  let i = 0, j = 0
  while (i < debtors.length && j < creditors.length) {
    const amt = Math.min(-debtors[i].balance, creditors[j].balance)
    if (amt > 1) settlements.push({ from: debtors[i].name, to: creditors[j].name, amount: Math.round(amt) })
    debtors[i].balance  += amt
    creditors[j].balance -= amt
    if (Math.abs(debtors[i].balance)  < 1) i++
    if (Math.abs(creditors[j].balance) < 1) j++
  }
  return { total, perPerson, balances, settlements }
}

// ============================================================
//  SETTLEMENT BAR
// ============================================================
function SettlementBar({ balances, settlements, lang }) {
  const grandTotal = balances.reduce((s, b) => s + b.paid, 0) || 1
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        {balances[0] && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: MEMBER_COLORS[0] + '22', color: MEMBER_COLORS[0], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
              {balances[0].name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{balances[0].name}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: MEMBER_COLORS[0] }}>{fmt(balances[0].paid)}</div>
            </div>
          </div>
        )}
        <div style={{ fontSize: 13, color: '#bbb', padding: '0 12px', flexShrink: 0 }}>vs</div>
        {balances[1] && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, flexDirection: 'row-reverse' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: MEMBER_COLORS[1] + '22', color: MEMBER_COLORS[1], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
              {balances[1].name.substring(0, 2).toUpperCase()}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{balances[1].name}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: MEMBER_COLORS[1] }}>{fmt(balances[1].paid)}</div>
            </div>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', marginBottom: 6 }}>
        {balances.map((b, i) => (
          <div key={b.name} style={{ width: Math.round(b.paid / grandTotal * 100) + '%', background: MEMBER_COLORS[i % MEMBER_COLORS.length], transition: 'width 0.5s' }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        {balances.map((b, i) => (
          <div key={b.name} style={{ fontSize: 12, color: '#888' }}>
            {i === 0 ? `${b.name} ${Math.round(b.paid / grandTotal * 100)}%` : `${Math.round(b.paid / grandTotal * 100)}% ${b.name}`}
          </div>
        ))}
      </div>
      {settlements.length === 0 ? (
        <div style={{ fontSize: 14, color: '#1D9E75' }}>{lang==='en'?'✓ All equal, no settlement needed':'✓ ทุกคนจ่ายเท่ากัน ไม่ต้องชำระคืน'}</div>
      ) : settlements.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff9f7', border: '1px solid #f5c4b3', borderRadius: 10, padding: '12px 16px', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#D85A30' }}>{s.from}</span>
            <span style={{ color: '#ccc' }}>→</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1D9E75' }}>{s.to}</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#D85A30' }}>{fmt(s.amount)}</div>
        </div>
      ))}
    </div>
  )
}

// ============================================================
//  SETTLEMENT STATUS BOX
// ============================================================
function SettlementStatus({ settlement, monthKey, onSettle, lang }) {
  const [loading, setLoading] = useState(false)
  if (!settlement) return null
  const isSettled = settlement.status === 'settled'

  const handleSettle = async () => {
    if (!confirm(lang==='en'?`Confirm settlement for ${monthKey}?\n${settlement.from} pays ฿${Math.round(settlement.amount).toLocaleString()} to ${settlement.to}`:`ยืนยันการเคลียบิลเดือน ${monthKey}?\n${settlement.from} โอน ฿${Math.round(settlement.amount).toLocaleString()} ให้ ${settlement.to}`)) return
    setLoading(true)
    try {
      const res = await sendToGAS({ action: 'markSettled', month: monthKey })
      if (res.status === 'ok') onSettle()
      else alert('เกิดข้อผิดพลาด: ' + res.message)
    } catch { alert(lang==='en'?'Connection error':'เชื่อมต่อไม่ได้') }
    setLoading(false)
  }

  return (
    <div style={{ marginTop: 16, padding: '14px 16px', borderRadius: 10, background: isSettled ? '#f0faf5' : '#fff9f0', border: `1px solid ${isSettled ? '#a8dfc4' : '#f5c4b3'}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: isSettled ? '#1D9E75' : '#D85A30' }}>
            {isSettled ? lang==='en'?'✅ Settled':'✅ เคลียบิลแล้ว' : lang==='en'?'⏳ Pending':'⏳ ยังไม่ได้เคลียบิล'}
          </div>
          {settlement.settledAt && (
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{lang==='en'?'Settled at ':' เคลียเมื่อ '}{settlement.settledAt.toString().substring(0, 10)}</div>
          )}
        </div>
        {!isSettled && settlement.amount > 0 && (
          <button onClick={handleSettle} disabled={loading} style={{
            padding: '8px 16px', borderRadius: 8, border: 'none',
            background: '#1D9E75', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer'
          }}>
            {loading ? 'กำลังบันทึก...' : lang==='en'?`✅ Mark Settled ฿${Math.round(settlement.amount).toLocaleString()}`:`✅ Mark เคลีย ฿${Math.round(settlement.amount).toLocaleString()}`}
          </button>
        )}
      </div>
    </div>
  )
}

// ============================================================
//  APP
// ============================================================
export default function App() {
  const now   = new Date()
  const [lang, setLang] = useState(getLang())
  const [month,       setMonth]       = useState(now.getMonth())
  const [year,        setYear]        = useState(now.getFullYear())
  const [transactions,setTransactions]= useState([])
  const [members,     setMembers]     = useState([])
  const [categories,  setCategories]  = useState([])
  const [payments,    setPayments]    = useState([])
  const [settlement,  setSettlement]  = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [lastRefresh, setLastRefresh] = useState(null)
  const [useMonthSheet, setUseMonthSheet] = useState(false)

  const monthKey = String(month + 1).padStart(2, '0') + '-' + year

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      // Start month fetch immediately — it does not depend on ref data
      const monthPromise = fetchMonthSheet(monthKey)

      const refCache = getCache('dash_refs')
      let mems, cats, pays
      if (refCache) {
        ;({ mems, cats, pays } = refCache)
      } else {
        // Fetch all 3 in parallel while monthPromise is already running
        ;[mems, cats, pays] = await Promise.all([
          fetchSheet('members'), fetchSheet('categories'), fetchSheet('payment_methods')
        ])
        setCache('dash_refs', { mems, cats, pays })
      }

      setMembers(cats.length ? mems.filter(m => m.active === 'TRUE') : mems)
      setCategories(cats.filter(c => c.active === 'TRUE'))
      setPayments(pays.filter(p => p.active === 'TRUE'))

      const monthData = await monthPromise
      if (monthData && monthData.transactions.length > 0) {
        setTransactions(monthData.transactions)
        setSettlement(monthData.settlement)
        setUseMonthSheet(true)
      } else {
        const txs = await fetchSheet('transactions')
        setTransactions(txs)
        setSettlement(null)
        setUseMonthSheet(false)
      }
      setLastRefresh(new Date())
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [monthKey])

  useEffect(() => { load() }, [load])

  // Re-fetch transaction data whenever the tab becomes visible again
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  useEffect(() => {
    const handler = () => setLang(getLang())
    window.addEventListener('langchange', handler)
    return () => window.removeEventListener('langchange', handler)
  }, [])

  const memberNames  = members.map(m => m.name)
  const catIconMap   = {}
  categories.forEach(c => { catIconMap[c.name] = c.icon || '' })

  // Filter ตามเดือน (ถ้า fallback ไป transactions เดิม)
  const filtered = useMonthSheet ? transactions : transactions.filter(t => {
    if (!t.date) return false
    const d = new Date(t.date)
    return d.getFullYear() === year && d.getMonth() === month
  })

  const expenses = filtered.filter(t => (t.type || 'expense').toLowerCase() === 'expense')
  const directs  = filtered.filter(t => (t.type || '').toLowerCase() === 'direct')
  const income   = filtered.filter(t => (t.type || '').toLowerCase() === 'income')
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0)

  const { total, perPerson, balances, settlements } = computeSettlement(filtered, memberNames)

  // กราฟหมวดหมู่ (expense เท่านั้น)
  const byCat = {}
  expenses.forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + (parseFloat(t.amount) || 0) })
  const catData = Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value: Math.round(value) }))

  // กราฟวิธีชำระ (expense เท่านั้น) แยกตามเจ้าของบัตร
  const byPay = {}
  expenses.forEach(t => {
    const pmStr   = t.payment_id || ''
    const owner   = resolveOwnerFromLabel(pmStr, t.payer)
    const pmName  = pmStr.replace(/\s*\(.+\)$/, '').trim() || 'ไม่ระบุ'
    const key     = pmName + (owner && owner !== 'ร่วมกัน' ? ' (' + owner + ')' : '')
    if (!byPay[key]) byPay[key] = { total: 0, owner, dispName: pmName }
    byPay[key].total += parseFloat(t.amount) || 0
  })

  // สรุปตามเจ้าของบัตร
  const byOwner = {}
  memberNames.forEach(m => byOwner[m] = 0)
  filtered.forEach(t => {
    const type = (t.type || 'expense').toLowerCase()
    const amt  = parseFloat(t.amount) || 0
    if (type === 'expense') {
      const owner = resolveOwnerFromLabel(t.payment_id, t.payer)
      if (owner === 'ร่วมกัน' || !owner) memberNames.forEach(m => { byOwner[m] = (byOwner[m] || 0) + amt / memberNames.length })
      else if (byOwner[owner] !== undefined) byOwner[owner] += amt
    } else if (type === 'direct') {
      if (byOwner[t.payer] !== undefined) byOwner[t.payer] += amt
      if (byOwner[t.to]    !== undefined) byOwner[t.to]    -= amt
    }
  })

  const expenseTotal = expenses.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0)
  const directTotal  = directs.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0)

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const nextMonth = () => {
    if (year === now.getFullYear() && month === now.getMonth()) return
    if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1)
  }
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px 16px 90px', fontFamily: 'system-ui,sans-serif', background: '#f8f8f5', minHeight: '100vh' }}>

      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 600 }}>{t('dashboard', lang)}</div>
          <div style={{ fontSize: 13, color: '#888' }}>Oy & Build{lastRefresh ? ' · ' + lastRefresh.toLocaleTimeString('th') : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <LangToggle />
          <button onClick={() => { bustCache('dash_refs'); load() }} style={S.iconBtn} title={t('refresh', lang)}>↻</button>
        </div>
      </div>

      {/* MONTH SELECTOR */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 20 }}>
        <button onClick={prevMonth} style={S.navBtn}>‹</button>
        <div style={{ fontSize: 18, fontWeight: 600, minWidth: 120, textAlign: 'center' }}>{(lang==='en'?MONTHS_EN:MONTHS_TH)[month]} {year}</div>
        <button onClick={nextMonth} style={{ ...S.navBtn, opacity: isCurrentMonth ? 0.3 : 1 }} disabled={isCurrentMonth}>›</button>
      </div>

      {error && (
        <div style={{ background: '#FCEBEB', border: '1px solid #F09595', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#A32D2D' }}>
          เชื่อมต่อ Google Sheet ไม่ได้: {error}
        </div>
      )}

      {loading && <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>{lang==='en'?'Loading...':'กำลังโหลดข้อมูล...'}</div>}

      {!loading && !error && <>

        {/* METRICS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 12 }}>
          <Metric label={lang==='en'?'Total Income':'รายรับรวม'}   value={fmt(income)}      color="#1D9E75" />
          <Metric label={lang==='en'?'Total Expense':'รายจ่ายรวม'}  value={fmt(expenseTotal)} color="#D85A30" />
          {directTotal > 0 && <Metric label={lang==='en'?'Direct Debt':'หนี้โดยตรง'} value={fmt(directTotal)} color="#BA7517" />}
          <Metric label={lang==='en'?'Avg/Person':'เฉลี่ย/คน'}   value={fmt(perPerson)} />
          <Metric label={lang==='en'?'Items':'รายการ'}       value={expenses.length + (lang==='en'?' items':' รายการ')} />
        </div>

        {/* SETTLEMENT + STATUS */}
        <Section title={lang==='en'?'Expense Comparison':'เปรียบเทียบรายจ่าย'}>
          <SettlementBar balances={balances} settlements={settlements} lang={lang} />
          <SettlementStatus
            settlement={useMonthSheet ? settlement : null}
            monthKey={monthKey}
            onSettle={load}
            lang={lang}
          />
        </Section>

        {/* CHARTS */}
        {catData.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 12 }}>
            <Section title={lang==='en'?'By Category':'รายจ่ายตามหมวดหมู่'}>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={38}>
                    {catData.map((_, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {catData.map((c, i) => (
                  <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: CAT_COLORS[i % CAT_COLORS.length], flexShrink: 0 }} />
                    <div style={{ fontSize: 13, flex: 1 }}>{catIconMap[c.name] || ''} {c.name}</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{fmt(c.value)}</div>
                    <div style={{ fontSize: 11, color: '#888', minWidth: 34, textAlign: 'right' }}>{expenseTotal > 0 ? Math.round(c.value / expenseTotal * 100) : 0}%</div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title={lang==='en'?'By Person':'รายจ่ายแต่ละคน'}>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={balances} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 13 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => '฿' + (v / 1000).toFixed(0) + 'k'} />
                  <Tooltip formatter={v => fmt(v)} />
                  <Bar dataKey="paid" radius={[4, 4, 0, 0]}>
                    {balances.map((_, i) => <Cell key={i} fill={MEMBER_COLORS[i % MEMBER_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ marginTop: 6, fontSize: 12, color: '#888', textAlign: 'center' }}>{lang==='en'?`Avg ${fmt(perPerson)} / person`:`เฉลี่ย ${fmt(perPerson)} / คน`}</div>
            </Section>
          </div>
        )}

        {/* วิธีชำระ */}
        {Object.keys(byPay).length > 0 && (
          <Section title={lang==='en'?'By Payment Method':'รายจ่ายตามวิธีชำระ'}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {Object.entries(byPay).sort((a, b) => b[1].total - a[1].total).map(([key, data]) => {
                const ownerIdx = memberNames.indexOf(data.owner)
                const barColor = ownerIdx >= 0 ? MEMBER_COLORS[ownerIdx % MEMBER_COLORS.length] : '#888780'
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 120, minWidth: 120, flexShrink: 0 }}>
                      <div style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.dispName}</div>
                      <div style={{ fontSize: 11, color: barColor, fontWeight: 600 }}>{data.owner || (lang==='en'?'N/A':'ไม่ระบุ')}</div>
                    </div>
                    <div style={{ flex: 1, background: '#f0f0ec', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: barColor, borderRadius: 4, width: expenseTotal > 0 ? Math.round(data.total / expenseTotal * 100) + '%' : '0%' }} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, minWidth: 72, textAlign: 'right' }}>{fmt(data.total)}</div>
                    <div style={{ fontSize: 11, color: '#888', minWidth: 30, textAlign: 'right' }}>{expenseTotal > 0 ? Math.round(data.total / expenseTotal * 100) : 0}%</div>
                  </div>
                )
              })}
            </div>
            <div style={{ borderTop: '1px solid #f0f0ec', paddingTop: 12 }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 8, fontWeight: 600 }}>{lang==='en'?'By Card Owner':'สรุปตามเจ้าของบัตร'}</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {memberNames.map((m, i) => (
                  <div key={m} style={{ flex: 1, minWidth: 100, background: '#f8f8f5', borderRadius: 8, padding: '10px 14px', borderLeft: `3px solid ${MEMBER_COLORS[i % MEMBER_COLORS.length]}` }}>
                    <div style={{ fontSize: 12, color: '#888' }}>{m}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: MEMBER_COLORS[i % MEMBER_COLORS.length] }}>{fmt(byOwner[m] || 0)}</div>
                    <div style={{ fontSize: 11, color: '#aaa' }}>{total > 0 ? Math.round((byOwner[m] || 0) / total * 100) : 0}%</div>
                  </div>
                ))}
              </div>
            </div>
          </Section>
        )}

        {/* TRANSACTION LIST */}
        <TransactionList
          expenses={expenses}
          payments={payments}
          categories={categories}
          catIconMap={catIconMap}
          memberNames={memberNames}
          monthKey={monthKey}
          lang={lang}
          onReload={load}
          GAS_URL={GAS_URL}
        />

        {/* DIRECT DEBT */}
        {directs.length > 0 && (
          <DirectDebtList
            directs={directs}
            memberNames={memberNames}
            monthKey={monthKey}
            lang={lang}
            onReload={load}
            GAS_URL={GAS_URL}
          />
        )}
      </>}
      <BottomNav />
    </div>
  )
}

// ============================================================
//  TRANSACTION LIST — Dropdown Filter + Full Edit Modal
// ============================================================
function normalizeCreatedAt(val) {
  if (!val) return ''
  // แปลง "2026-05-24 1:02:50" → "2026-05-24 01:02:50"
  return String(val).trim().replace(
    /(\d{4}-\d{2}-\d{2})\s+(\d):(\d{2}):(\d{2})/,
    '$1 0$2:$3:$4'
  )
}

function TransactionList({ expenses, payments, categories, catIconMap, memberNames, monthKey, lang, onReload, GAS_URL }) {
  const [filterPm, setFilterPm]   = useState('all')
  const [searchQ,  setSearchQ]    = useState('')
  const [editingTx, setEditingTx] = useState(null)
  const [editForm, setEditForm]   = useState({})
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)

  const pmOptions = [...new Set(expenses.map(tx => tx.payment_id || '').filter(Boolean))]

  const sortByDate = (arr) => [...arr].sort((a, b) => {
    const da = new Date(a.date || 0), db = new Date(b.date || 0)
    return db - da // เรียงจากใหม่ไปเก่า
  })

  const filtered = sortByDate(
    expenses
      .filter(tx => filterPm === 'all' || (tx.payment_id || '') === filterPm)
      .filter(tx => !searchQ || (tx.name || '').toLowerCase().includes(searchQ.toLowerCase()))
  )

  const pmNameShort = (pmStr) => (pmStr || '').trim()  // แสดงชื่อพร้อมเจ้าของ

  const openEdit = (tx) => {
    setEditingTx(tx)
    setEditForm({
      date:       tx.date       || '',
      name:       tx.name       || '',
      amount:     tx.amount     || '',
      category:   tx.category   || '',
      payer:      tx.payer      || '',
      payment_id: tx.payment_id || '',
      note:       tx.note       || '',
    })
  }

  const handleDelete = async (tx) => {
    if (!confirm(lang==='en'?'Delete this transaction?':'ลบรายการนี้?')) return
    setDeleting(true)
    try {
      const params = new URLSearchParams({
        action:     'deleteTransaction',
        month:      monthKey,
        created_at: normalizeCreatedAt(tx.created_at),
      })
      const res  = await fetch(`${GAS_URL}?${params.toString()}`)
      const data = await res.json()
      if (data.status === 'ok') { setEditingTx(null); onReload() }
      else alert('Error: ' + (data.message || 'Unknown'))
    } catch (e) { alert('Connection error') }
    setDeleting(false)
  }

  const handleSaveEdit = async () => {
    if (!editForm.name || !editForm.amount) return
    setSaving(true)
    try {
      const params = new URLSearchParams({
        action:     'editTransaction',
        month:      monthKey,
        created_at: normalizeCreatedAt(editingTx.created_at),
        date:       editForm.date,
        name:       editForm.name,
        amount:     editForm.amount,
        category:   editForm.category,
        payer:      editForm.payer,
        payment_id: editForm.payment_id,
        note:       editForm.note || '',
      })
      const res  = await fetch(`${GAS_URL}?${params.toString()}`)
      const data = await res.json()
      if (data.status === 'ok') { setEditingTx(null); onReload() }
      else alert('Error: ' + (data.message || 'Unknown'))
    } catch (e) { alert('Connection error: ' + e.message) }
    setSaving(false)
  }

  const inp = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e0e0d8', fontSize: 14, boxSizing: 'border-box', background: '#fff' }
  const lbl = { fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }

  return (
    <Section title={`${lang === 'th' ? 'รายการทั้งหมด' : 'All Transactions'} (${expenses.length})`}>

      {/* SEARCH + FILTER */}
      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        <input
          type="text"
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
          placeholder={lang === 'th' ? '🔍 ค้นหารายการ...' : '🔍 Search...'}
          style={{ flex:1, padding:'8px 12px', borderRadius:8, border:'1px solid #e0e0d8', fontSize:14, outline:'none' }}
        />
        {searchQ && (
          <button onClick={() => setSearchQ('')}
            style={{ padding:'8px 12px', borderRadius:8, border:'1px solid #e0e0d8', background:'#fff', fontSize:13, cursor:'pointer', color:'#888' }}>
            ✕
          </button>
        )}
      </div>
      <div style={{ marginBottom: 12 }}>
        <select value={filterPm} onChange={e => setFilterPm(e.target.value)}
          style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #e0e0d8', fontSize: 14, background: '#fff', cursor: 'pointer' }}>
          <option value="all">{lang === 'th' ? '💳 ทุกวิธีชำระ' : '💳 All Payments'}</option>
          {pmOptions.map(pm => (
            <option key={pm} value={pm}>{pmNameShort(pm)}</option>
          ))}
        </select>
      </div>

      {/* EDIT MODAL */}
      {editingTx && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: 480, borderRadius: '16px 16px 0 0', padding: '20px 20px 36px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: '#1a1a1a' }}>
              {lang === 'th' ? '✏️ แก้ไขรายการ' : '✏️ Edit Transaction'}
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={lbl}>{lang === 'th' ? 'วันที่' : 'Date'}</label>
              <input type="date" value={editForm.date} onChange={e => setEditForm(p => ({ ...p, date: e.target.value }))} style={inp} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={lbl}>{lang === 'th' ? 'ชื่อรายการ' : 'Item Name'}</label>
              <input type="text" value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                placeholder={lang === 'th' ? 'เช่น ค่าข้าว' : 'e.g. Lunch'} style={inp} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={lbl}>{lang === 'th' ? 'จำนวนเงิน (บาท)' : 'Amount (THB)'}</label>
              <input type="number" value={editForm.amount} onChange={e => setEditForm(p => ({ ...p, amount: e.target.value }))}
                inputMode="decimal" style={{ ...inp, fontSize: 18, fontWeight: 600 }} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={lbl}>{lang === 'th' ? 'หมวดหมู่' : 'Category'}</label>
              <select value={editForm.category} onChange={e => setEditForm(p => ({ ...p, category: e.target.value }))} style={inp}>
                <option value="">{lang === 'th' ? '-- เลือกหมวด --' : '-- Select --'}</option>
                {categories.map(c => <option key={c.id} value={c.name}>{c.icon} {c.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={lbl}>{lang === 'th' ? 'ผู้จ่าย' : 'Paid by'}</label>
              <select value={editForm.payer} onChange={e => setEditForm(p => ({ ...p, payer: e.target.value }))} style={inp}>
                <option value="">{lang === 'th' ? '-- เลือกผู้จ่าย --' : '-- Select --'}</option>
                {memberNames.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={lbl}>{lang === 'th' ? 'วิธีชำระเงิน' : 'Payment Method'}</label>
              <select value={editForm.payment_id} onChange={e => setEditForm(p => ({ ...p, payment_id: e.target.value }))} style={inp}>
                <option value="">{lang === 'th' ? '-- เลือกวิธีชำระ --' : '-- Select --'}</option>
                {payments.map(pm => {
                  const label = `${pm.name}${pm.last4 ? ` ···${pm.last4}` : ''} (${pm.owner || 'ร่วมกัน'})`
                  const isSelected = editForm.payment_id && (
                    editForm.payment_id === label ||
                    editForm.payment_id.replace(/\s+/g, ' ').trim() === label.replace(/\s+/g, ' ').trim()
                  )
                  return <option key={pm.id} value={label} selected={isSelected}>{label}</option>
                })}
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>{lang === 'th' ? 'หมายเหตุ (ไม่บังคับ)' : 'Note (optional)'}</label>
              <input type="text" value={editForm.note} onChange={e => setEditForm(p => ({ ...p, note: e.target.value }))}
                placeholder={lang === 'th' ? 'หมายเหตุเพิ่มเติม' : 'Additional notes'} style={inp} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setEditingTx(null)}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #ddd', background: '#fff', fontSize: 14, cursor: 'pointer' }}>
                {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button onClick={() => handleDelete(editingTx)} disabled={deleting || saving}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#D85A30', color: '#fff', fontSize: 14, fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1 }}>
                {deleting ? '...' : '🗑'}
              </button>
              <button onClick={handleSaveEdit} disabled={saving || deleting}
                style={{ flex: 2, padding: 12, borderRadius: 10, border: 'none', background: '#1D9E75', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? '...' : (lang === 'th' ? '✅ บันทึก' : '✅ Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIST */}
      {filtered.length === 0
        ? <div style={{ fontSize: 14, color: '#888' }}>{lang==='en'?'No transactions':'ยังไม่มีรายการ'}</div>
        : filtered.map((tx, i) => {
            const pmLabel    = tx.payment_id || ''
            const pmOwner    = resolveOwnerFromLabel(pmLabel, tx.payer)
            const ownerIdx   = memberNames.indexOf(pmOwner)
            const ownerColor = ownerIdx >= 0 ? MEMBER_COLORS[ownerIdx % MEMBER_COLORS.length] : '#aaa'
            const icon       = catIconMap[tx.category] || '📌'
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid #f5f5f0' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: '#fff4f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  {icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.name}</div>
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: '0 6px' }}>
                    <span>{tx.date}</span>
                    {tx.category && tx.category !== '-' && <span>· {tx.category}</span>}
                    {pmLabel && <span>· {pmNameShort(pmLabel)}</span>}
                    {tx.note && <span>· {tx.note}</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#D85A30' }}>-{fmt(parseFloat(tx.amount) || 0)}</div>
                  <div style={{ fontSize: 11, color: ownerColor, fontWeight: 600 }}>{pmOwner || tx.payer}</div>
                </div>
                {/* Edit button */}
                <button onClick={() => openEdit(tx)} style={{ width: 28, height: 28, border: 'none', borderRadius: 8, background: '#f5f5f0', cursor: 'pointer', fontSize: 13, flexShrink: 0 }}>✏️</button>
              </div>
            )
          })
      }
    </Section>
  )
}

// ============================================================
//  DIRECT DEBT LIST — Edit / Delete Modal
// ============================================================
function DirectDebtList({ directs, memberNames, monthKey, lang, onReload, GAS_URL }) {
  const [editingTx, setEditingTx] = useState(null)
  const [editForm,  setEditForm]  = useState({})
  const [saving,    setSaving]    = useState(false)
  const [deleting,  setDeleting]  = useState(false)

  const sortByDate = (arr) => [...arr].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))

  const openEdit = (tx) => {
    setEditingTx(tx)
    setEditForm({ date: tx.date || '', from: tx.payer || '', to: tx.to || '', amount: tx.amount || '', note: tx.note || '' })
  }

  const handleDelete = async (tx) => {
    if (!confirm(lang==='en'?'Delete this debt?':'ลบรายการหนี้นี้?')) return
    setDeleting(true)
    try {
      const params = new URLSearchParams({ action: 'deleteTransaction', month: monthKey, created_at: normalizeCreatedAt(tx.created_at) })
      const data = await fetch(`${GAS_URL}?${params}`).then(r => r.json())
      if (data.status === 'ok') { setEditingTx(null); onReload() }
      else alert('Error: ' + (data.message || 'Unknown'))
    } catch { alert('Connection error') }
    setDeleting(false)
  }

  const handleSaveEdit = async () => {
    if (!editForm.from || !editForm.to || !editForm.amount) return
    if (editForm.from === editForm.to) { alert(lang==='en'?'Must be different people':'ต้องเป็นคนละคนกัน'); return }
    setSaving(true)
    try {
      const params = new URLSearchParams({
        action:     'editTransaction',
        month:      monthKey,
        created_at: normalizeCreatedAt(editingTx.created_at),
        date:       editForm.date,
        name:       editForm.note.trim() || (lang==='en'?'Direct Debt':'หนี้โดยตรง'),
        amount:     editForm.amount,
        category:   '-',
        payer:      editForm.from,
        payment_id: '',
        note:       editForm.note || '',
        to:         editForm.to,
      })
      const data = await fetch(`${GAS_URL}?${params}`).then(r => r.json())
      if (data.status === 'ok') { setEditingTx(null); onReload() }
      else alert('Error: ' + (data.message || 'Unknown'))
    } catch (e) { alert('Connection error: ' + e.message) }
    setSaving(false)
  }

  const inp = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e0e0d8', fontSize: 14, boxSizing: 'border-box', background: '#fff' }
  const lbl = { fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }

  return (
    <Section title={lang==='en'?`Debt (${directs.length} items)`:`หนี้ (${directs.length} รายการ)`}>

      {/* EDIT MODAL */}
      {editingTx && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: 480, borderRadius: '16px 16px 0 0', padding: '20px 20px 36px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: '#BA7517' }}>
              {lang === 'th' ? '✏️ แก้ไขหนี้' : '✏️ Edit Debt'}
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={lbl}>{lang === 'th' ? 'วันที่' : 'Date'}</label>
              <input type="date" value={editForm.date} onChange={e => setEditForm(p => ({ ...p, date: e.target.value }))} style={inp} />
            </div>

            <div style={{ background: '#fff8e6', borderRadius: 10, padding: '12px 14px', marginBottom: 10, border: '1px solid #f0d080' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={lbl}>{lang === 'th' ? 'ลูกหนี้' : 'Debtor'}</label>
                  <select value={editForm.from} onChange={e => setEditForm(p => ({ ...p, from: e.target.value }))} style={inp}>
                    <option value="">-- {lang === 'th' ? 'เลือก' : 'Select'} --</option>
                    {memberNames.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div style={{ fontSize: 20, color: '#BA7517', flexShrink: 0, paddingTop: 18 }}>→</div>
                <div style={{ flex: 1 }}>
                  <label style={lbl}>{lang === 'th' ? 'เจ้าหนี้' : 'Creditor'}</label>
                  <select value={editForm.to} onChange={e => setEditForm(p => ({ ...p, to: e.target.value }))} style={inp}>
                    <option value="">-- {lang === 'th' ? 'เลือก' : 'Select'} --</option>
                    {memberNames.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={lbl}>{lang === 'th' ? 'จำนวนเงิน (บาท)' : 'Amount (THB)'}</label>
              <input type="number" value={editForm.amount} onChange={e => setEditForm(p => ({ ...p, amount: e.target.value }))}
                inputMode="decimal" style={{ ...inp, fontSize: 18, fontWeight: 600 }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>{lang === 'th' ? 'หมายเหตุ (ไม่บังคับ)' : 'Note (optional)'}</label>
              <input type="text" value={editForm.note} onChange={e => setEditForm(p => ({ ...p, note: e.target.value }))}
                placeholder={lang === 'th' ? 'หมายเหตุเพิ่มเติม' : 'Additional notes'} style={inp} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setEditingTx(null)}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #ddd', background: '#fff', fontSize: 14, cursor: 'pointer' }}>
                {lang === 'th' ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button onClick={() => handleDelete(editingTx)} disabled={deleting || saving}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#D85A30', color: '#fff', fontSize: 14, fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1 }}>
                {deleting ? '...' : '🗑'}
              </button>
              <button onClick={handleSaveEdit} disabled={saving || deleting}
                style={{ flex: 2, padding: 12, borderRadius: 10, border: 'none', background: '#BA7517', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? '...' : (lang === 'th' ? '✅ บันทึก' : '✅ Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIST */}
      {sortByDate(directs).map((tx, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid #f5f5f0' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: '#fff4e6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>💸</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{tx.name}</div>
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>
              <span>{tx.date}</span>
              <span> · {tx.payer} → {tx.to}</span>
              {tx.note && tx.note !== tx.name && <span> · {tx.note}</span>}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#BA7517' }}>฿{(parseFloat(tx.amount) || 0).toLocaleString()}</div>
            <div style={{ fontSize: 11, color: '#aaa' }}>{lang==='en'?'debt':'โดยตรง'}</div>
          </div>
          <button onClick={() => openEdit(tx)} style={{ width: 28, height: 28, border: 'none', borderRadius: 8, background: '#fff8e6', cursor: 'pointer', fontSize: 13, flexShrink: 0 }}>✏️</button>
        </div>
      ))}
    </Section>
  )
}

function Metric({ label, value, color }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', border: '1px solid #eee' }}>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || '#1a1a1a' }}>{value}</div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', marginBottom: 12, border: '1px solid #eee' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#888', marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  )
}

const S = {
  navBtn: { width: 36, height: 36, borderRadius: '50%', border: '1px solid #e0e0d8', background: '#fff', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#555' },
  iconBtn: { width: 36, height: 36, borderRadius: '50%', border: '1px solid #e0e0d8', background: '#fff', fontSize: 16, cursor: 'pointer', color: '#555' }
}
