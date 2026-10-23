import { useEffect, useSyncExternalStore } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import ErrorScreen from './components/ErrorScreen'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Customers from './pages/Customers'
import CustomerDetail from './pages/CustomerDetail'
import DocumentList from './pages/DocumentList'
import DocumentEditor from './pages/DocumentEditor'
import DocumentView from './pages/DocumentView'
import Transactions from './pages/Transactions'
import SettingsPage from './pages/Settings'
import Statement from './pages/Statement'
import Reports from './pages/Reports'
import Items from './pages/Items'
import Agreement from './pages/Agreement'
import SplitPlans from './pages/SplitPlans'
import Apply from './pages/Apply'
import { cleanUpPhotos } from './lib/photos'
import { useStore } from './lib/store'
import { requestPersistentStorage } from './lib/storage'

// HashRouter so the app works from any static host without server rewrites.
export default function App() {
  // Data loads from IndexedDB a moment after start; screens wait so they never see it empty.
  const ready = useSyncExternalStore(useStore.persist.onFinishHydration, useStore.persist.hasHydrated)

  useEffect(() => {
    if (!ready) return
    requestPersistentStorage()
    // Free the space of photos removed from documents (or from deleted ones) last time.
    cleanUpPhotos(useStore.getState().documents).catch(() => {})
  }, [ready])

  if (!ready) return null

  return (
    <ErrorScreen>
      <HashRouter>
        <Routes>
          {/* The page customers open from a split payment application link: no app shell. */}
          <Route path="apply/:token" element={<Apply />} />
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="customers" element={<Customers kind="customer" />} />
            <Route path="customers/:id" element={<CustomerDetail />} />
            <Route path="customers/:id/statement" element={<Statement />} />
            <Route path="suppliers" element={<Customers kind="supplier" />} />
            <Route path="suppliers/:id" element={<CustomerDetail />} />
            <Route path="d/:typePath" element={<DocumentList />} />
            <Route path="d/:typePath/new" element={<DocumentEditor />} />
            <Route path="d/:typePath/:id" element={<DocumentView />} />
            <Route path="d/:typePath/:id/edit" element={<DocumentEditor />} />
            <Route path="d/invoices/:id/agreement" element={<Agreement />} />
            <Route path="items" element={<Items />} />
            <Route path="split-plans" element={<SplitPlans />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </ErrorScreen>
  )
}
