import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  ArrowLeftRight,
  ClipboardCheck,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  Menu,
  ReceiptText,
  Settings,
  Users,
  X,
} from 'lucide-react'
import { DOC_META } from '../lib/types'
import { InstallButton, PwaStatus } from './Pwa'
import ThemeSwitch from './ThemeSwitch'
import BackupReminder from './BackupReminder'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/customers', label: 'Customers', icon: Users },
  { section: 'Documents' },
  { to: `/d/${DOC_META.quotation.path}`, label: 'Quotations', icon: FileText },
  { to: `/d/${DOC_META.proforma.path}`, label: 'Proforma Invoices', icon: FileSpreadsheet },
  { to: `/d/${DOC_META.invoice.path}`, label: 'Invoices', icon: FileCheck2 },
  { to: `/d/${DOC_META.receipt.path}`, label: 'Receipts', icon: ReceiptText },
  { to: `/d/${DOC_META.service_report.path}`, label: 'Service Reports', icon: ClipboardCheck },
  { section: 'Finance' },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="theme-light flex h-full flex-col border-r border-white/5 bg-ink-900 pt-[env(safe-area-inset-top)] text-stone-300">
      <div className="flex items-center gap-3 px-5 py-5">
        <img src="./logo-mark.png" alt="" className="h-10 w-auto" />
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-wide text-gold-300">MA LEGACY</div>
          <div className="text-[11px] tracking-[0.2em] text-stone-400">SOLUTIONS</div>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-6">
        {NAV.map((item, i) =>
          'section' in item ? (
            <div key={i} className="px-3 pb-1 pt-5 text-[11px] font-medium uppercase tracking-wider text-stone-500">
              {item.section}
            </div>
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item ? item.end : false}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive ? 'bg-gold-600/15 font-medium text-gold-300' : 'hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <item.icon size={17} strokeWidth={1.8} />
              {item.label}
            </NavLink>
          ),
        )}
      </nav>
      <InstallButton />
      <ThemeSwitch />
      <div className="border-t border-white/5 px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 text-[11px] text-stone-500">
        Data saved in this browser
      </div>
    </div>
  )
}

export default function Layout() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  // Printable document pages render full-bleed; the sidebar is hidden when printing anyway.
  return (
    <div className="min-h-screen lg:pl-64 print:pl-0">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <Sidebar />
      </aside>

      <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b border-stone-200 bg-surface/90 px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur lg:hidden">
        <button onClick={() => setOpen(true)} className="rounded p-1.5 hover:bg-stone-100" aria-label="Open menu">
          <Menu size={20} />
        </button>
        <img src="./logo-mark.png" alt="" className="h-7" />
        <span className="text-sm font-semibold">MA Legacy Solutions</span>
      </header>

      {open && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64">
            <Sidebar onNavigate={() => setOpen(false)} />
            <button
              onClick={() => setOpen(false)}
              className="absolute right-2 top-[calc(1rem+env(safe-area-inset-top))] rounded p-1 text-stone-400 hover:text-white"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      <main key={pathname} className="print-area mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <BackupReminder />
        <Outlet />
      </main>
      <PwaStatus />
    </div>
  )
}
