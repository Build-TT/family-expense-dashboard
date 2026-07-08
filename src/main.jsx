import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import BottomNav         from './components/BottomNav.jsx'
import './index.css'

const App = lazy(() => import('./App.jsx'))
const AddTransaction = lazy(() => import('./liff/AddTransaction.jsx'))
const ManagePayments = lazy(() => import('./liff/ManagePayments.jsx'))
const ManageCategories = lazy(() => import('./liff/ManageCategories.jsx'))
const ManagePayers = lazy(() => import('./liff/ManagePayers.jsx'))
const RecurringTransactions = lazy(() => import('./liff/RecurringTransactions.jsx'))

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
  if (page === 'recurring')  return <RecurringTransactions />
  return <App />
}

function RouteFallback() {
  return (
    <div style={{ textAlign: 'center', padding: 40, color: '#888', fontFamily: 'system-ui,sans-serif' }}>
      Loading...
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <div style={{ paddingBottom: 60 }}>
      <Suspense fallback={<RouteFallback />}>
        <Router />
      </Suspense>
    </div>
    <BottomNav />
  </React.StrictMode>
)
