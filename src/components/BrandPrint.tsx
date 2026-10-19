import { useState, type CSSProperties } from 'react'
import { brandOf, isTradingBrand } from '../lib/brand'
import { useStore } from '../lib/store'
import type { Brand, Document } from '../lib/types'

/** The trading brand a document prints under, or undefined for the legal entity (which prints as it always has). */
export function usePrintBrand(doc: Pick<Document, 'brandId'>): Brand | undefined {
  const brand = useStore((s) => brandOf(doc, s.brands))
  return isTradingBrand(brand) ? brand : undefined
}

/** Brand colours for the .brand sheet rules in index.css. */
export const brandVars = (b: Brand) => ({ '--b-primary': b.primaryColor, '--b-accent': b.accentColor }) as CSSProperties

/** The brand's logo, or its name set in the heading font when there is no logo (or the file is missing). */
export function BrandLogo({ brand, className }: { brand: Brand; className?: string }) {
  const [broken, setBroken] = useState<string>()
  if (brand.logo && broken !== brand.logo) {
    return <img src={brand.logo} alt={brand.name} className={className} onError={() => setBroken(brand.logo)} />
  }
  return <span className="brand-wordmark">{brand.name}</span>
}

/** "for MA Legacy Solutions (HandalServ)" over a line to sign on. */
export function BrandSignature({ brand }: { brand: Brand }) {
  const company = useStore((s) => s.settings.companyName)
  return (
    <div className="brand-sign">
      <div />
      <span>
        for {company} ({brand.name})
      </span>
    </div>
  )
}

/** "HandalServ is a brand of MA Legacy Solutions (202601012345)" and the tagline. */
export function BrandFooter({ brand, docNo }: { brand: Brand; docNo?: string }) {
  const { companyName, regNo } = useStore((s) => s.settings)
  return (
    <div className="brand-foot">
      <span>
        {brand.name} is a brand of {companyName}
        {regNo ? ` (${regNo})` : ''}
        {brand.tagline && <em> · {brand.tagline}</em>}
      </span>
      {docNo && <b>{docNo}</b>}
    </div>
  )
}
