import { useState, useEffect, useRef } from 'react'
import { fetchSheet, sendToGAS } from './utils'
import BottomNav from '../components/BottomNav.jsx'
import LangToggle from '../components/LangToggle.jsx'
import { getLang, t } from '../i18n'

const TYPE_ICONS = { cash: '💵', credit: '💳', debit: '🏧', promptpay: '📱', ewallet: '👛', other: '💰' }
const TYPE_OPTIONS = ['cash','credit','debit','promptpay','ewallet','other']

const S = {
  wrap:   { maxWidth: 480, margin: '0 auto', padding: '0 0 130px', fontFamily: 'system-ui,sans-serif' },
  header: { background: '#BA7517', color: '#fff', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  body:   { padding: '16px 20px' },
  label:  { fontSize: 13, color: '#555', marginBottom: 6, display: 'block', fontWeight: 600 },
  input:  { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e0e0d8', fontSize: 15, outline: 'none', boxSizing: 'border-box' },
  select: { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e0e0d8', fontSize: 15, background: '#fff', boxSizing: 'border-box' },
  toast:  { position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', color: '#fff', padding: '10px 20px', borderRadius: 20, fontSize: 14, zIndex: 999 },
  iconBtn:{ width: 32, height: 32, border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
}

export default function ManagePayments() {
  const [lang, setLang]               = useState(getLang())
  const [pays, setPays]               = useState([])
  const [members, setMembers]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [savingOrder, setSavingOrder] = useState(false)
  const [toast, setToast]             = useState('')
  const [form, setForm]               = useState({ name: '', type: 'credit', last4: '', owner: '' })
  const [editing, setEditing]         = useState(null)
  const [dragging, setDragging]       = useState(null)
  const [orderChanged, setOrderChanged] = useState(false)
  const dragOver = useRef(null)

  useEffect(() => {
    const h = () => setLang(getLang())
    window.addEventListener('langchange', h)
    return () => window.removeEventListener('langchange', h)
  }, [])
  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const [pData, mData] = await Promise.all([fetchSheet('payment_methods'), fetchSheet('members')])
    const sorted = [...pData].sort((a, b) => (parseInt(a.order) || 999) - (parseInt(b.order) || 999))
    setPays(sorted.map((p, i) => ({ ...p, order: p.order || String(i + 1) })))
    setMembers(mData.filter(m => m.active === 'TRUE'))
    setLoading(false)
  }

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  // ===== DRAG & DROP =====
  const onDragStart = (i) => setDragging(i)
  const onDragEnter = (i) => { dragOver.current = i }
  const onDragEnd   = () => {
    if (dragging === null || dragOver.current === null || dragging === dragOver.current) { setDragging(null); return }
    const next = [...pays]
    const [moved] = next.splice(dragging, 1)
    next.splice(dragOver.current, 0, moved)
    setPays(next.map((p, i) => ({ ...p, order: String(i + 1) })))
    setDragging(null); dragOver.current = null; setOrderChanged(true)
  }

  // ===== UP / DOWN =====
  const moveItem = (i, dir) => {
    const next = [...pays], target = i + dir
    if (target < 0 || target >= next.length) return
    ;[next[i], next[target]] = [next[target], next[i]]
    setPays(next.map((p, j) => ({ ...p, order: String(j + 1) })))
    setOrderChanged(true)
  }

  // ===== MANUAL ORDER =====
  const handleOrderInput = (id, val) => {
    const num = parseInt(val)
    if (isNaN(num) || num < 1) return
    setPays(prev => {
      const idx = prev.findIndex(p => p.id === id)
      if (idx === -1) return prev
      const next = [...prev]
      const [item] = next.splice(idx, 1)
      next.splice(Math.min(num - 1, next.length), 0, item)
      return next.map((p, j) => ({ ...p, order: String(j + 1) }))
    })
    setOrderChanged(true)
  }

  // ===== SAVE ORDER =====
  const saveOrder = async () => {
    setSavingOrder(true)
    const orders = pays.map((p, i) => ({ id: p.id, order: i + 1 }))
    await sendToGAS({ action: 'reorderPayments', orders: JSON.stringify(orders) })
    setOrderChanged(false)
    showToast(t('success', lang))
    setSavingOrder(false)
  }

  // ===== ADD / EDIT =====
  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    const action  = editing ? 'editPayment' : 'addPayment'
    const payload = { action, ...form, name: form.name.trim(), owner: form.owner || 'ร่วมกัน' }
    if (editing) payload.id = editing
    const res = await sendToGAS(payload)
    if (res.status === 'ok') { showToast(t('success', lang)); setForm({ name: '', type: 'credit', last4: '', owner: '' }); setEditing(null); await load() }
    else showToast(t('error', lang))
    setSaving(false)
  }

  const handleRemove = async (id) => {
    if (!confirm(lang === 'th' ? 'ลบวิธีชำระนี้?' : 'Delete this payment method?')) return
    await sendToGAS({ action: 'removePayment', id })
    await load()
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>{t('loading', lang)}</div>

  return (
    <div style={S.wrap}>
      {toast && <div style={S.toast}>{toast}</div>}

      <div style={S.header}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{t('managePayments', lang)}</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{pays.length} {lang === 'th' ? 'รายการ' : 'methods'}</div>
        </div>
        <LangToggle />
      </div>

      <div style={S.body}>
        <div style={{ fontSize: 12, color: '#aaa', marginBottom: 8, textAlign: 'center' }}>
          {t('dragHint', lang)} {lang === 'th' ? '· หรือใส่ตัวเลขลำดับ' : '· or type order number'}
        </div>

        {pays.map((p, i) => (
          <div key={p.id}
            draggable
            onDragStart={() => onDragStart(i)}
            onDragEnter={() => onDragEnter(i)}
            onDragEnd={onDragEnd}
            onDragOver={e => e.preventDefault()}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px', marginBottom: 4, borderRadius: 10,
              background: dragging === i ? '#fff8f0' : '#fff',
              border: '1px solid #f0f0ec', cursor: 'grab'
            }}>

            <span style={{ fontSize: 16, color: '#ccc', userSelect: 'none', flexShrink: 0 }}>≡</span>

            {/* Manual order input */}
            <input
              type="number" min="1" max={pays.length}
              value={i + 1}
              onChange={e => handleOrderInput(p.id, e.target.value)}
              style={{ width: 40, padding: '4px 6px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13, textAlign: 'center' }}
            />

            <span style={{ fontSize: 20, flexShrink: 0 }}>{TYPE_ICONS[p.type] || '💰'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.name}{p.last4 ? ` ···${p.last4}` : ''}
              </div>
              <div style={{ fontSize: 11, color: '#888' }}>
                {t(p.type, lang) || p.type} · {p.owner || t('shared', lang)}
              </div>
            </div>

            <button onClick={() => moveItem(i, -1)} disabled={i === 0}
              style={{ ...S.iconBtn, background: '#f5f5f0', opacity: i === 0 ? 0.3 : 1 }}>↑</button>
            <button onClick={() => moveItem(i, 1)} disabled={i === pays.length - 1}
              style={{ ...S.iconBtn, background: '#f5f5f0', opacity: i === pays.length - 1 ? 0.3 : 1 }}>↓</button>
            <button onClick={() => { setEditing(p.id); setForm({ name: p.name, type: p.type || 'credit', last4: p.last4 || '', owner: p.owner || '' }) }}
              style={{ ...S.iconBtn, background: '#fff8e6', color: '#BA7517' }}>✏️</button>
            <button onClick={() => handleRemove(p.id)}
              style={{ ...S.iconBtn, background: '#fee', color: '#D85A30' }}>🗑</button>
          </div>
        ))}

        {orderChanged && (
          <button onClick={saveOrder} disabled={savingOrder} style={{
            width: '100%', marginTop: 10, padding: '12px', borderRadius: 10,
            border: 'none', background: '#1D9E75', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer'
          }}>
            {savingOrder ? t('saving', lang) : t('saveOrder', lang)}
          </button>
        )}

        <div style={{ marginTop: 20, padding: 16, background: '#f8f8f5', borderRadius: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#555' }}>
            {editing ? t('edit', lang) : t('addPayment', lang)}
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={S.label}>{t('type', lang)}</label>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={S.select}>
              {TYPE_OPTIONS.map(tp => <option key={tp} value={tp}>{TYPE_ICONS[tp]} {t(tp, lang) || tp}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={S.label}>{t('paymentName', lang)}</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder={lang === 'th' ? 'เช่น KBank, SCB, เงินสด' : 'e.g. KBank, SCB, Cash'} style={S.input} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={S.label}>{t('last4', lang)}</label>
              <input value={form.last4} onChange={e => setForm(f => ({ ...f, last4: e.target.value.slice(0,4) }))}
                placeholder="1234" maxLength={4} style={S.input} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={S.label}>{t('owner', lang)}</label>
              <select value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} style={S.select}>
                <option value="">{t('shared', lang)}</option>
                {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {editing && (
              <button onClick={() => { setEditing(null); setForm({ name: '', type: 'credit', last4: '', owner: '' }) }}
                style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid #ddd', background: '#fff', fontSize: 14, cursor: 'pointer' }}>
                {t('cancel', lang)}
              </button>
            )}
            <button onClick={handleSave} disabled={saving || !form.name.trim()}
              style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none',
                background: form.name.trim() ? '#BA7517' : '#ccc', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              {saving ? t('saving', lang) : (editing ? t('save', lang) : t('addPayment', lang))}
            </button>
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  )
}
