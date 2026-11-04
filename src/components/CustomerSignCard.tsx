import { useState } from 'react'
import { PenLine } from 'lucide-react'
import { formatDateTime } from '../lib/calc'
import { customerLabel, useStore } from '../lib/store'
import type { Document } from '../lib/types'
import SignaturePad from './SignaturePad'
import { Button, Card, CardHeader, Field, Input, Modal } from './ui'

/**
 * The customer signs a service report or delivery order on this phone when the work is done or
 * the goods arrive. The signature, name and time print on the document as proof of sign-off.
 */
export default function CustomerSignCard({ doc }: { doc: Document }) {
  const saveDocument = useStore((s) => s.saveDocument)
  const customer = useStore((s) => s.customers.find((c) => c.id === doc.customerId))
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [image, setImage] = useState('')
  const sign = doc.customerSign
  const what = doc.type === 'delivery_order' ? 'the goods were received in good order' : 'the work was done'

  const start = () => {
    setName(doc.service?.acknowledgedBy || customer?.name || (customer ? customerLabel(customer) : ''))
    setImage('')
    setOpen(true)
  }

  const save = () => {
    const signed = { ...doc, customerSign: { name: name.trim(), signedAt: new Date().toISOString(), image } }
    // Signing completes the document, and fills in "Acknowledged by" on a service report.
    if (doc.type === 'service_report') {
      signed.status = doc.status === 'cancelled' ? doc.status : 'completed'
      if (doc.service && !doc.service.acknowledgedBy.trim()) signed.service = { ...doc.service, acknowledgedBy: name.trim() }
    }
    if (doc.type === 'delivery_order' && doc.status !== 'cancelled') signed.status = 'delivered'
    saveDocument(signed)
    setOpen(false)
  }

  const clear = () => {
    if (!confirm('Remove the customer’s signature from this document?')) return
    saveDocument({ ...doc, customerSign: undefined })
  }

  return (
    <Card>
      <CardHeader
        title="Customer sign-off"
        subtitle={sign ? `Signed ${formatDateTime(sign.signedAt)}` : `Hand the phone to the customer to sign that ${what}.`}
        action={
          !sign && (
            <Button size="sm" variant="primary" onClick={start}>
              <PenLine size={14} /> Sign now
            </Button>
          )
        }
      />
      {sign && (
        <div className="flex items-end justify-between gap-3 p-5">
          <div className="min-w-0">
            <img src={sign.image} alt={`Signature of ${sign.name}`} className="h-16 max-w-[220px] object-contain object-left" />
            <div className="mt-1 truncate border-t border-stone-300 pt-1 text-sm font-semibold text-stone-900">{sign.name}</div>
          </div>
          <Button size="sm" variant="ghost" onClick={clear}>
            Remove
          </Button>
        </div>
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Customer sign-off"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!image || !name.trim()} onClick={save}>
              Save signature
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-stone-600">
          {doc.type === 'delivery_order'
            ? 'Barang diterima dalam keadaan baik. · Goods received in good order and condition.'
            : 'Kerja telah disiapkan dengan memuaskan. · The work above has been carried out satisfactorily.'}
        </p>
        <Field label="Nama · Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="mt-3">
          <SignaturePad label="Customer signature" onChange={setImage} />
        </div>
      </Modal>
    </Card>
  )
}
