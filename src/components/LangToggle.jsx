import { useState, useEffect } from 'react'
import { getLang, setLang, LANGS } from '../i18n'

export default function LangToggle() {
  const [lang, setLangState] = useState(getLang())

  useEffect(() => {
    const handler = () => setLangState(getLang())
    window.addEventListener('langchange', handler)
    return () => window.removeEventListener('langchange', handler)
  }, [])

  const select = (l) => {
    setLang(l)
    setLangState(l)
  }

  const btn = (l) => ({
    padding: '4px 12px', border: 'none', fontSize: 13, fontWeight: 700,
    cursor: 'pointer',
    background: lang === l ? '#1D9E75' : '#fff',
    color: lang === l ? '#fff' : '#aaa',
  })

  return (
    <div style={{
      display: 'inline-flex', borderRadius: 20, overflow: 'hidden',
      border: '1px solid #e0e0d8',
    }}>
      <button onClick={() => select(LANGS.TH)} style={btn(LANGS.TH)}>TH</button>
      <button onClick={() => select(LANGS.EN)} style={btn(LANGS.EN)}>EN</button>
    </div>
  )
}
