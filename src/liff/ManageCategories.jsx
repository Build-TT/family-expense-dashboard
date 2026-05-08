import { useState, useEffect, useRef } from 'react'
import { fetchSheet, sendToGAS } from './utils'
import BottomNav from '../components/BottomNav.jsx'
import LangToggle from '../components/LangToggle.jsx'
import { getLang, t } from '../i18n'

const S = {
  wrap:   { maxWidth: 480, margin: '0 auto', padding: '0 0 130px', fontFamily: 'system-ui,sans-serif' },
  header: { background: '#7F77DD', color: '#fff', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  body:   { padding: '16px 20px' },
  label:  { fontSize: 13, color: '#555', marginBottom: 6, display: 'block', fontWeight: 600 },
  input:  { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e0e0d8', fontSize: 15, outline: 'none', boxSizing: 'border-box' },
  toast:  { position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: '#1a1a1a', color: '#fff', padding: '10px 20px', borderRadius: 20, fontSize: 14, zIndex: 999 },
  iconBtn:{ width: 32, height: 32, border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
}

export default function ManageCategories() {
  const [lang, setLang]               = useState(getLang())
  const [cats, setCats]               = useState([])
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [savingOrder, setSavingOrder] = useState(false)
  const [toast, setToast]             = useState('')
  const [form, setForm]               = useState({ name: '', icon: '' })
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
    const data = await fetchSheet('categories')
    const sorted = [...data].sort((a, b) => (parseInt(a.order) || 999) - (parseInt(b.order) || 999))
    // ถ้าไม่มี order ให้กำหนดเริ่มต้น
    setCats(sorted.map((c, i) => ({ ...c, order: c.order || String(i + 1) })))
    setLoading(false)
  }

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  // ===== DRAG & DROP =====
  const onDragStart = (i) => setDragging(i)
  const onDragEnter = (i) => { dragOver.current = i }
  const onDragEnd   = () => {
    if (dragging === null || dragOver.current === null || dragging === dragOver.current) { setDragging(null); return }
    const next = [...cats]
    const [moved] = next.splice(dragging, 1)
    next.splice(dragOver.current, 0, moved)
    setCats(next.map((c, i) => ({ ...c, order: String(i + 1) })))
    setDragging(null); dragOver.current = null; setOrderChanged(true)
  }

  // ===== UP / DOWN =====
  const moveItem = (i, dir) => {
    const next = [...cats], target = i + dir
    if (target < 0 || target >= next.length) return
    ;[next[i], next[target]] = [next[target], next[i]]
    setCats(next.map((c, j) => ({ ...c, order: String(j + 1) })))
    setOrderChanged(true)
  }

  // ===== MANUAL ORDER INPUT =====
  const handleOrderInput = (id, val) => {
    const num = parseInt(val)
    if (isNaN(num) || num < 1) return
    setCats(prev => {
      const idx   = prev.findIndex(c => c.id === id)
      if (idx === -1) return prev
      const next  = [...prev]
      const [item] = next.splice(idx, 1)
      const insertAt = Math.min(num - 1, next.length)
      next.splice(insertAt, 0, item)
      return next.map((c, j) => ({ ...c, order: String(j + 1) }))
    })
    setOrderChanged(true)
  }

  // ===== SAVE ORDER =====
  const saveOrder = async () => {
    setSavingOrder(true)
    const orders = cats.map((c, i) => ({ id: c.id, order: i + 1 }))
    await sendToGAS({ action: 'reorderCategories', orders: JSON.stringify(orders) })
    setOrderChanged(false)
    showToast(t('success', lang))
    setSavingOrder(false)
  }

  // ===== ADD / EDIT =====
  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    const action  = editing ? 'editCategory' : 'addCategory'
    const payload = { action, name: form.name.trim(), icon: form.icon || '📌' }
    if (editing) payload.id = editing
    const res = await sendToGAS(payload)
    if (res.status === 'ok') { showToast(t('success', lang)); setForm({ name: '', icon: '' }); setEditing(null); await load() }
    else showToast(t('error', lang))
    setSaving(false)
  }

  const handleRemove = async (id) => {
    if (!confirm(lang === 'th' ? 'ลบหมวดนี้?' : 'Delete this category?')) return
    await sendToGAS({ action: 'removeCategory', id })
    await load()
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>{t('loading', lang)}</div>

  return (
    <div style={S.wrap}>
      {toast && <div style={S.toast}>{toast}</div>}

      <div style={S.header}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{t('manageCategories', lang)}</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{cats.length} {lang === 'th' ? 'หมวด' : 'categories'}</div>
        </div>
        <LangToggle />
      </div>

      <div style={S.body}>
        <div style={{ fontSize: 12, color: '#aaa', marginBottom: 8, textAlign: 'center' }}>
          {t('dragHint', lang)} {lang === 'th' ? '· หรือใส่ตัวเลขลำดับ' : '· or type order number'}
        </div>

        {cats.map((cat, i) => (
          <div key={cat.id}
            draggable
            onDragStart={() => onDragStart(i)}
            onDragEnter={() => onDragEnter(i)}
            onDragEnd={onDragEnd}
            onDragOver={e => e.preventDefault()}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px', marginBottom: 4, borderRadius: 10,
              background: dragging === i ? '#f0f0f8' : '#fff',
              border: '1px solid #f0f0ec',
              cursor: 'grab', transition: 'background 0.15s'
            }}>

            {/* Drag handle */}
            <span style={{ fontSize: 16, color: '#ccc', userSelect: 'none', flexShrink: 0 }}>≡</span>

            {/* Manual order input */}
            <input
              type="number" min="1" max={cats.length}
              value={i + 1}
              onChange={e => handleOrderInput(cat.id, e.target.value)}
              style={{ width: 40, padding: '4px 6px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13, textAlign: 'center' }}
            />

            {/* Icon + Name */}
            <span style={{ fontSize: 20, flexShrink: 0 }}>{cat.icon || '📌'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</div>
              <div style={{ fontSize: 11, color: cat.active === 'TRUE' ? '#1D9E75' : '#aaa' }}>
                {cat.active === 'TRUE' ? t('active', lang) : t('inactive', lang)}
              </div>
            </div>

            {/* Up / Down */}
            <button onClick={() => moveItem(i, -1)} disabled={i === 0}
              style={{ ...S.iconBtn, background: '#f5f5f0', opacity: i === 0 ? 0.3 : 1 }}>↑</button>
            <button onClick={() => moveItem(i, 1)} disabled={i === cats.length - 1}
              style={{ ...S.iconBtn, background: '#f5f5f0', opacity: i === cats.length - 1 ? 0.3 : 1 }}>↓</button>

            {/* Edit / Delete */}
            <button onClick={() => { setEditing(cat.id); setForm({ name: cat.name, icon: cat.icon || '' }) }}
              style={{ ...S.iconBtn, background: '#eef', color: '#7F77DD' }}>✏️</button>
            <button onClick={() => handleRemove(cat.id)}
              style={{ ...S.iconBtn, background: '#fee', color: '#D85A30' }}>🗑</button>
          </div>
        ))}

        {/* Save order button */}
        {orderChanged && (
          <button onClick={saveOrder} disabled={savingOrder} style={{
            width: '100%', marginTop: 10, padding: '12px', borderRadius: 10,
            border: 'none', background: '#1D9E75', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer'
          }}>
            {savingOrder ? t('saving', lang) : t('saveOrder', lang)}
          </button>
        )}

        {/* Add / Edit form */}
        <div style={{ marginTop: 20, padding: 16, background: '#f8f8f5', borderRadius: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#555' }}>
            {editing ? t('edit', lang) : t('addCategory', lang)}
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={S.label}>{t('icon', lang)}</label>
              <input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                placeholder="📌" style={{ ...S.input, width: 56, textAlign: 'center', fontSize: 22 }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={S.label}>{t('categoryName', lang)}</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder={lang === 'th' ? 'เช่น อาหาร, เดินทาง' : 'e.g. Food, Transport'}
                style={S.input} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {editing && (
              <button onClick={() => { setEditing(null); setForm({ name: '', icon: '' }) }}
                style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid #ddd', background: '#fff', fontSize: 14, cursor: 'pointer' }}>
                {t('cancel', lang)}
              </button>
            )}
            <button onClick={handleSave} disabled={saving || !form.name.trim()}
              style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none',
                background: form.name.trim() ? '#7F77DD' : '#ccc', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              {saving ? t('saving', lang) : (editing ? t('save', lang) : t('addCategory', lang))}
            </button>
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  )
}
