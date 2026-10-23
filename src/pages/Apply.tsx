import { useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { Camera, CheckCircle2, LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react'
import { formatMoney } from '../lib/calc'
import { applicantProblems, formatIcNo, type ApplicantDraft } from '../lib/applicant'
import { openApplication, submitApplication, type Application } from '../lib/cloud'
import { photoDataUrl } from '../lib/image'
import { dmy } from '../lib/split'
import { SPLIT_TERMS } from '../lib/splitTerms'
import SignaturePad from '../components/SignaturePad'
import { Button, Field, Input, Textarea } from '../components/ui'

type Stage = 'loading' | 'gone' | 'form' | 'sending' | 'done' | 'error'

/**
 * The page a customer opens from a split payment application link: the job, the schedule and
 * the terms, then their details, IC photos and signature. Nothing here touches the owner's
 * data on this device; the answers go to the owner through Firebase.
 */
export default function Apply() {
  const { token = '' } = useParams()
  const [app, setApp] = useState<Application | null>(null)
  const [stage, setStage] = useState<Stage>('loading')
  // After the first try, what is still missing updates as the customer fills it in.
  const [tried, setTried] = useState(false)
  const [sendError, setSendError] = useState('')
  const [form, setForm] = useState<ApplicantDraft>({
    name: '',
    icNo: '',
    phone: '',
    email: '',
    address: '',
    icFront: '',
    icBack: '',
    signature: '',
    agree: false,
    consent: false,
  })
  const set = <K extends keyof ApplicantDraft>(k: K, v: ApplicantDraft[K]) => setForm((f) => ({ ...f, [k]: v }))

  useEffect(() => {
    const prev = document.title
    document.title = 'Split Payment Application · MA Legacy Solutions'
    openApplication(token)
      .then((a) => {
        if (!a || new Date(a.expiresAt).getTime() < Date.now()) return setStage('gone')
        setApp(a)
        setForm((f) => ({ ...f, name: a.prefill.name, phone: a.prefill.phone, email: a.prefill.email, address: a.premisesAddress }))
        setStage('form')
      })
      .catch(() => setStage('error'))
    return () => {
      document.title = prev
    }
  }, [token])

  const problems = tried ? applicantProblems(form) : []

  const submit = async () => {
    setTried(true)
    setSendError('')
    if (applicantProblems(form).length) return
    setStage('sending')
    try {
      const { agree: _agree, consent: _consent, ...answers } = form
      await submitApplication(token, {
        ...answers,
        name: answers.name.trim(),
        email: answers.email.trim(),
        address: answers.address.trim(),
        consentAt: new Date().toISOString(),
      })
      setStage('done')
      window.scrollTo(0, 0)
    } catch {
      setStage('form')
      setSendError('Tidak dapat dihantar. Semak sambungan internet dan cuba lagi. · Could not send. Check the internet connection and try again.')
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-xl px-4 pb-16 pt-6 text-stone-900">
      <header className="mb-5 flex items-center gap-3">
        <img src="./logo-mark.png" alt="" className="h-11 w-11 object-contain" />
        <div>
          <div className="font-display text-[17px] leading-tight">{app?.company.name || 'MA Legacy Solutions'}</div>
          <div className="text-xs text-stone-500">Permohonan Bayaran Ansuran 3× · Split Payment Application</div>
        </div>
      </header>

      {stage === 'loading' && (
        <Panel>
          <p className="flex items-center gap-2 text-sm text-stone-600">
            <LoaderCircle size={16} className="animate-spin" /> Memuatkan… · Loading…
          </p>
        </Panel>
      )}
      {stage === 'gone' && (
        <Panel>
          <h1 className="font-display text-xl">Pautan ini tidak aktif</h1>
          <p className="mt-2 text-sm text-stone-600">
            Pautan ini telah digunakan, dibatalkan atau tamat tempoh. Sila hubungi MA Legacy Solutions untuk pautan baharu.
          </p>
          <p className="mt-2 text-sm text-stone-500">This link has been used, cancelled or has expired. Please contact MA Legacy Solutions for a new one.</p>
        </Panel>
      )}
      {stage === 'error' && (
        <Panel>
          <h1 className="font-display text-xl">Tidak dapat dibuka</h1>
          <p className="mt-2 text-sm text-stone-600">Semak sambungan internet dan muat semula halaman ini. · Check the internet connection and reload this page.</p>
        </Panel>
      )}
      {stage === 'done' && (
        <Panel>
          <CheckCircle2 size={36} className="text-[var(--good)]" />
          <h1 className="mt-2 font-display text-xl">Terima kasih! Permohonan dihantar.</h1>
          <p className="mt-2 text-sm text-stone-600">
            {app?.company.name} akan menyemak permohonan anda dan menghubungi anda. Bayaran 1 (deposit) dibuat sebelum kerja bermula.
          </p>
          <p className="mt-2 text-sm text-stone-500">Thank you! Your application has been sent. We will review it and contact you. Payment 1 (deposit) is made before work starts.</p>
        </Panel>
      )}

      {app && (stage === 'form' || stage === 'sending') && (
        <div className="space-y-4">
          <Panel>
            <h1 className="font-display text-xl">Ringkasan · Summary</h1>
            <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
              <Term k="Invois · Invoice" v={app.invoiceNo} />
              <Term k="Perjanjian · Agreement" v={app.agreementNo} />
              {app.quotationNo && <Term k="Sebut harga · Quotation" v={app.quotationNo} />}
              <Term k="Kerja · Work" v={app.workDescription || '—'} />
              {app.plannedWorkDate && <Term k="Tarikh kerja · Work date" v={dmy(app.plannedWorkDate)} />}
              <Term k="Jumlah · Total" v={formatMoney(app.total, app.currency)} strong />
            </dl>
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-[11px] uppercase tracking-wider text-stone-500">
                  <th className="py-1.5 font-semibold">Bayaran · Payment</th>
                  <th className="py-1.5 text-right font-semibold">Amaun</th>
                  <th className="py-1.5 pl-3 font-semibold">Tarikh · Due</th>
                </tr>
              </thead>
              <tbody>
                {app.payments.map((p, i) => (
                  <tr key={p.seq} className="border-b border-stone-100">
                    <td className="py-2">
                      {p.seq} · {p.pct}%{i === 0 ? ' (deposit)' : ''}
                    </td>
                    <td className="tabular whitespace-nowrap py-2 text-right font-semibold">{formatMoney(p.amount, app.currency)}</td>
                    <td className="py-2 pl-3">
                      {dmy(p.dueDate)}
                      {i === 0 && <span className="block text-xs text-stone-500">sebelum kerja · before work</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-stone-600">0% faedah · tiada caj tambahan. 0% interest · no extra charges.</p>
            <details className="mt-3 rounded-xl bg-stone-100 px-3 py-2 text-sm">
              <summary className="cursor-pointer font-semibold">Terma dan syarat · Terms and conditions</summary>
              <ol className="mt-2 space-y-1.5 text-[13px] text-stone-700">
                {SPLIT_TERMS.map(([t, text], i) => (
                  <li key={t}>
                    <b>
                      {i + 1}. {t}.
                    </b>{' '}
                    {text}
                  </li>
                ))}
              </ol>
            </details>
          </Panel>

          <Panel>
            <h2 className="font-display text-lg">Maklumat anda · Your details</h2>
            <div className="mt-3 grid gap-3">
              <Field label="Nama penuh (seperti dalam IC) · Full name as per IC">
                <Input value={form.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" />
              </Field>
              <Field label="No. IC · IC no.">
                <Input value={form.icNo} onChange={(e) => set('icNo', formatIcNo(e.target.value))} inputMode="numeric" placeholder="900101-10-1234" />
              </Field>
              <Field label="No. telefon · Phone no.">
                <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} inputMode="tel" autoComplete="tel" />
              </Field>
              <Field label="Emel (pilihan) · Email (optional)">
                <Input value={form.email} onChange={(e) => set('email', e.target.value)} inputMode="email" autoComplete="email" />
              </Field>
              <Field label="Alamat premis (tapak kerja) · Premises address (work site)">
                <Textarea value={form.address} onChange={(e) => set('address', e.target.value)} rows={3} />
              </Field>
            </div>
          </Panel>

          <Panel>
            <h2 className="font-display text-lg">Salinan IC · IC copy</h2>
            <p className="mt-1 text-sm text-stone-600">Ambil gambar IC yang jelas, depan dan belakang. · Take clear photos of the front and back of your IC.</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <PhotoPick label="Depan · Front" value={form.icFront} onChange={(v) => set('icFront', v)} />
              <PhotoPick label="Belakang · Back" value={form.icBack} onChange={(v) => set('icBack', v)} />
            </div>
          </Panel>

          <Panel>
            <h2 className="font-display text-lg">Tandatangan · Signature</h2>
            <div className="mt-3">
              <SignaturePad label="Signature" onChange={(v) => set('signature', v)} />
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <Check checked={form.agree} onChange={(v) => set('agree', v)}>
                Saya telah membaca dan memahami jadual bayaran serta terma di atas, dan bersetuju membayar jumlah penuh mengikut jadual ini.
                <span className="block text-stone-500">
                  I confirm that I have read and understood the payment schedule and terms above, and I agree to pay the full job value according to this
                  schedule.
                </span>
              </Check>
              <Check checked={form.consent} onChange={(v) => set('consent', v)}>
                Saya bersetuju {app.company.name} menyimpan maklumat, salinan IC dan tandatangan saya dengan selamat (termasuk dalam storan awan yang dilindungi) untuk perjanjian ini dan rekod bayarannya sahaja.
                <span className="block text-stone-500">
                  I agree to {app.company.name} keeping my details, IC copy and signature securely (including in protected cloud storage) for this agreement and its payment records only.
                </span>
              </Check>
            </div>
          </Panel>

          {sendError && (
            <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {sendError}
            </div>
          )}
          {problems.length > 0 && (
            <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <b>Sila lengkapkan · Please complete:</b>
              <ul className="mt-1 list-disc pl-5">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          <Button variant="primary" className="h-12 w-full text-base" onClick={submit} disabled={stage === 'sending'}>
            {stage === 'sending' ? <LoaderCircle size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
            {stage === 'sending' ? 'Menghantar… · Sending…' : 'Hantar permohonan · Submit application'}
          </Button>
          <p className="flex items-start gap-2 text-xs text-stone-500">
            <LockKeyhole size={14} className="mt-0.5 shrink-0" />
            Maklumat dihantar terus kepada {app.company.name} dan pautan ini tidak boleh digunakan lagi selepas dihantar. · Your details go straight to{' '}
            {app.company.name}; this link stops working once sent.
          </p>
        </div>
      )}
    </div>
  )
}

const Panel = ({ children }: { children: ReactNode }) => <section className="glass-strong rounded-[22px] p-5">{children}</section>

function Term({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <>
      <dt className="text-stone-500">{k}</dt>
      <dd className={`whitespace-pre-line ${strong ? 'font-bold' : ''}`}>{v}</dd>
    </>
  )
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-gold-600" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  )
}

function PhotoPick({ label, value, onChange }: { label: string; value: string; onChange: (dataUrl: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <label className="block cursor-pointer">
      <span className="mb-1 block text-xs font-semibold text-stone-600">{label}</span>
      <span className="grid aspect-[1.6] place-items-center overflow-hidden rounded-xl border-2 border-dashed border-stone-300 bg-white">
        {busy ? (
          <LoaderCircle size={22} className="animate-spin text-stone-400" />
        ) : value ? (
          <img src={value} alt={label} className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-xs text-stone-500">
            <Camera size={22} /> Ambil gambar · Take photo
          </span>
        )}
      </span>
      {error && <span className="mt-1 block text-xs text-red-700">{error}</span>}
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          setBusy(true)
          setError('')
          try {
            onChange(await photoDataUrl(file))
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not read that photo.')
          } finally {
            setBusy(false)
          }
        }}
      />
    </label>
  )
}
