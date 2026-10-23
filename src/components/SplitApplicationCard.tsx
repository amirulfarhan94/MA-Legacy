import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, CheckCircle2, Copy, LoaderCircle, MessageCircle, Send, Share2, X } from 'lucide-react'
import { addDays, formatDate, formatMoney, today, toISODate } from '../lib/calc'
import {
  APPLICATION_DAYS,
  applicationUrl,
  createApplication,
  deleteApplication,
  useCloudUser,
  watchApplication,
  type Application,
} from '../lib/cloud'
import { waNumber } from '../lib/contact'
import { addPhotoFromDataUrl } from '../lib/photos'
import { useStore } from '../lib/store'
import type { Document, SplitPlan } from '../lib/types'
import { Button, buttonClass, Card, CardHeader, Modal } from './ui'

/**
 * Online application for a split plan: send the customer a link, see when it comes back, then
 * review and approve it. Approving copies their details, signature and IC photos into the plan
 * on this device and deletes the copy in the cloud.
 */
export default function SplitApplicationCard({ invoice }: { invoice: Document }) {
  const plan = invoice.split!
  const user = useCloudUser()
  const [app, setApp] = useState<Application | null | undefined>(undefined)
  const [sharing, setSharing] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [busy, setBusy] = useState(false)
  const saveDocument = useStore((s) => s.saveDocument)
  const settings = useStore((s) => s.settings)
  const token = plan.applicationToken

  useEffect(() => {
    if (!token || !user) return setApp(undefined)
    return watchApplication(token, setApp)
  }, [token, user])

  const setPlan = (patch: Partial<SplitPlan>) => {
    const cur = useStore.getState().documents.find((d) => d.id === invoice.id)
    if (cur?.split) saveDocument({ ...cur, split: { ...cur.split, ...patch } })
  }

  const send = async () => {
    setBusy(true)
    try {
      const created = today()
      const newToken = await createApplication({
        createdAt: new Date().toISOString(),
        expiresAt: new Date(`${addDays(created, APPLICATION_DAYS)}T23:59:59`).toISOString(),
        invoiceId: invoice.id,
        invoiceNo: invoice.number,
        agreementNo: plan.agreementNo,
        quotationNo: plan.quotationNo || '',
        company: { name: settings.companyName, regNo: settings.regNo, phone: settings.phone, email: settings.email, address: settings.address },
        workDescription: plan.workDescription || '',
        premisesAddress: plan.premisesAddress || '',
        plannedWorkDate: plan.plannedWorkDate || '',
        currency: settings.currency,
        total: Math.round(plan.payments.reduce((t, p) => t + p.amount, 0) * 100) / 100,
        payments: plan.payments.map((p) => ({ seq: p.seq, pct: p.pct, amount: p.amount, dueDate: p.dueDate })),
        bank: { name: settings.bankName, accountNo: settings.bankAccountNo },
        prefill: { name: plan.customerName || '', phone: plan.phone || '', email: plan.email || '' },
      })
      setPlan({ applicationToken: newToken, applicationSentAt: new Date().toISOString() })
      setSharing(true)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not create the link. Check the internet connection.')
    } finally {
      setBusy(false)
    }
  }

  const cancel = async () => {
    if (!token || !confirm('Cancel this application link? The customer will no longer be able to use it.')) return
    await deleteApplication(token).catch(() => {})
    setPlan({ applicationToken: undefined, applicationSentAt: undefined })
  }

  const signed = !!plan.customerSignature
  let body
  if (signed) {
    body = (
      <div className="flex items-start gap-3 text-sm">
        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[var(--good)]" />
        <div className="min-w-0">
          <div className="font-semibold">Signed online by {plan.customerName}</div>
          <div className="text-xs text-stone-500">
            {plan.signedAt ? formatDate(toISODate(new Date(plan.signedAt))) : ''} · IC {plan.icNo} · {plan.icPhotoIds?.length ?? 0} IC photos
          </div>
          <img src={plan.customerSignature} alt="Customer signature" className="mt-2 h-12 max-w-full object-contain" />
        </div>
      </div>
    )
  } else if (user === null || (token && user === undefined)) {
    body = (
      <p className="text-sm text-stone-600">
        Send the customer a link to fill in their details, IC photos and signature online.{' '}
        <Link to="/settings" className="font-semibold text-gold-700 hover:underline">
          Sign in under Settings → Online account
        </Link>{' '}
        first.
      </p>
    )
  } else if (!token || app === null) {
    body = (
      <div className="space-y-3 text-sm">
        <p className="text-stone-600">
          {token
            ? 'The last link is no longer active (used, cancelled or deleted).'
            : 'Send the customer a link: they fill in their details, take photos of their IC and sign on their phone.'}
        </p>
        <Button size="sm" variant="primary" onClick={send} disabled={busy || !user}>
          {busy ? <LoaderCircle size={14} className="animate-spin" /> : <Send size={14} />} {token ? 'Send a new link' : 'Send application link'}
        </Button>
      </div>
    )
  } else if (app === undefined) {
    body = (
      <p className="flex items-center gap-2 text-sm text-stone-500">
        <LoaderCircle size={14} className="animate-spin" /> Checking the link…
      </p>
    )
  } else if (app.status === 'open') {
    body = (
      <div className="space-y-3 text-sm">
        <p className="text-stone-600">
          Link sent {plan.applicationSentAt ? formatDate(toISODate(new Date(plan.applicationSentAt))) : ''} · waiting for the customer · works until{' '}
          {formatDate(toISODate(new Date(app.expiresAt)))}.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setSharing(true)}>
            <Share2 size={14} /> Share link again
          </Button>
          <Button size="sm" variant="ghost" onClick={cancel}>
            Cancel link
          </Button>
        </div>
      </div>
    )
  } else {
    body = (
      <div className="space-y-3 text-sm">
        <p className="font-semibold text-stone-900">Application received from {app.applicant?.name}</p>
        <Button size="sm" variant="primary" onClick={() => setReviewing(true)}>
          Review & approve
        </Button>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader title="Customer application" subtitle="Details, IC and signature, filled in online by the customer" />
      <div className="px-5 py-4">{body}</div>
      {sharing && token && <ShareLinkModal invoice={invoice} token={token} onClose={() => setSharing(false)} />}
      {reviewing && app?.applicant && (
        <ReviewModal
          app={app}
          onClose={() => setReviewing(false)}
          onDone={() => {
            setReviewing(false)
          }}
          onApprove={async () => {
            const a = app.applicant!
            const ids = [await addPhotoFromDataUrl(a.icFront), await addPhotoFromDataUrl(a.icBack)]
            setPlan({
              customerName: a.name,
              icNo: a.icNo,
              phone: a.phone,
              email: a.email,
              premisesAddress: a.address,
              customerSignature: a.signature,
              signedAt: a.consentAt,
              icPhotoIds: ids,
              applicationToken: undefined,
            })
            // The customer's IC now lives on this device (and in its backups): remove the cloud copy.
            await deleteApplication(app.token).catch(() => {})
          }}
          onReject={async () => {
            await deleteApplication(app.token).catch(() => {})
            setPlan({ applicationToken: undefined, applicationSentAt: undefined })
          }}
        />
      )}
    </Card>
  )
}

function ShareLinkModal({ invoice, token, onClose }: { invoice: Document; token: string; onClose: () => void }) {
  const plan = invoice.split!
  const company = useStore((s) => s.settings.companyName)
  const customer = useStore((s) => s.customers.find((c) => c.id === invoice.customerId))
  const [copied, setCopied] = useState(false)
  const url = applicationUrl(token)
  const message =
    `Salam ${plan.customerName || customer?.name || ''}, sila lengkapkan permohonan bayaran ansuran 3× (0% faedah) untuk invois ${invoice.number} di pautan ini:\n${url}\n\n` +
    `Anda perlu isi maklumat, ambil gambar IC (depan & belakang) dan tandatangan. Terima kasih! — ${company}`
  const phone = plan.phone || customer?.phone
  const canShare = typeof navigator.share === 'function' && window.matchMedia('(pointer: coarse)').matches

  return (
    <Modal open onClose={onClose} title="Send the application link">
      <p className="text-sm text-stone-600">Send this link to the customer. It works once, until they submit, for {APPLICATION_DAYS} days.</p>
      <input readOnly value={url} onFocus={(e) => e.target.select()} className="mt-3 w-full rounded-xl border border-stone-300 bg-[var(--field)] px-3 py-2 text-sm" aria-label="Application link" />
      <div className="mt-4 flex flex-wrap gap-2">
        <a href={`https://wa.me/${phone ? waNumber(phone) : ''}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" className={buttonClass('primary')}>
          <MessageCircle size={15} /> WhatsApp
        </a>
        {canShare && (
          <Button onClick={() => navigator.share({ text: message }).catch(() => {})}>
            <Share2 size={15} /> Share
          </Button>
        )}
        <Button
          onClick={async () => {
            await navigator.clipboard.writeText(message).catch(() => {})
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
        >
          {copied ? <Check size={15} className="text-[var(--good)]" /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy message'}
        </Button>
      </div>
    </Modal>
  )
}

function ReviewModal({
  app,
  onClose,
  onDone,
  onApprove,
  onReject,
}: {
  app: Application
  onClose: () => void
  onDone: () => void
  onApprove: () => Promise<void>
  onReject: () => Promise<void>
}) {
  const a = app.applicant!
  const [busy, setBusy] = useState(false)
  const run = (fn: () => Promise<void>) => async () => {
    setBusy(true)
    try {
      await fn()
      onDone()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }
  const rows: [string, string][] = [
    ['Full name (as per IC)', a.name],
    ['IC no.', a.icNo],
    ['Phone', a.phone],
    ['Email', a.email || '—'],
    ['Premises address', a.address],
    ['Agreed', formatDate(toISODate(new Date(a.consentAt)))],
  ]
  return (
    <Modal
      open
      onClose={onClose}
      title={`Application · ${app.invoiceNo}`}
      footer={
        <>
          <Button
            variant="danger"
            className="mr-auto"
            disabled={busy}
            onClick={() => confirm('Reject this application? It is deleted and the customer would need a new link.') && run(onReject)()}
          >
            <X size={15} /> Reject
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Later
          </Button>
          <Button variant="primary" disabled={busy} onClick={run(onApprove)}>
            {busy ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />} Approve
          </Button>
        </>
      }
    >
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-stone-500">{k}</dt>
            <dd className="whitespace-pre-line font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {[a.icFront, a.icBack].map((src, i) => (
          <a key={i} href={src} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-stone-200">
            <img src={src} alt={i ? 'IC back' : 'IC front'} className="aspect-[1.6] w-full object-cover" />
          </a>
        ))}
      </div>
      <div className="mt-4 rounded-xl border border-stone-200 bg-white p-2">
        <img src={a.signature} alt="Signature" className="mx-auto h-20 object-contain" />
      </div>
      <p className="mt-3 text-xs text-stone-500">
        Total {formatMoney(app.total, app.currency)} · Approving fills in the plan and the agreement, keeps the IC photos and signature on this device
        (and in backups) and deletes the online copy.
      </p>
    </Modal>
  )
}
