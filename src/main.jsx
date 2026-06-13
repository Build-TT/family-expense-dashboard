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
  const params = new URLSearchParams(window.location.search)
  const liffState = decodeURIComponent(params.get('liff.state') || '')
  const path = window.location.pathname.replace(/\/$/, '')
  const page = new URLSearchParams(liffState.includes('?') ? liffState.split('?')[1] : '').get('page')
           || params.get('page')
           || (path.startsWith('/liff/') ? path.slice('/liff/'.length) : '')

  if (page === 'add')        return <AddTransaction />
  if (page === 'payments')   return <ManagePayments />
  if (page === 'categories') return <ManageCategories />
  if (page === 'payers')     return <ManagePayers />
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
