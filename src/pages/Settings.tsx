import { useRef, useState, type ReactNode } from 'react'
import { Download, ImagePlus, RotateCcw, Upload } from 'lucide-react'
import { today } from '../lib/calc'
import { sampleData } from '../lib/sample'
import { useStore, type BackupData } from '../lib/store'
import { DOC_META, DOC_TYPES, type Settings } from '../lib/types'
import { Button, Card, CardHeader, Field, Input, NumberInput, PageHeader, Textarea } from '../components/ui'

export default function SettingsPage() {
  const store = useStore()
  const [form, setForm] = useState<Settings>(store.settings)
  const [saved, setSaved] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const logoRef = useRef<HTMLInputElement>(null)

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    setSaved(false)
  }
  const text = (k: keyof Settings) => ({
    value: form[k] as string,
    onChange: (e: { target: { value: string } }) => set(k, e.target.value as never),
  })

  const save = () => {
    store.updateSettings(form)
    setSaved(true)
  }

  const onLogo = (file?: File) => {
    if (!file) return
    if (file.size > 800_000) return alert('Please use an image under 800 KB so it fits in browser storage.')
    const reader = new FileReader()
    reader.onload = () => set('logoDataUrl', String(reader.result))
    reader.readAsDataURL(file)
  }

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(store.exportData(), null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `ma-legacy-backup-${today()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importBackup = async (file?: File) => {
    if (!file) return
    try {
      const data = JSON.parse(await file.text()) as BackupData
      if (!confirm('Restoring replaces ALL current data with the backup. Continue?')) return
      store.importData(data)
      setForm(useStore.getState().settings)
      alert('Backup restored.')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not read that file.')
    }
  }

  const hasData = store.customers.length + store.documents.length + store.transactions.length > 0

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="These details appear on every document you print."
        actions={
          <Button variant="primary" onClick={save}>
            {saved ? 'Saved ✓' : 'Save settings'}
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Company">
          <div className="flex items-center gap-4 sm:col-span-2">
            <img src={form.logoDataUrl || './logo.png'} alt="Logo" className="h-16 w-28 rounded border border-stone-200 object-contain p-1" />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => logoRef.current?.click()}>
                <ImagePlus size={15} /> Change logo
              </Button>
              {form.logoDataUrl && (
                <Button variant="ghost" onClick={() => set('logoDataUrl', '')}>
                  Use default logo
                </Button>
              )}
              <input ref={logoRef} type="file" accept="image/*" hidden onChange={(e) => onLogo(e.target.files?.[0])} />
            </div>
          </div>
          <Field label="Company name" className="sm:col-span-2">
            <Input {...text('companyName')} />
          </Field>
          <Field label="SSM registration no.">
            <Input {...text('regNo')} placeholder="e.g. 202601012345 (1234567-X)" />
          </Field>
          <Field label="SST registration no.">
            <Input {...text('sstNo')} placeholder="Leave blank if not registered" />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <Textarea {...text('address')} />
          </Field>
          <Field label="Phone">
            <Input {...text('phone')} />
          </Field>
          <Field label="Email">
            <Input {...text('email')} />
          </Field>
          <Field label="Website" className="sm:col-span-2">
            <Input {...text('website')} />
          </Field>
        </Section>

        <div className="space-y-5">
          <Section title="Bank details" subtitle="Shown on quotations, proforma invoices and invoices.">
            <Field label="Bank">
              <Input {...text('bankName')} placeholder="e.g. Maybank" />
            </Field>
            <Field label="Account no.">
              <Input {...text('bankAccountNo')} />
            </Field>
            <Field label="Account name" className="sm:col-span-2">
              <Input {...text('bankAccountName')} />
            </Field>
          </Section>

          <Section title="Tax & defaults">
            <Field label="Currency symbol">
              <Input {...text('currency')} />
            </Field>
            <Field label="Tax label">
              <Input {...text('taxLabel')} />
            </Field>
            <Field label="Default tax rate (%)" hint="Set 8 for SST service tax, 0 if not registered.">
              <NumberInput value={form.defaultTaxRate} onValueChange={(v) => set('defaultTaxRate', v)} />
            </Field>
            <Field label="Invoice due (days)">
              <NumberInput value={form.defaultDueDays} onValueChange={(v) => set('defaultDueDays', v)} />
            </Field>
            <Field label="Quotation valid (days)">
              <NumberInput value={form.quotationValidDays} onValueChange={(v) => set('quotationValidDays', v)} />
            </Field>
          </Section>
        </div>

        <Section title="Document numbering" subtitle="Numbers look like PREFIX-YEAR-0001 and restart each year.">
          {DOC_TYPES.map((t) => (
            <Field key={t} label={DOC_META[t].label}>
              <Input
                value={form.prefixes[t]}
                onChange={(e) => set('prefixes', { ...form.prefixes, [t]: e.target.value.toUpperCase().replace(/\s/g, '') })}
              />
            </Field>
          ))}
        </Section>

        <Section title="Default terms" subtitle="Pre-filled on new documents; you can still edit each one.">
          {DOC_TYPES.map((t) => (
            <Field key={t} label={DOC_META[t].label} className="sm:col-span-2">
              <Textarea value={form.defaultTerms[t]} onChange={(e) => set('defaultTerms', { ...form.defaultTerms, [t]: e.target.value })} />
            </Field>
          ))}
        </Section>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Backup & data"
            subtitle="All data is stored in this browser only. Download a backup regularly, and use it to move to another computer."
          />
          <div className="flex flex-wrap gap-2 p-5">
            <Button onClick={exportBackup}>
              <Download size={15} /> Download backup
            </Button>
            <Button onClick={() => fileRef.current?.click()}>
              <Upload size={15} /> Restore from backup
            </Button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { importBackup(e.target.files?.[0]); e.target.value = '' }} />
            {!hasData && (
              <Button
                onClick={() => {
                  store.importData({ ...sampleData(), settings: store.settings })
                  alert('Sample data loaded. Visit the dashboard to explore.')
                }}
              >
                Load sample data
              </Button>
            )}
            <Button
              variant="danger"
              className="ml-auto"
              onClick={() => {
                if (confirm('Delete ALL customers, documents, transactions and settings? Download a backup first!') && confirm('Are you absolutely sure?')) {
                  store.resetAll()
                  setForm(useStore.getState().settings)
                }
              }}
            >
              <RotateCcw size={15} /> Reset everything
            </Button>
          </div>
        </Card>
      </div>
    </>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">{children}</div>
    </Card>
  )
}
