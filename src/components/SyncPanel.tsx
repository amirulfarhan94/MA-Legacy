import { useEffect, useState } from 'react'
import { CloudCheck, CloudOff, LoaderCircle, RefreshCw, RotateCcw, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { backupNow } from '../lib/backup'
import type { CloudUser } from '../lib/cloud'
import { cloudPhotoUsage, usePhotosToUpload } from '../lib/photoSync'
import { useStore } from '../lib/store'
import {
  cloudHasData,
  disableSync,
  enableSync,
  KEEP_DELETED_DAYS,
  restoreDeleted,
  useRecentlyDeleted,
  useSyncStatus,
  useSyncWanted,
  type DeletedRecord,
  type SyncStatus,
} from '../lib/sync'
import { DOC_META, type CatalogItem, type Customer, type Document, type Transaction } from '../lib/types'
import { Button } from './ui'

export function syncLabel(s: SyncStatus): string {
  switch (s.phase) {
    case 'synced':
      return 'Synced'
    case 'syncing':
      return s.pending ? `Syncing ${s.pending} change${s.pending === 1 ? '' : 's'}…` : 'Syncing…'
    case 'offline':
      return s.pending ? `Offline · ${s.pending} change${s.pending === 1 ? '' : 's'} waiting` : 'Offline · will sync later'
    case 'error':
      return s.error ?? 'Sync stopped'
    default:
      return 'Sync off'
  }
}

export function SyncIcon({ status, size = 16 }: { status: SyncStatus; size?: number }) {
  if (status.phase === 'synced') return <CloudCheck size={size} className="text-[var(--good)]" />
  if (status.phase === 'syncing') return <RefreshCw size={size} className="animate-spin text-stone-500" />
  if (status.phase === 'error') return <TriangleAlert size={size} className="text-red-700" />
  return <CloudOff size={size} className="text-amber-700" />
}

/** Small sync state in the top bars, linking to the Online account card. Hidden while sync is off. */
export function SyncBadge({ compact = false }: { compact?: boolean }) {
  const status = useSyncStatus()
  if (status.phase === 'off') return null
  const label = syncLabel(status)
  return (
    <Link
      to="/settings#set-online"
      title={label}
      aria-label={`Sync: ${label}`}
      className={
        compact
          ? 'grid size-10 shrink-0 place-items-center rounded-[14px] border border-[var(--btn-line)] bg-[var(--btn)]'
          : 'glass inline-flex h-12 max-w-[260px] items-center gap-2 rounded-full px-4 text-sm font-semibold text-stone-600'
      }
    >
      <SyncIcon status={status} size={compact ? 18 : 16} />
      {!compact && <span className="truncate">{label}</span>}
    </Link>
  )
}

function deletedLabel(d: DeletedRecord): string {
  switch (d.list) {
    case 'customers': {
      const c = d.record as Customer
      return `${c.kind === 'supplier' ? 'Supplier' : 'Customer'} · ${c.company || c.name}`
    }
    case 'documents': {
      const doc = d.record as Document
      return `${DOC_META[doc.type]?.label ?? 'Document'} · ${doc.number}`
    }
    case 'catalog':
      return `Item · ${(d.record as CatalogItem).description}`
    case 'transactions': {
      const t = d.record as Transaction
      return `Transaction · ${t.description || t.category} (${t.amount.toFixed(2)})`
    }
  }
}

const FREE_BYTES = 1024 ** 3

/** Photos waiting to go up, and the cloud space photos use (the free plan holds 1 GB). */
function PhotoUsage({ uid }: { uid: string }) {
  const toUpload = usePhotosToUpload()
  const [usage, setUsage] = useState<{ count: number; bytes: number } | null>(null)
  useEffect(() => {
    if (toUpload) return
    let live = true
    cloudPhotoUsage(uid)
      .then((u) => live && setUsage(u))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [uid, toUpload])
  const mb = (b: number) => (b < 10 * 1024 ** 2 ? (b / 1024 ** 2).toFixed(1) : Math.round(b / 1024 ** 2).toString())
  return (
    <p className="mt-2 text-xs text-stone-500">
      {toUpload > 0 ? (
        <>Uploading photos · {toUpload} left. Keep the app open. </>
      ) : usage ? (
        <>
          Photos in the cloud: {usage.count} · {mb(usage.bytes)} MB of {FREE_BYTES / 1024 ** 3} GB free.{' '}
        </>
      ) : null}
      Photos taken on another device load when you open the document.
    </p>
  )
}

const when = (ms: number) => new Date(ms).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })

/** Inside the Online account card: turn sync on or off, see its state, and put back deleted records. */
export default function SyncPanel({ user }: { user: CloudUser }) {
  const wanted = useSyncWanted()
  const status = useSyncStatus()
  const deleted = useRecentlyDeleted()
  const hasData = useStore((s) => s.customers.length + s.documents.length + s.transactions.length + s.catalog.length > 0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [choose, setChoose] = useState(false)
  const [showDeleted, setShowDeleted] = useState(false)

  const turnOn = async () => {
    setBusy(true)
    setError('')
    try {
      // A copy of this device's data first, in case anything goes wrong.
      if (hasData && (await backupNow()) === 'cancelled') return
      if (hasData && (await cloudHasData(user.uid))) {
        setChoose(true)
        return
      }
      await enableSync(user.uid, 'merge')
    } catch (e) {
      const code = (e as { code?: string }).code
      setError(code === 'unavailable' ? 'No internet connection. Turning on sync needs the internet once.' : e instanceof Error ? e.message : 'Could not turn on sync.')
    } finally {
      setBusy(false)
    }
  }

  const pick = async (mode: 'merge' | 'replace') => {
    if (mode === 'replace' && !confirm("Replace this device's records with the ones in the cloud? (A backup was just made.)")) return
    setChoose(false)
    await enableSync(user.uid, mode)
  }

  if (!wanted) {
    return (
      <div className="border-t border-stone-200 p-5">
        <div className="text-sm font-semibold text-stone-900">Sync this device</div>
        <p className="mt-1 text-sm text-stone-600">
          Keeps customers, documents, transactions, items and settings the same on your phone, tablet and computer, and keeps a copy in the cloud.
          Work photos and IC photos sync too. The app still works offline and syncs when the internet is back.
        </p>
        {choose ? (
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm">
            <p className="font-semibold text-stone-900">The cloud already has records from another device.</p>
            <p className="mt-1 text-stone-600">
              <b>Combine</b> keeps this device&apos;s records and adds the cloud&apos;s (where both have the same record, the cloud&apos;s copy is used).{' '}
              <b>Use the cloud&apos;s</b> replaces this device&apos;s records — pick this on a new device or one with sample data.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="primary" size="sm" onClick={() => pick('merge')}>
                Combine
              </Button>
              <Button size="sm" onClick={() => pick('replace')}>
                Use the cloud&apos;s
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setChoose(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button variant="primary" size="sm" onClick={turnOn} disabled={busy}>
              {busy ? <LoaderCircle size={14} className="animate-spin" /> : <RefreshCw size={14} />} Turn on sync
            </Button>
            {hasData && <span className="text-xs text-stone-500">A backup file is made first.</span>}
          </div>
        )}
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      </div>
    )
  }

  return (
    <div className="border-t border-stone-200 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <SyncIcon status={status} size={18} />
        <span className="min-w-0 flex-1 text-sm">
          <b>Sync is on.</b> {syncLabel(status)}
        </span>
        <Button size="sm" onClick={() => confirm('Stop syncing this device? Its records stay here, and the cloud keeps its copy.') && disableSync()}>
          Turn off
        </Button>
      </div>
      <PhotoUsage uid={user.uid} />

      <button type="button" className="mt-4 text-sm font-semibold text-stone-700 underline-offset-2 hover:underline" onClick={() => setShowDeleted((v) => !v)}>
        Recently deleted ({deleted.length}) {showDeleted ? '▴' : '▾'}
      </button>
      {showDeleted && (
        <div className="mt-2">
          <p className="text-xs text-stone-500">Records deleted on any device are kept for {KEEP_DELETED_DAYS} days.</p>
          {deleted.length === 0 ? (
            <p className="mt-2 text-sm text-stone-500">Nothing deleted.</p>
          ) : (
            <ul className="mt-2 divide-y divide-stone-200 rounded-2xl border border-stone-200">
              {deleted.map((d) => (
                <li key={`${d.list}/${d.id}`} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{deletedLabel(d)}</span>
                    <span className="text-xs text-stone-500">Deleted {when(d.deletedAt)}</span>
                  </span>
                  <Button size="sm" onClick={() => restoreDeleted(d)}>
                    <RotateCcw size={13} /> Restore
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
