import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AddExpensePage from './components/AddExpensePage';
import FindUser from './components/FindUser'
import ApprovalsPage from './components/ApprovalsPage'
import TransactionsPage from './components/TransactionsPage'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/add-expense" element={<AddExpensePage />} />
          <Route path="/friends" element={<FindUser />} />
          <Route path="/approvals" element={<ApprovalsPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Registration failure is non-blocking for app usage.
    });
  });
}
