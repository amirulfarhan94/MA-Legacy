import { useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { backupNow, daysSince, snoozeBackupReminder, useBackupDue, useLastBackup } from '../lib/backup'
import { Button } from './ui'

/** Banner shown at the top of every page when a backup is 7+ days overdue. */
export default function BackupReminder() {
  const due = useBackupDue()
  const last = useLastBackup()
  const [busy, setBusy] = useState(false)
  if (!due) return null

  const days = daysSince(last)
  return (
    <div className="no-print mb-5 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center dark:border-amber-800/40">
      <div className="flex flex-1 items-start gap-3">
        <ShieldAlert size={20} className="mt-0.5 shrink-0 text-amber-700" />
        <div className="text-sm">
          <div className="font-medium text-stone-900">
            {days === null ? "You haven't backed up your data yet" : `Last backup was ${days} days ago`}
          </div>
          <div className="text-stone-600">Save a copy to Google Drive or WhatsApp in case this phone is lost or reset.</div>
        </div>
      </div>
      <div className="flex gap-2 self-end sm:self-auto">
        <Button variant="ghost" size="sm" onClick={snoozeBackupReminder}>
          Later
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await backupNow()
            } finally {
              setBusy(false)
            }
          }}
        >
          Back up now
        </Button>
      </div>
    </div>
  )
}
