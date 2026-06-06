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

  console.log('DEBUG pathname:', path)
  console.log('DEBUG liff.state:', liffState)
  console.log('DEBUG effectivePath:', effectivePath)
  console.log('DEBUG full URL:', window.location.href)

  if (effectivePath.includes('/liff/add'))        return <AddTransaction />
  if (effectivePath.includes('/liff/payments'))   return <ManagePayments />
  if (effectivePath.includes('/liff/categories')) return <ManageCategories />
  if (effectivePath.includes('/liff/payers'))     return <ManagePayers />
  return <App />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <div style={{ paddingBottom: 60 }}>
      <Router />
    </div>
    <BottomNav />
  </React.StrictMode>
)