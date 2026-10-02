import { useRef, useState, type ReactNode } from 'react'
import { Download, ImagePlus, QrCode, RotateCcw, Upload } from 'lucide-react'
import { backupNow, BACKUP_EVERY_DAYS, daysSince, useLastBackup } from '../lib/backup'
import { formatDate, toISODate } from '../lib/calc'
import { shrinkImage } from '../lib/image'
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
  const qrRef = useRef<HTMLInputElement>(null)

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

  const onImage = async (key: 'logoDataUrl' | 'paymentQrDataUrl', file?: File) => {
    if (!file) return
    try {
      set(key, await shrinkImage(file, 600))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not read that image.')
    }
  }

  const lastBackup = useLastBackup()
  const lastDays = daysSince(lastBackup)

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
              <input ref={logoRef} type="file" accept="image/*" hidden onChange={(e) => { onImage('logoDataUrl', e.target.files?.[0]); e.target.value = '' }} />
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
          <Section title="Payment details" subtitle="Bank details show on quotations, proforma invoices and invoices; the QR code on invoices and proforma invoices.">
            <Field label="Bank">
              <Input {...text('bankName')} placeholder="e.g. Maybank" />
            </Field>
            <Field label="Account no.">
              <Input {...text('bankAccountNo')} />
            </Field>
            <Field label="Account name" className="sm:col-span-2">
              <Input {...text('bankAccountName')} />
            </Field>
            <div className="flex items-start gap-4 sm:col-span-2">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-dashed border-stone-300 bg-white p-1">
                {form.paymentQrDataUrl ? (
                  <img src={form.paymentQrDataUrl} alt="Payment QR" className="h-full w-full object-contain" />
                ) : (
                  <QrCode size={32} className="text-stone-400" />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="text-xs font-medium text-stone-600">DuitNow / bank QR</div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => qrRef.current?.click()}>
                    <ImagePlus size={14} /> {form.paymentQrDataUrl ? 'Change QR' : 'Upload QR'}
                  </Button>
                  {form.paymentQrDataUrl && (
                    <Button size="sm" variant="ghost" onClick={() => set('paymentQrDataUrl', '')}>
                      Remove
                    </Button>
                  )}
                </div>
                <Input {...text('paymentQrLabel')} placeholder="Caption under the QR" />
                <input ref={qrRef} type="file" accept="image/*" hidden onChange={(e) => { onImage('paymentQrDataUrl', e.target.files?.[0]); e.target.value = '' }} />
              </div>
            </div>
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
            subtitle={`All data is stored on this device only. Back up at least every ${BACKUP_EVERY_DAYS} days to Google Drive or WhatsApp, and use the file to restore or move to another device.`}
          />
          <p className="px-5 pt-4 text-sm">
            <span className="text-stone-500">Last backup: </span>
            {lastBackup ? (
              <span className={`font-medium ${lastDays !== null && lastDays >= BACKUP_EVERY_DAYS ? 'text-amber-700' : 'text-stone-900'}`}>
                {formatDate(toISODate(new Date(lastBackup)))} ({lastDays === 0 ? 'today' : lastDays === 1 ? 'yesterday' : `${lastDays} days ago`})
              </span>
            ) : (
              <span className="font-medium text-amber-700">Never</span>
            )}
          </p>
          <div className="flex flex-wrap gap-2 p-5">
            <Button variant="primary" onClick={() => backupNow()}>
              <Download size={15} /> Back up now
            </Button>
            <Button onClick={() => fileRef.current?.click()}>
              <Upload size={15} /> Restore from backup
            </Button>
            <input ref={fileRef} type="file" accept="application/json,.json,text/plain,.txt" hidden onChange={(e) => { importBackup(e.target.files?.[0]); e.target.value = '' }} />
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
