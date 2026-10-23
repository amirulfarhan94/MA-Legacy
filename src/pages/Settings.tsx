import { useRef, useState, type ReactNode } from 'react'
import { Download, ImagePlus, QrCode, RotateCcw, Upload } from 'lucide-react'
import { backupNow, daysSince, useBackupEveryDays, useLastBackup } from '../lib/backup'
import { useSyncWanted } from '../lib/sync'
import { formatDate, toISODate } from '../lib/calc'
import { shrinkImage } from '../lib/image'
import { importPhotos } from '../lib/photos'
import { useStorageInfo } from '../lib/storage'
import { sampleData } from '../lib/sample'
import { useStore, type BackupData } from '../lib/store'
import { DOC_META, DOC_TYPES, type DocumentStyle, type Settings } from '../lib/types'
import { Button, Card, CardHeader, Field, Input, NumberInput, PageHeader, Textarea } from '../components/ui'
import OnlineAccount from '../components/OnlineAccount'

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

  const onImage = async (key: 'logoDataUrl' | 'paymentQrDataUrl' | 'signatureDataUrl' | 'stampDataUrl', file?: File) => {
    if (!file) return
    try {
      set(key, await shrinkImage(file, 600))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not read that image.')
    }
  }

  const storage = useStorageInfo()
  const lastBackup = useLastBackup()
  const backupEvery = useBackupEveryDays()
  const synced = useSyncWanted()
  const lastDays = daysSince(lastBackup)

  const importBackup = async (file?: File) => {
    if (!file) return
    try {
      const data = JSON.parse(await file.text()) as BackupData
      const also = synced ? ' Sync is on, so your other devices change too.' : ''
      if (!confirm(`Restoring replaces ALL current data with the backup.${also} Continue?`)) return
      store.importData(data)
      await importPhotos(data.photos)
      setForm(useStore.getState().settings)
      alert('Backup restored.')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not read that file.')
    }
  }

  const hasData = store.customers.length + store.documents.length + store.transactions.length > 0

  return (
    <>
      <PageHeader title="Settings" subtitle="These details appear on every document you print." />

      {/* Jump between sections and save from anywhere on this long page. */}
      <div className="glass-strong no-print sticky top-[calc(4.25rem+env(safe-area-inset-top))] z-20 mb-5 flex items-center gap-2 rounded-full p-1.5 sm:top-4">
        <nav aria-label="Settings sections" className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none]">
          {SECTIONS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="h-8 shrink-0 rounded-full px-3 text-xs font-bold text-stone-600 hover:bg-[var(--item-hover)] hover:text-stone-900"
            >
              {label}
            </button>
          ))}
        </nav>
        <Button variant="primary" size="sm" onClick={save} className="shrink-0">
          {saved ? 'Saved ✓' : 'Save'}
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section id="set-company" title="Company">
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
          <Field label="Your name on the dashboard" className="sm:col-span-2" hint="Shown in the greeting, e.g. “Good morning, Bos Farhan”. Leave blank for no name.">
            <Input {...text('greetingName')} placeholder="e.g. Bos Farhan" />
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
          <Card id="set-style" className="scroll-mt-36">
            <CardHeader title="Document style" subtitle="How quotations, invoices, receipts, statements and every other printed document look." />
            <div role="radiogroup" aria-label="Document style" className="grid grid-cols-2 gap-3 p-5">
              {STYLES.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={form.documentStyle === o.value}
                  onClick={() => set('documentStyle', o.value)}
                  className={`grid gap-2.5 rounded-2xl border-2 p-2.5 text-left transition-colors ${
                    form.documentStyle === o.value ? 'border-gold-500' : 'border-[var(--btn-line)] hover:border-stone-300'
                  }`}
                >
                  <StyleThumb style={o.value} />
                  <span>
                    <span className="block text-sm font-bold text-stone-900">{o.label}</span>
                    <span className="mt-0.5 block text-xs text-stone-500">{o.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </Card>
          <Section id="set-payment" title="Payment details" subtitle="Bank details show on quotations, proforma invoices and invoices; the QR code on invoices and proforma invoices.">
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

          <Section id="set-tax" title="Tax & defaults">
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
            <Field label="Max active split payment plans" hint="Split payment (3×): how many plans may run at the same time.">
              <NumberInput value={form.maxActiveSplitPlans} onValueChange={(v) => set('maxActiveSplitPlans', Math.max(0, Math.round(v)))} />
            </Field>
          </Section>

          <Section
            id="set-signing"
            title="Agreement signing"
            subtitle="Filled in for the company on every split payment agreement. Leave blank to sign and stamp by hand. A PNG with a transparent background looks best."
          >
            <Field label="Signed by (name)">
              <Input {...text('signerName')} placeholder="e.g. Amirul Farhan" />
            </Field>
            <Field label="Position">
              <Input {...text('signerPosition')} placeholder="e.g. Owner" />
            </Field>
            <ImagePick label="Signature" value={form.signatureDataUrl} onPick={(f) => onImage('signatureDataUrl', f)} onRemove={() => set('signatureDataUrl', '')} />
            <ImagePick label="Company stamp" value={form.stampDataUrl} onPick={(f) => onImage('stampDataUrl', f)} onRemove={() => set('stampDataUrl', '')} />
          </Section>
        </div>

        <Section id="set-numbering" title="Document numbering" subtitle="Numbers look like PREFIX-YEAR-0001 and restart each year.">
          {DOC_TYPES.map((t) => (
            <Field key={t} label={DOC_META[t].label}>
              <Input
                value={form.prefixes[t]}
                onChange={(e) => set('prefixes', { ...form.prefixes, [t]: e.target.value.toUpperCase().replace(/\s/g, '') })}
              />
            </Field>
          ))}
        </Section>

        <Section id="set-terms" title="Default terms" subtitle="Pre-filled on new documents; you can still edit each one.">
          {DOC_TYPES.map((t) => (
            <Field key={t} label={DOC_META[t].label} className="sm:col-span-2">
              <Textarea value={form.defaultTerms[t]} onChange={(e) => set('defaultTerms', { ...form.defaultTerms, [t]: e.target.value })} />
            </Field>
          ))}
        </Section>

        <div className="lg:col-span-2">
          <OnlineAccount />
        </div>

        <Card id="set-backup" className="scroll-mt-36 lg:col-span-2">
          <CardHeader
            title="Backup & data"
            subtitle={
              synced
                ? `Records and photos sync to the cloud. A backup file every ${backupEvery} days on Google Drive is extra protection, and moves data without sync.`
                : `All data is stored on this device only. Back up at least every ${backupEvery} days to Google Drive or WhatsApp, and use the file to restore or move to another device.`
            }
          />
          <p className="px-5 pt-4 text-sm">
            <span className="text-stone-500">Last backup: </span>
            {lastBackup ? (
              <span className={`font-medium ${lastDays !== null && lastDays >= backupEvery ? 'text-amber-700' : 'text-stone-900'}`}>
                {formatDate(toISODate(new Date(lastBackup)))} ({lastDays === 0 ? 'today' : lastDays === 1 ? 'yesterday' : `${lastDays} days ago`})
              </span>
            ) : (
              <span className="font-medium text-amber-700">Never</span>
            )}
          </p>
          {storage && (
            <p className="px-5 pt-1.5 text-sm">
              <span className="text-stone-500">Storage: </span>
              {storage.usage !== undefined && <span className="font-medium text-stone-900">{formatBytes(storage.usage)} used · </span>}
              {storage.persisted ? (
                <span className="font-medium text-[var(--good)]">protected from automatic clean-up</span>
              ) : (
                <span className="font-medium text-amber-700">
                  not protected — the browser may clear it when space runs low. Install the app to the home screen to protect it.
                </span>
              )}
            </p>
          )}
          <div className="flex flex-wrap gap-2 p-5">
            <Button variant="primary" onClick={() => backupNow()}>
              <Download size={15} /> Back up now
            </Button>
            <Button onClick={() => fileRef.current?.click()}>
              <Upload size={15} /> Restore from backup
            </Button>
            <input ref={fileRef} type="file" accept="application/json,.json,text/plain,.txt" hidden onChange={(e) => { importBackup(e.target.files?.[0]); e.target.value = '' }} />
            {!hasData && !synced && (
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
                const also = synced ? ' Sync is on, so they are deleted on your other devices too (records can be restored from Recently deleted for 30 days).' : ''
                if (confirm(`Delete ALL customers, documents, transactions and settings?${also} Download a backup first!`) && confirm('Are you absolutely sure?')) {
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

const STYLES: { value: DocumentStyle; label: string; hint: string }[] = [
  { value: 'engineering', label: 'Engineering', hint: 'Title block, mono figures, page numbers' },
  { value: 'classic', label: 'Classic', hint: 'The original look' },
]

/** Small drawing of each style, so the choice is visible before printing. */
function StyleThumb({ style }: { style: DocumentStyle }) {
  const bar = (w: string, c = 'bg-stone-300') => <i className={`block h-[3px] rounded-full ${c}`} style={{ width: w }} />
  return (
    <span className="relative block aspect-[210/297] w-full overflow-hidden rounded-md bg-white p-[9%] shadow-[0_4px_14px_rgb(0_0_0/0.12)]">
      {style === 'engineering' ? (
        <>
          <i className="absolute inset-x-0 top-0 h-[5px] bg-[repeating-linear-gradient(to_right,#9aa1ab_0_1px,transparent_1px_6px)]" />
          <span className="flex items-start justify-between">
            <span className="grid gap-1">{bar('34px', 'bg-[#14181f]')}{bar('26px')}</span>
            {bar('30px', 'bg-[#9a6a12]')}
          </span>
          <span className="mt-[10%] grid grid-cols-4 border-y border-[#14181f] py-1">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`grid gap-0.5 px-0.5 ${i ? 'border-l border-[#d7dbe1]' : ''}`}>{bar('70%', 'bg-[#14181f]')}</span>
            ))}
          </span>
          <span className="mt-[8%] flex justify-between">
            <span className="grid gap-1">{bar('30px', 'bg-[#14181f]')}{bar('22px')}</span>
            <span className="block h-4 w-12 border border-[#14181f]" />
          </span>
          <span className="mt-[8%] grid gap-1.5 border-t border-[#14181f] pt-1.5">{[0, 1, 2].map((i) => <span key={i}>{bar('100%', 'bg-[#e8ebef]')}</span>)}</span>
          <span className="mt-[6%] ml-auto block w-1/2 border-t border-[#14181f] pt-1">{bar('100%', 'bg-[#f0e4cc]')}</span>
        </>
      ) : (
        <>
          <span className="flex items-start justify-between border-b border-[#a8741a] pb-1.5">
            <span className="grid gap-1">{bar('34px', 'bg-[#a8741a]')}{bar('26px')}</span>
            {bar('28px', 'bg-[#875b14]')}
          </span>
          <span className="mt-[10%] grid gap-1">{bar('30px', 'bg-[#1c1a16]')}{bar('22px')}</span>
          <span className="mt-[8%] block h-2 bg-[#16140f]" />
          <span className="mt-1.5 grid gap-1.5">{[0, 1, 2].map((i) => <span key={i}>{bar('100%', 'bg-[#ececea]')}</span>)}</span>
          <span className="mt-[6%] ml-auto block w-1/2 border-t-2 border-[#a8741a] pt-1">{bar('100%', 'bg-[#e7e5e0]')}</span>
        </>
      )}
    </span>
  )
}

const SECTIONS: [string, string][] = [
  ['set-company', 'Company'],
  ['set-style', 'Style'],
  ['set-payment', 'Payment'],
  ['set-tax', 'Tax'],
  ['set-signing', 'Signing'],
  ['set-numbering', 'Numbering'],
  ['set-terms', 'Terms'],
  ['set-online', 'Online'],
  ['set-backup', 'Backup'],
]

/** Upload / change / remove one image, with a preview. */
function ImagePick({ label, value, onPick, onRemove }: { label: string; value: string; onPick: (f?: File) => void; onRemove: () => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-stone-600">{label}</div>
      <div className="flex flex-col items-start gap-2">
        <div className="grid h-20 w-32 shrink-0 place-items-center rounded-lg border border-dashed border-stone-300 bg-white p-1">
          {value ? <img src={value} alt={label} className="max-h-[72px] max-w-[120px] object-contain" /> : <ImagePlus size={22} className="text-stone-400" />}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" onClick={() => ref.current?.click()}>
            <ImagePlus size={14} /> {value ? 'Change' : 'Upload'}
          </Button>
          {value && (
            <Button size="sm" variant="ghost" onClick={onRemove}>
              Remove
            </Button>
          )}
        </div>
        <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = '' }} />
      </div>
    </div>
  )
}

function Section({ id, title, subtitle, children }: { id: string; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-36">
      <CardHeader title={title} subtitle={subtitle} />
      <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">{children}</div>
    </Card>
  )
}

const formatBytes = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`)
