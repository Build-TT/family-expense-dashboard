import { useState, useEffect, useCallback } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts'

const SHEET_ID    = import.meta.env.VITE_SHEET_ID || 'YOUR_SPREADSHEET_ID'
const API_KEY     = import.meta.env.VITE_API_KEY  || 'YOUR_GOOGLE_API_KEY'
const SHEETS_BASE = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values`
const MEMBERS     = ['Oy', 'Build']
const MONTHS_TH   = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
const CAT_COLORS  = ['#1D9E75','#378ADD','#D85A30','#BA7517','#7F77DD','#D4537E','#639922','#0F6E56']
const MEMBER_COLORS = ['#378ADD','#D4537E','#1D9E75','#BA7517']

const fmt = (n) => '฿' + Math.round(n).toLocaleString()

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


// เจ้าของบัตรจริงๆ: เงินสด = ผู้จ่าย, ร่วมกัน = หารเท่า, อื่นๆ = เจ้าของบัตร
function resolveOwner(t, pm) {
  if (!pm) return t.payer  // ไม่มีบัตร → ใช้ผู้จ่าย
  if (pm.type === 'cash') return t.payer  // เงินสด → ใช้ผู้จ่าย
  if (!pm.owner || pm.owner === 'ร่วมกัน') return 'ร่วมกัน'
  return pm.owner
}
function computeSettlement(transactions, members, payments) {
  const paid = {}
  members.forEach(m => paid[m] = 0)
  let total = 0

  transactions.forEach(t => {
    if (t.type !== 'expense') return
    const amt = parseFloat(t.amount) || 0
    total += amt

    const pm    = (payments || []).find(p => p.id === t.payment_id)
    const owner = resolveOwner(t, pm)

    if (owner === 'ร่วมกัน') {
      const share = amt / (members.length || 1)
      members.forEach(m => { if (paid[m] !== undefined) paid[m] += share })
    } else {
      if (paid[owner] !== undefined) paid[owner] += amt
    }
  })

  const perPerson = members.length > 0 ? total / members.length : 0
  const balances  = members.map(m => ({
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
//  SETTLEMENT BAR COMPONENT — สไตล์ VS bar ตามรูป
// ============================================================
function SettlementBar({ balances, settlements }) {
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
        <div style={{ fontSize: 14, color: '#1D9E75', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>✓</span> ทุกคนจ่ายเท่ากัน ไม่ต้องชำระคืน
        </div>
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
//  APP
// ============================================================
export default function App() {
  const now   = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  const [transactions, setTransactions] = useState([])
  const [members,      setMembers]      = useState(MEMBERS)
  const [categories,   setCategories]   = useState([])
  const [payments,     setPayments]     = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [lastRefresh,  setLastRefresh]  = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [txRows, memRows, catRows, payRows] = await Promise.all([
        fetchSheet('transactions'),
        fetchSheet('members'),
        fetchSheet('categories'),
        fetchSheet('payment_methods'),
      ])
      setTransactions(txRows)
      const loadedMembers = memRows.filter(r => r.active === 'TRUE').map(r => r.name)
      setMembers(loadedMembers.length > 0 ? loadedMembers : MEMBERS)
      setCategories(catRows.filter(r => r.active === 'TRUE'))
      setPayments(payRows.filter(r => r.active === 'TRUE'))
      setLastRefresh(new Date())
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = transactions.filter(t => {
    if (!t.date) return false
    const d = new Date(t.date)
    return d.getFullYear() === year && d.getMonth() === month
  })

  const expenses = filtered.filter(t => t.type === 'expense')
  const income   = filtered.filter(t => t.type === 'income').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0)
  const { total, perPerson, balances, settlements } = computeSettlement(filtered, members, payments)

  const byCat = {}
  expenses.forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + (parseFloat(t.amount) || 0) })
  const catData = Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value: Math.round(value) }))

  // รายจ่ายตามวิธีชำระ + เจ้าของบัตร
  // ใช้ "ชื่อบัตร|owner" เป็น key เพื่อแยกบัตรชื่อเดียวกันแต่คนละเจ้าของ
  const byPay = {}
  expenses.forEach(t => {
    const pm      = payments.find(p => p.id === t.payment_id)
    const pmName  = pm ? pm.name + (pm.last4 ? ' ···' + pm.last4 : '') : 'ไม่ระบุ'
    const owner   = resolveOwner(t, pm)
    const label   = pmName + (owner && owner !== 'ร่วมกัน' ? ' (' + owner + ')' : '')
    const dispName = pmName
    if (!byPay[label]) byPay[label] = { total: 0, owner, dispName }
    byPay[label].total += (parseFloat(t.amount) || 0)
  })

  // สรุปรายจ่ายรวมของแต่ละคน (จากเจ้าของบัตร)
  const byOwner = {}
  members.forEach(m => byOwner[m] = 0)
  expenses.forEach(t => {
    const pm    = payments.find(p => p.id === t.payment_id)
    const owner = resolveOwner(t, pm)
    const amt   = parseFloat(t.amount) || 0
    if (owner === 'ร่วมกัน') {
      members.forEach(m => { if (byOwner[m] !== undefined) byOwner[m] += amt / members.length })
    } else {
      if (byOwner[owner] !== undefined) byOwner[owner] += amt
    }
  })

  // map category name → icon จาก sheet
  const catIconMap = {}
  categories.forEach(c => { catIconMap[c.name] = c.icon || '' })

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const nextMonth = () => {
    if (year === now.getFullYear() && month === now.getMonth()) return
    if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1)
  }
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px 16px 48px' }}>

      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 600 }}>Expense Tracker</div>
          <div style={{ fontSize: 13, color: '#888' }}>Oy & Build{lastRefresh ? ' · อัปเดต ' + lastRefresh.toLocaleTimeString('th') : ''}</div>
        </div>
        <button onClick={load} style={S.iconBtn} title="รีเฟรช">↻</button>
      </div>

      {/* MONTH SELECTOR */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 20 }}>
        <button onClick={prevMonth} style={S.navBtn}>‹</button>
        <div style={{ fontSize: 18, fontWeight: 600, minWidth: 120, textAlign: 'center' }}>{MONTHS_TH[month]} {year}</div>
        <button onClick={nextMonth} style={{ ...S.navBtn, opacity: isCurrentMonth ? 0.3 : 1 }} disabled={isCurrentMonth}>›</button>
      </div>

      {error && (
        <div style={{ background: '#FCEBEB', border: '1px solid #F09595', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#A32D2D' }}>
          เชื่อมต่อ Google Sheet ไม่ได้: {error}<br />
          <span style={{ color: '#888' }}>ตรวจสอบ VITE_SHEET_ID และ VITE_API_KEY ใน Vercel Settings</span>
        </div>
      )}

      {loading && <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>กำลังโหลดข้อมูล...</div>}

      {!loading && !error && <>

        {/* METRICS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 12 }}>
          <Metric label="รายรับรวม"  value={fmt(income)}    color="#1D9E75" />
          <Metric label="รายจ่ายรวม" value={fmt(total)}     color="#D85A30" />
          <Metric label="เฉลี่ย/คน"  value={fmt(perPerson)} />
          <Metric label="รายการ"      value={expenses.length + ' รายการ'} />
        </div>

        {/* SETTLEMENT */}
        <Section title="เปรียบเทียบรายจ่าย">
          <SettlementBar balances={balances} settlements={settlements} total={total} />
        </Section>

        {/* CHARTS */}
        {catData.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 12 }}>
            <Section title="รายจ่ายตามหมวดหมู่">
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
                    <div style={{ fontSize: 11, color: '#888', minWidth: 34, textAlign: 'right' }}>{Math.round(c.value / total * 100)}%</div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="รายจ่ายแต่ละคน">
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
              <div style={{ marginTop: 6, fontSize: 12, color: '#888', textAlign: 'center' }}>เฉลี่ย {fmt(perPerson)} / คน</div>
            </Section>
          </div>
        )}

        {/* วิธีชำระ */}
        {Object.keys(byPay).length > 0 && (
          <Section title="รายจ่ายตามวิธีชำระ">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {Object.entries(byPay).sort((a, b) => b[1].total - a[1].total).map(([key, data]) => {
                const ownerIdx   = members.indexOf(data.owner)
                const barColor   = ownerIdx >= 0 ? MEMBER_COLORS[ownerIdx % MEMBER_COLORS.length] : '#888780'
                const ownerLabel = data.owner || 'ไม่ระบุ'
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 120, minWidth: 120, flexShrink: 0 }}>
                      <div style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.dispName}</div>
                      <div style={{ fontSize: 11, color: barColor, fontWeight: 600 }}>{ownerLabel}</div>
                    </div>
                    <div style={{ flex: 1, background: '#f0f0ec', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: barColor, borderRadius: 4, width: Math.round(data.total / total * 100) + '%' }} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, minWidth: 72, textAlign: 'right' }}>{fmt(data.total)}</div>
                    <div style={{ fontSize: 11, color: '#888', minWidth: 30, textAlign: 'right' }}>{Math.round(data.total / total * 100)}%</div>
                  </div>
                )
              })}
            </div>
            <div style={{ borderTop: '1px solid #f0f0ec', paddingTop: 12 }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 8, fontWeight: 600 }}>สรุปรายจ่ายตามเจ้าของบัตร</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {members.map((m, i) => (
                  <div key={m} style={{ flex: 1, minWidth: 100, background: '#f8f8f5', borderRadius: 8, padding: '10px 14px', borderLeft: `3px solid ${MEMBER_COLORS[i % MEMBER_COLORS.length]}` }}>
                    <div style={{ fontSize: 12, color: '#888' }}>{m}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: MEMBER_COLORS[i % MEMBER_COLORS.length] }}>{fmt(byOwner[m] || 0)}</div>
                    <div style={{ fontSize: 11, color: '#aaa' }}>{Math.round((byOwner[m] || 0) / total * 100)}%</div>
                  </div>
                ))}
              </div>
            </div>
          </Section>
        )}

        {/* TRANSACTION LIST — มี icon หมวดหมู่ */}
        <Section title={`รายการทั้งหมด (${expenses.length} รายการ)`}>
          {expenses.length === 0
            ? <div style={{ fontSize: 14, color: '#888' }}>ยังไม่มีรายการในเดือนนี้</div>
            : [...filtered].reverse().map((t, i) => {
                const pm    = payments.find(p => p.id === t.payment_id)
                const isExp = t.type === 'expense'
                const icon  = catIconMap[t.category] || '📌'
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid #f5f5f0' }}>
                    {/* Category icon badge */}
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: isExp ? '#fff4f0' : '#f0faf5',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18
                    }}>
                      {icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: '#aaa', marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: '0 6px' }}>
                        <span>{t.date}</span>
                        {t.category && <span>· {t.category}</span>}
                        {pm && <span>· {pm.name}{pm.last4 ? ' ···' + pm.last4 : ''}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: isExp ? '#D85A30' : '#1D9E75' }}>
                        {isExp ? '-' : '+'}{fmt(parseFloat(t.amount) || 0)}
                      </div>
                      {(() => {
                        const pmOwner  = resolveOwner(t, pm)
                        const ownerIdx = members.indexOf(pmOwner)
                        const ownerColor = ownerIdx >= 0 ? MEMBER_COLORS[ownerIdx % MEMBER_COLORS.length] : '#aaa'
                        return <div style={{ fontSize: 11, color: ownerColor, fontWeight: 600 }}>{pmOwner || t.payer}</div>
                      })()}
                    </div>
                  </div>
                )
              })
          }
        </Section>
      </>}
    </div>
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
