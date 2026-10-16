import { useState } from 'react'
import { ShieldAlert, ShieldCheck } from 'lucide-react'
import { backupNow, BACKUP_EVERY_DAYS, daysSince, snoozeBackupReminder, useBackupDue, useLastBackup } from '../lib/backup'
import { Button } from './ui'

function useBackupAction() {
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    try {
      await backupNow()
    } finally {
      setBusy(false)
    }
  }
  return [busy, run] as const
}

/** Banner shown at the top of every page when a backup is 7+ days overdue. */
export default function BackupReminder() {
  const due = useBackupDue()
  const last = useLastBackup()
  const [busy, run] = useBackupAction()
  if (!due) return null

  const days = daysSince(last)
  return (
    <div className="no-print mb-5 flex flex-col gap-3 rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center dark:border-amber-800/40">
      <div className="flex flex-1 items-start gap-3">
        <ShieldAlert size={20} className="mt-0.5 shrink-0 text-amber-700" />
        <div className="text-sm">
          <div className="font-semibold text-stone-900">
            {days === null ? "You haven't backed up your data yet" : `Last backup was ${days} days ago`}
          </div>
          <div className="text-stone-600">Save a copy to Google Drive or WhatsApp in case this phone is lost or reset.</div>
        </div>
      </div>
      <div className="flex gap-2 self-end sm:self-auto">
        <Button variant="ghost" size="sm" onClick={snoozeBackupReminder}>
          Later
        </Button>
        <Button variant="primary" size="sm" disabled={busy} onClick={run}>
          Back up now
        </Button>
      </div>
    </div>
  )
}

/** Backup state at the foot of the sidebar, with a one-tap backup. */
export function BackupStatus() {
  const last = useLastBackup()
  const [busy, run] = useBackupAction()
  const days = daysSince(last)
  const due = days === null || days >= BACKUP_EVERY_DAYS
  const when = days === null ? 'Never backed up' : days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`
  const title = due ? 'Backup due' : 'Backed up'
  const Icon = due ? ShieldAlert : ShieldCheck
  const tone = due ? 'text-amber-700' : 'text-[var(--good)]'
  return (
    <>
      <div className="full-only">
        <div className="side-backup">
          <Icon size={18} className={`shrink-0 ${tone}`} />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="text-[13px] font-bold text-stone-900">{title}</div>
            <div className="mt-0.5 truncate text-[11.5px] font-semibold text-stone-500">{when}</div>
          </div>
          <button
            type="button"
            onClick={run}
            disabled={busy}
            className="h-8 shrink-0 rounded-full border border-[var(--btn-line)] bg-[var(--glass)] px-3 text-xs font-bold text-stone-900 hover:border-gold-500 disabled:opacity-50"
          >
            Back up
          </button>
        </div>
      </div>
      <button type="button" onClick={run} disabled={busy} className="side-item rail-only" title={`${title} · ${when}. Tap to back up now.`} aria-label={`${title}, ${when}. Back up now`}>
        <Icon size={18} strokeWidth={1.7} className={tone} />
      </button>
    </>
  )
}
