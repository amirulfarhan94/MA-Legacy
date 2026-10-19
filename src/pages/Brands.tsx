import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ImagePlus, Plus, Trash2 } from 'lucide-react'
import { BRAND_TYPE_CODES, brandLogo, brandName, defaultBrands } from '../lib/brand'
import { today } from '../lib/calc'
import { shrinkImage } from '../lib/image'
import { uid, useStore } from '../lib/store'
import type { Brand } from '../lib/types'
import { BrandLogo } from '../components/BrandPrint'
import { BrandBadge, Button, Card, CardHeader, Field, Input, PageHeader } from '../components/ui'

const HEX = /^#[0-9a-f]{6}$/i

export default function BrandsPage() {
  const brands = useStore((s) => s.brands)
  const companyName = useStore((s) => s.settings.companyName)
  const [draft, setDraft] = useState<Brand>()

  const addBrand = () =>
    setDraft({
      id: uid(),
      name: '',
      logo: '',
      primaryColor: '#12355B',
      accentColor: '#E8A33D',
      tagline: '',
      docPrefix: '',
      isLegalEntity: false,
      isDefault: false,
    })

  return (
    <>
      <PageHeader
        title="Brands"
        subtitle={`Names you trade under. ${companyName} stays the legal entity on every document: its SSM no., address, bank account and signature.`}
        actions={
          !draft && (
            <Button onClick={addBrand}>
              <Plus size={16} /> Add brand
            </Button>
          )
        }
      />
      <div className="grid gap-5 lg:grid-cols-2">
        {brands.map((b) => (
          // Re-keyed on default so the tick follows when another brand becomes the default.
          <BrandCard key={`${b.id}-${b.isDefault}`} brand={b} />
        ))}
        {draft && <BrandCard key={draft.id} brand={draft} isNew onDone={() => setDraft(undefined)} />}
      </div>
    </>
  )
}

function BrandCard({ brand, isNew, onDone }: { brand: Brand; isNew?: boolean; onDone?: () => void }) {
  const brands = useStore((s) => s.brands)
  const settings = useStore((s) => s.settings)
  const docCount = useStore((s) => s.documents.filter((d) => d.brandId === brand.id).length)
  const saveBrand = useStore((s) => s.saveBrand)
  const deleteBrand = useStore((s) => s.deleteBrand)
  const [form, setForm] = useState<Brand>(brand)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const logoRef = useRef<HTMLInputElement>(null)

  const set = <K extends keyof Brand>(k: K, v: Brand[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    setSaved(false)
    setError('')
  }
  const legal = form.isLegalEntity
  const bundledLogo = defaultBrands.find((d) => d.id === brand.id)?.logo

  const onLogo = async (file?: File) => {
    if (!file) return
    try {
      set('logo', await shrinkImage(file, 800))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not read that image.')
    }
  }

  const save = () => {
    const name = form.name.trim()
    const docPrefix = form.docPrefix.trim().toUpperCase()
    if (!legal && !name) return setError('Enter the brand name.')
    if (!HEX.test(form.primaryColor) || !HEX.test(form.accentColor)) return setError('Colours must be hex codes like #12355B.')
    if (!legal) {
      if (!/^[A-Z0-9]+$/.test(docPrefix)) return setError('The document prefix takes letters and numbers only, e.g. HS.')
      if (brands.some((b) => b.id !== form.id && !b.isLegalEntity && b.docPrefix.toUpperCase() === docPrefix))
        return setError(`Another brand already numbers with ${docPrefix}.`)
    }
    saveBrand({ ...form, name: legal ? form.name : name, docPrefix: legal ? '' : docPrefix })
    setSaved(true)
    onDone?.()
  }

  const remove = () => {
    if (docCount) return alert(`${brand.name} has ${docCount} document(s), so it cannot be deleted.`)
    if (confirm(`Delete the brand ${brand.name}?`)) deleteBrand(brand.id)
  }

  const year = today().slice(0, 4)
  const preview = { ...form, name: legal ? brandName(form, settings) : form.name || 'Brand name', logo: brandLogo(form, settings) }

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {isNew ? 'New brand' : brandName(brand, settings)}
            <span className="rounded-full border border-[var(--btn-line)] bg-[var(--btn)] px-2 py-0.5 text-[11px] font-bold text-stone-600">
              {legal ? 'Legal entity' : `Brand of ${settings.companyName}`}
            </span>
            {brand.isDefault && !isNew && <span className="rounded-full bg-gold-400/15 px-2 py-0.5 text-[11px] font-bold text-gold-700">Default</span>}
          </span>
        }
        subtitle={isNew ? undefined : `${docCount} document${docCount === 1 ? '' : 's'}`}
      />
      <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        {/* What the top of a printed document looks like with these colours. */}
        <div
          className="flex min-h-24 items-center gap-4 rounded-xl border border-stone-200 bg-white p-4 sm:col-span-2"
          style={{ borderTop: `6px solid ${form.primaryColor}`, boxShadow: `inset 0 3px 0 ${form.accentColor}`, ['--b-primary' as string]: form.primaryColor, ['--b-display' as string]: "'Archivo Variable', sans-serif" }}
        >
          <BrandLogo brand={preview} className="h-14 w-auto max-w-[200px] object-contain" />
          <div className="ml-auto text-right">
            <BrandBadge name={preview.name} primary={form.primaryColor} accent={form.accentColor} />
            {form.tagline && <div className="mt-1 text-xs font-semibold" style={{ color: form.primaryColor }}>{form.tagline}</div>}
          </div>
        </div>

        {legal ? (
          <p className="text-sm text-stone-600 sm:col-span-2">
            Name, logo, SSM no., address and bank details come from{' '}
            <Link to="/settings" className="font-semibold text-gold-700 hover:underline">
              Settings → Company
            </Link>
            . Documents of the legal entity print exactly as before, with the numbering in Settings ({settings.prefixes.quotation}-{year}-0001…).
            The colours below only tag its documents in lists.
          </p>
        ) : (
          <>
            <Field label="Brand name" className="sm:col-span-2">
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. HandalServ" />
            </Field>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button size="sm" onClick={() => logoRef.current?.click()}>
                <ImagePlus size={14} /> {form.logo ? 'Change logo' : 'Upload logo'}
              </Button>
              {bundledLogo && form.logo !== bundledLogo && (
                <Button size="sm" variant="ghost" onClick={() => set('logo', bundledLogo)}>
                  Use default logo
                </Button>
              )}
              {form.logo && (
                <Button size="sm" variant="ghost" onClick={() => set('logo', '')}>
                  Remove logo
                </Button>
              )}
              <input ref={logoRef} type="file" accept="image/*" hidden onChange={(e) => { onLogo(e.target.files?.[0]); e.target.value = '' }} />
            </div>
          </>
        )}

        <ColorField label="Primary colour" value={form.primaryColor} onChange={(v) => set('primaryColor', v)} />
        <ColorField label="Accent colour" value={form.accentColor} onChange={(v) => set('accentColor', v)} />

        {!legal && (
          <>
            <Field label="Tagline" className="sm:col-span-2" hint="Printed in the footer.">
              <Input value={form.tagline} onChange={(e) => set('tagline', e.target.value)} />
            </Field>
            <Field
              label="Document prefix"
              hint={`Numbers look like ${form.docPrefix || 'HS'}-${BRAND_TYPE_CODES.invoice}-${year}-001, counted per brand, type and year.`}
            >
              <Input value={form.docPrefix} onChange={(e) => set('docPrefix', e.target.value.toUpperCase().replace(/\s/g, ''))} placeholder="HS" />
            </Field>
          </>
        )}

        <label className="flex cursor-pointer items-center gap-2 self-end pb-2 text-sm text-stone-700">
          <input
            type="checkbox"
            className="h-4 w-4 accent-gold-600"
            checked={form.isDefault}
            disabled={brand.isDefault && !isNew}
            onChange={(e) => set('isDefault', e.target.checked)}
          />
          Default for new documents
        </label>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{error}</div>}
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button variant="primary" onClick={save}>
            {saved ? 'Saved ✓' : isNew ? 'Add brand' : 'Save'}
          </Button>
          {isNew && <Button onClick={onDone}>Cancel</Button>}
          {!isNew && !legal && (
            <Button variant="ghost" className="ml-auto" onClick={remove}>
              <Trash2 size={15} /> Delete
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <input
          type="color"
          aria-label={label}
          value={HEX.test(value) ? value : '#000000'}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-[var(--btn-line)] bg-transparent p-1"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value.trim())} maxLength={7} className="font-mono" />
      </div>
    </Field>
  )
}
