import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Inbox } from 'lucide-react'
import { useCloudUser, watchSubmitted, type Application } from '../lib/cloud'
import { DOC_META } from '../lib/types'

/** Tells the owner, on any page, that customers have sent split payment applications to review. */
export default function ApplicationsBanner() {
  const user = useCloudUser()
  const [apps, setApps] = useState<Application[]>([])
  useEffect(() => {
    if (!user) return setApps([])
    return watchSubmitted(user.uid, setApps)
  }, [user])
  if (!apps.length) return null
  return (
    <div className="no-print mb-5 flex flex-col gap-2 rounded-[22px] border border-[var(--btn-line)] bg-[var(--btn)] px-4 py-3 sm:flex-row sm:items-center">
      <Inbox size={20} className="shrink-0 text-gold-700" />
      <div className="min-w-0 flex-1 text-sm">
        <b>
          {apps.length} split payment application{apps.length === 1 ? '' : 's'} to review
        </b>
        <div className="flex flex-wrap gap-x-3 text-stone-600">
          {apps.map((a) => (
            <Link key={a.token} to={`/d/${DOC_META.invoice.path}/${a.invoiceId}`} className="font-semibold text-gold-700 hover:underline">
              {a.invoiceNo} · {a.applicant?.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
