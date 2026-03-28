import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

// ============================================================
//  CONFIG — แก้ค่าทั้ง 2 นี้
// ============================================================
const SHEET_ID  = import.meta.env.VITE_SHEET_ID  || 'YOUR_SPREADSHEET_ID'
const API_KEY   = import.meta.env.VITE_API_KEY    || 'YOUR_GOOGLE_API_KEY'

const SHEETS_BASE = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values`

// ============================================================
//  CONSTANTS
// ============================================================
const MEMBERS  = ['Oy', 'Build']
const CAT_COLORS = ['#1D9E75','#378ADD','#D85A30','#BA7517','#7F77DD','#D4537E','#888780','#0F6E56']
const MONTHS_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']

const fmt    = (n) => '฿' + Math.round(n).toLocaleString()
const fmtNum = (n) => Math.round(n).toLocaleString()

// ============================================================
//  FETCH SHEET DATA
// ============================================================
async function fetchSheet(sheetName) {
  const url = `${SHEETS_BASE}/${encodeURIComponent(sheetName)}?key=${API_KEY}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Cannot fetch ${sheetName}: ${res.status}`)
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

// ============================================================
//  COMPUTE SETTLEMENT
//  หารเท่า แล้วดูว่าใครจ่ายเกิน/ขาด
// ============================================================
function computeSettlement(transactions, members) {
  const paid = {}
  members.forEach(m => paid[m] = 0)
  let total = 0

  transactions.forEach(t => {
    if (t.type !== 'expense') return
    const amt = parseFloat(t.amount) || 0
    total += amt
    if (paid[t.payer] !== undefined) paid[t.payer] += amt
  })

  const perPerson = total / members.length
  const balances  = members.map(m => ({ name: m, paid: paid[m] || 0, balance: (paid[m] || 0) - perPerson }))

  // คำนวณว่าใครโอนให้ใคร
  const settlements = []
  const debtors    = balances.filter(b => b.balance < -1).map(b => ({ ...b }))
  const creditors  = balances.filter(b => b.balance >  1).map(b => ({ ...b }))
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
//  APP
// ============================================================
export default function App() {
  const now          = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth()) // 0-indexed

  const [transactions, setTransactions] = useState([])
  const [members,      setMembers]      = useState(MEMBERS)
  const [categories,   setCategories]   = useState([])
  const [payments,     setPayments]     = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [lastRefresh,  setLastRefresh]  = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [txRows, memRows, catRows, payRows] = await Promise.all([
        fetchSheet('transactions'),
        fetchSheet('members'),
        fetchSheet('categories'),
        fetchSheet('payment_methods'),
      ])
      setTransactions(txRows)
      setMembers(memRows.filter(r => r.active === 'TRUE').map(r => r.name))
      setCategories(catRows.filter(r => r.active === 'TRUE'))
      setPayments(payRows.filter(r => r.active === 'TRUE'))
      setLastRefresh(new Date())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // กรองข้อมูลตามเดือน/ปีที่เลือก
  const filtered = transactions.filter(t => {
    if (!t.date) return false
    const d = new Date(t.date)
    return d.getFullYear() === year && d.getMonth() === month
  })

  const expenses = filtered.filter(t => t.type === 'expense')
  const income   = filtered.filter(t => t.type === 'income').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0)
  const { total, perPerson, balances, settlements } = computeSettlement(filtered, members)

  // สรุปตามหมวดหมู่
  const byCat = {}
  expenses.forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + (parseFloat(t.amount) || 0) })
  const catData = Object.entries(byCat).sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value: Math.round(value) }))

  // สรุปตามวิธีชำระ
  const byPay = {}
  expenses.forEach(t => {
    const pm = payments.find(p => p.id === t.payment_id)
    const label = pm ? pm.name + (pm.last4 ? ' ···' + pm.last4 : '') : 'ไม่ระบุ'
    byPay[label] = (byPay[label] || 0) + (parseFloat(t.amount) || 0)
  })

  // ย้อนหลัง / ถัดไป
  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const nextMonth = () => {
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()
    if (isCurrentMonth) return
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={load} style={styles.iconBtn} title="รีเฟรช">↻</button>
        </div>
      </div>

      {/* MONTH SELECTOR */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 20 }}>
        <button onClick={prevMonth} style={styles.navBtn}>‹</button>
        <div style={{ fontSize: 18, fontWeight: 600, minWidth: 120, textAlign: 'center' }}>
          {MONTHS_TH[month]} {year}
        </div>
        <button onClick={nextMonth} style={{ ...styles.navBtn, opacity: isCurrentMonth ? 0.3 : 1 }} disabled={isCurrentMonth}>›</button>
      </div>

      {/* ERROR */}
      {error && (
        <div style={{ background: '#FCEBEB', border: '1px solid #F09595', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#A32D2D' }}>
          เชื่อมต่อ Google Sheet ไม่ได้: {error}<br />
          <span style={{ color: '#888' }}>ตรวจสอบ VITE_SHEET_ID และ VITE_API_KEY ใน Vercel Settings</span>
        </div>
      )}

      {/* LOADING */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#888', fontSize: 14 }}>กำลังโหลดข้อมูล...</div>
      )}

      {!loading && !error && (
        <>
          {/* METRICS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 16 }}>
            <Metric label="รายรับรวม"   value={fmt(income)} color="#1D9E75" />
            <Metric label="รายจ่ายรวม"  value={fmt(total)}  color="#D85A30" />
            <Metric label="เฉลี่ย/คน"   value={fmt(perPerson)} />
            <Metric label="รายการ"       value={expenses.length + ' รายการ'} />
          </div>

          {/* SETTLEMENT */}
          <Section title="ยอดชำระคืน">
            {settlements.length === 0 ? (
              <div style={{ fontSize: 14, color: '#1D9E75', padding: '8px 0' }}>✓ ทุกคนจ่ายเท่ากัน ไม่ต้องชำระคืน</div>
            ) : settlements.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < settlements.length - 1 ? '1px solid #f0f0ec' : 'none' }}>
                <div style={{ fontSize: 14 }}>
                  <span style={{ fontWeight: 600, color: '#D85A30' }}>{s.from}</span>
                  <span style={{ color: '#888', margin: '0 8px' }}>→</span>
                  <span style={{ fontWeight: 600, color: '#1D9E75' }}>{s.to}</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#D85A30' }}>{fmt(s.amount)}</div>
              </div>
            ))}
            <div style={{ marginTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {balances.map(b => (
                <div key={b.name} style={{ flex: 1, minWidth: 120, background: '#f8f8f5', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 12, color: '#888' }}>{b.name} จ่ายไป</div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>{fmt(b.paid)}</div>
                  <div style={{ fontSize: 12, color: b.balance >= 0 ? '#1D9E75' : '#D85A30' }}>
                    {b.balance >= 0 ? `รับคืน ${fmt(b.balance)}` : `ต้องจ่ายเพิ่ม ${fmt(-b.balance)}`}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* CHARTS */}
          {catData.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 12 }}>
              {/* Pie chart */}
              <Section title="รายจ่ายตามหมวดหมู่">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                      {catData.map((_, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  {catData.map((c, i) => (
                    <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: CAT_COLORS[i % CAT_COLORS.length], flexShrink: 0 }} />
                      <div style={{ flex: 1, fontSize: 13 }}>{c.name}</div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{fmt(c.value)}</div>
                      <div style={{ fontSize: 11, color: '#888', minWidth: 34, textAlign: 'right' }}>{Math.round(c.value / total * 100)}%</div>
                    </div>
                  ))}
                </div>
              </Section>

              {/* Bar chart รายจ่ายแต่ละคน */}
              <Section title="รายจ่ายแต่ละคน">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={balances} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 13 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => '฿' + (v/1000).toFixed(0) + 'k'} />
                    <Tooltip formatter={v => fmt(v)} />
                    <Bar dataKey="paid" radius={[4,4,0,0]}>
                      {balances.map((_, i) => <Cell key={i} fill={['#378ADD','#D4537E'][i % 2]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ marginTop: 8, fontSize: 12, color: '#888', textAlign: 'center' }}>
                  เส้นเฉลี่ย {fmt(perPerson)} / คน
                </div>
              </Section>
            </div>
          )}

          {/* วิธีชำระเงิน */}
          {Object.keys(byPay).length > 0 && (
            <Section title="รายจ่ายตามวิธีชำระ">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(byPay).sort((a,b) => b[1]-a[1]).map(([name, val]) => (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 120, fontSize: 13, flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                    <div style={{ flex: 1, background: '#f0f0ec', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: '#378ADD', borderRadius: 4, width: Math.round(val / total * 100) + '%' }} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, minWidth: 80, textAlign: 'right' }}>{fmt(val)}</div>
                    <div style={{ fontSize: 11, color: '#888', minWidth: 34, textAlign: 'right' }}>{Math.round(val/total*100)}%</div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* TRANSACTION LIST */}
          <Section title={`รายการทั้งหมด (${expenses.length} รายการ)`}>
            {expenses.length === 0 ? (
              <div style={{ fontSize: 14, color: '#888', padding: '8px 0' }}>ยังไม่มีรายการในเดือนนี้</div>
            ) : (
              <div>
                {[...filtered].reverse().map((t, i) => {
                  const pm = payments.find(p => p.id === t.payment_id)
                  const isExp = t.type === 'expense'
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid #f0f0ec' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                        <div style={{ fontSize: 11, color: '#888', marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: '0 8px' }}>
                          <span>{t.date}</span>
                          {t.category && <span>{t.category}</span>}
                          {pm && <span>{pm.name}{pm.last4 ? ' ···' + pm.last4 : ''}</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: isExp ? '#D85A30' : '#1D9E75' }}>
                          {isExp ? '-' : '+'}{fmt(parseFloat(t.amount) || 0)}
                        </div>
                        <div style={{ fontSize: 11, color: '#888' }}>{t.payer}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  )
}

// ============================================================
//  COMPONENTS
// ============================================================
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

// ============================================================
//  STYLES
// ============================================================
const styles = {
  navBtn: {
    width: 36, height: 36, borderRadius: '50%', border: '1px solid #e0e0d8',
    background: '#fff', fontSize: 18, display: 'flex', alignItems: 'center',
    justifyContent: 'center', cursor: 'pointer', color: '#555'
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: '50%', border: '1px solid #e0e0d8',
    background: '#fff', fontSize: 16, cursor: 'pointer', color: '#555'
  }
}
