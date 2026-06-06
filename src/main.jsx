import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import AddTransaction    from './liff/AddTransaction.jsx'
import ManagePayments    from './liff/ManagePayments.jsx'
import ManageCategories  from './liff/ManageCategories.jsx'
import ManagePayers      from './liff/ManagePayers.jsx'
import BottomNav         from './components/BottomNav.jsx'
import './index.css'

function Router() {
  const path = window.location.pathname
  const params = new URLSearchParams(window.location.search)
  const liffState = decodeURIComponent(params.get('liff.state') || '')
  const effectivePath = liffState || path

  // แสดง debug บนหน้าจอ
  return (
    <div style={{padding: 20, wordBreak: 'break-all'}}>
      <p><b>pathname:</b> {path}</p>
      <p><b>liff.state:</b> {liffState}</p>
      <p><b>effectivePath:</b> {effectivePath}</p>
      <p><b>full URL:</b> {window.location.href}</p>
    </div>
  )
}
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <div style={{ paddingBottom: 60 }}>
      <Router />
    </div>
    <BottomNav />
  </React.StrictMode>
)