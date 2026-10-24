import { BRAND } from '../lib/brand'
import { useStore } from '../lib/store'

/** The small HandalServ logo under the company details on printed documents (Settings → Document style). */
export default function BrandMark({ className = '' }: { className?: string }) {
  const on = useStore((s) => s.settings.brandOnDocuments)
  if (!on) return null
  return <img src={BRAND.logo} alt={BRAND.name} className={`block w-auto ${className}`} />
}
