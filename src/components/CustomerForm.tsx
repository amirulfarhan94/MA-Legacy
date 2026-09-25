import { useEffect, useState } from 'react'
import { uid, useStore } from '../lib/store'
import type { Customer } from '../lib/types'
import { Button, Field, Input, Modal, Textarea } from './ui'

export const emptyCustomer = (): Customer => ({
  id: uid(),
  name: '',
  company: '',
  regNo: '',
  email: '',
  phone: '',
  address: '',
  notes: '',
  createdAt: new Date().toISOString(),
})

export default function CustomerForm({
  open,
  onClose,
  customer,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  customer?: Customer
  onSaved?: (c: Customer) => void
}) {
  const saveCustomer = useStore((s) => s.saveCustomer)
  const [form, setForm] = useState<Customer>(customer ?? emptyCustomer())

  useEffect(() => {
    if (open) setForm(customer ?? emptyCustomer())
  }, [open, customer])

  const set = (k: keyof Customer) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value })
  const valid = form.name.trim() || form.company.trim()

  const submit = () => {
    if (!valid) return
    saveCustomer(form)
    onSaved?.(form)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={customer ? 'Edit customer' : 'New customer'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!valid}>
            Save customer
          </Button>
        </>
      }
    >
      <form
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <Field label="Contact person">
          <Input value={form.name} onChange={set('name')} autoFocus />
        </Field>
        <Field label="Company name">
          <Input value={form.company} onChange={set('company')} />
        </Field>
        <Field label="Phone">
          <Input value={form.phone} onChange={set('phone')} />
        </Field>
        <Field label="Email">
          <Input type="email" value={form.email} onChange={set('email')} />
        </Field>
        <Field label="SSM / Registration no." className="sm:col-span-2">
          <Input value={form.regNo} onChange={set('regNo')} />
        </Field>
        <Field label="Address" className="sm:col-span-2">
          <Textarea value={form.address} onChange={set('address')} />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea value={form.notes} onChange={set('notes')} rows={2} />
        </Field>
        <button type="submit" hidden />
      </form>
      {!valid && <p className="mt-2 text-xs text-stone-500">Enter a contact person or company name.</p>}
    </Modal>
  )
}
