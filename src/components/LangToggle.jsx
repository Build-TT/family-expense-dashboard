import { useState, useEffect } from 'react'
import { getLang, setLang, LANGS } from '../i18n'

export default function LangToggle() {
  const [lang, setLangState] = useState(getLang())

  useEffect(() => {
    const handler = () => setLangState(getLang())
    window.addEventListener('langchange', handler)
    return () => window.removeEventListener('langchange', handler)
  }, [])

  const toggle = () => {
    const next = lang === LANGS.TH ? LANGS.EN : LANGS.TH
    setLang(next)
    setLangState(next)
  }

  return (
    <button onClick={toggle} style={{
      display: 'flex', alignItems: 'center', gap: 4,
      padding: '4px 10px', borderRadius: 20,
      border: '1px solid #e0e0d8', background: '#fff',
      cursor: 'pointer', fontSize: 13, fontWeight: 600,
      color: '#555'
    }}>
      {lang === LANGS.TH ? '🇹🇭 TH' : '🇺🇸 EN'}
    </button>
  )
}
