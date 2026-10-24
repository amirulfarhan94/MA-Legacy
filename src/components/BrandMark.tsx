import { BRAND } from '../lib/brand'
import { useStore } from '../lib/store'

/**
 * The small HandalServ logo under the company details on printed documents, with the line
 * "is a brand of <company>" beside it (Settings → Document style).
 */
export default function BrandMark({ className = '' }: { className?: string }) {
  const on = useStore((s) => s.settings.brandOnDocuments)
  const company = useStore((s) => s.settings.companyName)
  if (!on) return null
  return (
    <div className="mt-2 flex items-center gap-2">
      <img src={BRAND.logo} alt={BRAND.name} className={`block w-auto ${className}`} />
      <span className="text-[8.5px] leading-tight text-stone-500">is a brand of {company}</span>
    </div>
  )
}
