import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Customers from './pages/Customers'
import CustomerDetail from './pages/CustomerDetail'
import DocumentList from './pages/DocumentList'
import DocumentEditor from './pages/DocumentEditor'
import DocumentView from './pages/DocumentView'
import Transactions from './pages/Transactions'
import SettingsPage from './pages/Settings'

// HashRouter so the app works from any static host without server rewrites.
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/:id" element={<CustomerDetail />} />
          <Route path="d/:typePath" element={<DocumentList />} />
          <Route path="d/:typePath/new" element={<DocumentEditor />} />
          <Route path="d/:typePath/:id" element={<DocumentView />} />
          <Route path="d/:typePath/:id/edit" element={<DocumentEditor />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
