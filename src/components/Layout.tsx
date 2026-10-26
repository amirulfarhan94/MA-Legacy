import { useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigationType } from 'react-router-dom'
import { Menu, PanelLeftClose, PanelLeftOpen, Plus, Search, X } from 'lucide-react'
import { invoiceBalance } from '../lib/calc'
import { daypartOf, useNow } from '../lib/daypart'
import { isOpenInvoice } from '../lib/finance'
import { useStore } from '../lib/store'
import { InstallButton, PwaStatus } from './Pwa'
import ThemeSwitch from './ThemeSwitch'
import BackupReminder, { BackupStatus, SaveErrorBanner, SplitBackupBanner } from './BackupReminder'
import ApplicationsBanner from './ApplicationsBanner'
import DuplicateNumbersBanner from './DuplicateNumbersBanner'
import { SyncBadge } from './SyncPanel'
import { useAutoSync } from '../lib/sync'
import CommandPalette from './CommandPalette'
import CreateSheet from './CreateSheet'
import { NAV, isMac, type NavCount } from './nav'

const COMPACT_KEY = 'ma-legacy-sidebar'

/** Wide screens can shrink the sidebar to icons; the choice is remembered. */
function useCompactSidebar(): [boolean, () => void] {
  const [compact, setCompact] = useState(() => {
    try {
      return localStorage.getItem(COMPACT_KEY) === 'compact'
    } catch {
      return false
    }
  })
  const toggle = () =>
    setCompact((c) => {
      try {
        localStorage.setItem(COMPACT_KEY, c ? 'full' : 'compact')
      } catch {
        /* storage blocked */
      }
      return !c
    })
  return [compact, toggle]
}

function useNavCounts(): Record<NavCount, number> {
  const documents = useStore((s) => s.documents)
  return useMemo(
    () => ({
      quotations: documents.filter((d) => d.type === 'quotation' && (d.status === 'draft' || d.status === 'sent')).length,
      invoices: documents.filter((d) => isOpenInvoice(d) && invoiceBalance(d, documents) > 0.005).length,
    }),
    [documents],
  )
}

/** Brand, navigation and the backup / install / theme controls. Used by the sidebar and the phone menu. */
function SideContent({ onNavigate, compact, onToggleCompact }: { onNavigate?: () => void; compact?: boolean; onToggleCompact?: () => void }) {
  const counts = useNavCounts()
  const navRef = useRef<HTMLElement>(null)

  // Fade the bottom edge of the list while there is more to scroll.
  useEffect(() => {
    const el = navRef.current
    if (!el) return
    const update = () => el.classList.toggle('is-clipped', el.scrollTop + el.clientHeight < el.scrollHeight - 2)
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [])

  return (
    <>
      <div className="side-brand">
        <img src="./logo-mark.png" alt="" />
        <div className="side-label leading-tight">
          <div className="font-display text-[15px] font-medium tracking-[-0.01em] text-stone-900">MA Legacy</div>
          <div className="text-[11px] font-semibold text-stone-500">Solutions</div>
        </div>
      </div>
      <nav ref={navRef} className="side-nav" aria-label="Main">
        {NAV.map((item) =>
          'section' in item ? (
            <div key={item.section} className="side-group">
              {item.section}
            </div>
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              title={item.label}
              className={({ isActive }) => `side-item${isActive ? ' active' : ''}`}
            >
              <item.icon size={18} strokeWidth={1.7} />
              <span className="side-label">{item.label}</span>
              {item.count && counts[item.count] > 0 && <span className="side-count">{counts[item.count]}</span>}
            </NavLink>
          ),
        )}
      </nav>
      <div className="side-foot">
        <BackupStatus />
        <InstallButton />
        <div className="side-tools">
          <ThemeSwitch />
          {onToggleCompact && (
            <button
              type="button"
              onClick={onToggleCompact}
              className="side-item side-collapse hidden text-stone-500 lg:flex"
              title={compact ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-pressed={compact}
            >
              {compact ? <PanelLeftOpen size={18} strokeWidth={1.7} /> : <PanelLeftClose size={18} strokeWidth={1.7} />}
            </button>
          )}
        </div>
      </div>
    </>
  )
}

function IconButton({ label, children, ...props }: { label: string; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      className="grid size-10 shrink-0 place-items-center rounded-[14px] border border-[var(--btn-line)] bg-[var(--btn)] text-stone-900"
      {...props}
    >
      {children}
    </button>
  )
}

/** Phone: menu, brand, search and create, pinned to the top. */
function PhoneBar({ menuOpen, onMenu, onSearch, onCreate }: { menuOpen: boolean; onMenu: () => void; onSearch: () => void; onCreate: () => void }) {
  return (
    <header className="glass-strong no-print sticky top-0 z-30 flex items-center gap-2 rounded-none border-x-0 border-t-0 px-3.5 pb-2.5 pt-[calc(0.625rem+env(safe-area-inset-top))] sm:hidden">
      <IconButton label="Open menu" onClick={onMenu} aria-expanded={menuOpen} aria-controls="app-menu">
        <Menu size={20} />
      </IconButton>
      <Link to="/" className="flex min-w-0 flex-1 items-center gap-2">
        <img src="./logo-mark.png" alt="" className="h-7 w-auto" />
        <span className="truncate font-display text-[14px] font-medium tracking-[-0.01em]">MA Legacy</span>
      </Link>
      <SyncBadge compact />
      <IconButton label="Search" onClick={onSearch}>
        <Search size={19} />
      </IconButton>
      <button type="button" onClick={onCreate} aria-label="Create a document" className="btn-gold grid size-10 shrink-0 place-items-center rounded-full">
        <Plus size={20} strokeWidth={2.2} />
      </button>
    </header>
  )
}

/** Tablet and up: search, create and the owner badge above every page. */
function TopBar({ onSearch, onCreate }: { onSearch: () => void; onCreate: () => void }) {
  const name = useStore((s) => s.settings.greetingName)
  const initial = (name.trim().split(/\s+/).pop() ?? '').charAt(0).toUpperCase() || 'M'
  return (
    <div className="no-print hidden items-center gap-2.5 sm:flex">
      <button
        type="button"
        onClick={onSearch}
        className="glass flex h-12 min-w-0 max-w-[420px] flex-1 items-center gap-2.5 rounded-full px-4 text-left text-sm font-semibold text-stone-500 transition-colors hover:text-stone-800"
      >
        <Search size={18} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate">Search or jump to…</span>
        <kbd className="hidden rounded-lg border border-[var(--btn-line)] px-1.5 py-1 font-sans text-[11px] font-bold text-stone-400 md:block">{isMac() ? '⌘K' : 'Ctrl K'}</kbd>
      </button>
      <div className="ml-auto flex items-center gap-2.5">
        <SyncBadge />
        <button type="button" onClick={onCreate} className="btn-gold inline-flex h-12 items-center gap-2 rounded-full px-5 text-sm font-bold">
          <Plus size={18} strokeWidth={2.2} /> Create
        </button>
        <Link
          to="/settings"
          title="Settings"
          className="grid size-12 place-items-center rounded-full bg-gradient-to-br from-gold-300 to-gold-400 font-display text-base font-medium text-[var(--on-gold)] shadow-[0_6px_18px_rgb(212_161_71/0.35)]"
        >
          {initial}
        </Link>
      </div>
    </div>
  )
}

/** Phone menu: the sidebar sliding in from the left. */
function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current()
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = setTimeout(() => panel.current?.querySelector<HTMLElement>('.side-item.active, .side-item')?.focus(), 60)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      if (panel.current?.contains(document.activeElement)) opener?.focus?.()
    }
  }, [open])

  return (
    <div className="no-print sm:hidden">
      <div className={`scrim${open ? ' is-open' : ''}`} onClick={onClose} aria-hidden="true" />
      <div id="app-menu" ref={panel} role="dialog" aria-modal="true" aria-label="Menu" className={`side drawer glass-strong${open ? ' is-open' : ''}`}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="absolute right-3 top-[calc(0.875rem+env(safe-area-inset-top))] grid size-10 place-items-center rounded-[14px] border border-[var(--btn-line)] bg-[var(--btn)] text-stone-900"
        >
          <X size={18} />
        </button>
        <SideContent onNavigate={onClose} />
      </div>
    </div>
  )
}

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [compact, toggleCompact] = useCompactSidebar()
  useAutoSync()
  const { pathname } = useLocation()
  // A new page opens at the top; Back and Forward leave the browser to restore where you were.
  const navigationType = useNavigationType()
  useEffect(() => {
    if (navigationType !== 'POP') window.scrollTo(0, 0)
  }, [pathname, navigationType])
  // The background light follows the time of day.
  const daypart = daypartOf(useNow(60_000))

  useEffect(() => {
    setMenuOpen(false)
    setSearchOpen(false)
    setCreateOpen(false)
  }, [pathname])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setMenuOpen(false)
        setCreateOpen(false)
        setSearchOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="min-h-screen" data-daypart={daypart}>
      <div className="ambient no-print" aria-hidden="true">
        <i className="a1" />
        <i className="a2" />
        <i className="a3" />
      </div>
      <div className={`shell${compact ? ' is-compact' : ''}`}>
        <aside className="side glass no-print hidden sm:flex" aria-label="Sidebar">
          <SideContent compact={compact} onToggleCompact={toggleCompact} />
        </aside>
        <div className="min-w-0">
          <PhoneBar menuOpen={menuOpen} onMenu={() => setMenuOpen(true)} onSearch={() => setSearchOpen(true)} onCreate={() => setCreateOpen(true)} />
          <div className="mx-auto w-full max-w-7xl">
            <TopBar onSearch={() => setSearchOpen(true)} onCreate={() => setCreateOpen(true)} />
            <main key={pathname} className="print-area px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5 sm:px-0 sm:pt-6">
              <SaveErrorBanner />
              <ApplicationsBanner />
              <DuplicateNumbersBanner />
              <SplitBackupBanner />
              <BackupReminder />
              <Outlet />
            </main>
          </div>
        </div>
      </div>
      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} />
      <CommandPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onMoreDocuments={() => {
          setSearchOpen(false)
          setCreateOpen(true)
        }}
      />
      <CreateSheet open={createOpen} onClose={() => setCreateOpen(false)} />
      <PwaStatus />
    </div>
  )
}
