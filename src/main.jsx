import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import AddTransaction    from './liff/AddTransaction.jsx'
import ManagePayments    from './liff/ManagePayments.jsx'
import ManageCategories  from './liff/ManageCategories.jsx'
import ManagePayers      from './liff/ManagePayers.jsx'
import './index.css'

function Router() {
  const path = window.location.pathname
  if (path === '/liff/add')        return <AddTransaction />
  if (path === '/liff/payments')   return <ManagePayments />
  if (path === '/liff/categories') return <ManageCategories />
  if (path === '/liff/payers')     return <ManagePayers />
  return <App />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><Router /></React.StrictMode>
)
