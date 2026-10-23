import { useMemo } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useStore } from '../lib/store'
import { useSyncWanted } from '../lib/sync'
import { duplicateNumbers } from '../lib/syncMerge'
import { DOC_META } from '../lib/types'

/**
 * While syncing: two devices that were both offline can give new documents the same number.
 * This lists them so the owner can edit one and give it another number.
 */
export default function DuplicateNumbersBanner() {
  const syncing = useSyncWanted()
  const documents = useStore((s) => s.documents)
  const groups = useMemo(() => (syncing ? duplicateNumbers(documents) : []), [syncing, documents])
  if (!groups.length) return null
  return (
    <div role="alert" className="no-print mb-5 flex items-start gap-3 rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800/40">
      <TriangleAlert size={20} className="mt-0.5 shrink-0 text-amber-700" />
      <div>
        <div className="font-semibold text-stone-900">Two documents share a number</div>
        <div className="text-stone-600">Made on two devices while both were offline. Open one and change its number.</div>
        <ul className="mt-1 space-y-0.5">
          {groups.map((g) => (
            <li key={g[0].id}>
              {DOC_META[g[0].type].label} {g[0].number}:{' '}
              {g.map((d, i) => (
                <span key={d.id}>
                  {i > 0 && ', '}
                  <Link to={`/d/${DOC_META[d.type].path}/${d.id}/edit`} className="font-semibold underline underline-offset-2">
                    copy {i + 1}
                  </Link>
                </span>
              ))}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
