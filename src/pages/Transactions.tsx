import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeftRight, Download, Plus, Search } from 'lucide-react'
import { formatDate, formatMoney, today } from '../lib/calc'
import { customerLabel, uid, useStore } from '../lib/store'
import { DOC_META, PAYMENT_METHODS, type PaymentMethod, type Transaction, type TxnKind } from '../lib/types'
import { Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, StatusBadge, tableCls } from '../components/ui'

const CATEGORIES: Record<TxnKind, string[]> = {
  income: ['Sales', 'Service', 'Deposit', 'Other income'],
  expense: ['Materials', 'Equipment', 'Transport', 'Salary', 'Rental', 'Utilities', 'Marketing', 'Subcontractor', 'Other expense'],
}

interface Row {
  key: string
  date: string
  kind: TxnKind
  category: string
  description: string
  customerId?: string
  method: PaymentMethod
  reference: string
  amount: number
  /** Receipt-backed rows link to the receipt; manual rows are editable. */
  receiptId?: string
  txn?: Transaction
}

const blankTxn = (kind: TxnKind): Transaction => ({
  id: uid(),
  kind,
  date: today(),
  category: CATEGORIES[kind][0],
  description: '',
  amount: 0,
  method: 'bank_transfer',
  customerId: '',
  reference: '',
  createdAt: new Date().toISOString(),
})

export default function Transactions() {
  const documents = useStore((s) => s.documents)
  const transactions = useStore((s) => s.transactions)
  const customers = useStore((s) => s.customers)
  const currency = useStore((s) => s.settings.currency)
  const saveTransaction = useStore((s) => s.saveTransaction)
  const deleteTransaction = useStore((s) => s.deleteTransaction)

  const [q, setQ] = useState('')
  const [kind, setKind] = useState<'' | TxnKind>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [editing, setEditing] = useState<Transaction | null>(null)

  const allRows = useMemo<Row[]>(() => {
    const fromReceipts: Row[] = documents
      .filter((d) => d.type === 'receipt' && d.status !== 'cancelled')
      .map((d) => ({
        key: `r-${d.id}`,
        date: d.date,
        kind: 'income',
        category: 'Receipt',
        description: `${d.number}${d.notes ? ` — ${d.notes}` : ''}`,
        customerId: d.customerId,
        method: d.paymentMethod ?? 'other',
        reference: d.paymentRef || d.reference,
        amount: Number(d.amountPaid) || 0,
        receiptId: d.id,
      }))
    const manual: Row[] = transactions.map((t) => ({
      key: `t-${t.id}`,
      date: t.date,
      kind: t.kind,
      category: t.category,
      description: t.description,
      customerId: t.customerId,
      method: t.method,
      reference: t.reference,
      amount: Number(t.amount) || 0,
      txn: t,
    }))
    return [...fromReceipts, ...manual].sort((a, b) => b.date.localeCompare(a.date))
  }, [documents, transactions])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return allRows.filter((r) => {
      if (kind && r.kind !== kind) return false
      if (from && r.date < from) return false
      if (to && r.date > to) return false
      if (!needle) return true
      const c = customers.find((x) => x.id === r.customerId)
      return [r.description, r.category, r.reference, customerLabel(c)].some((v) => v.toLowerCase().includes(needle))
    })
  }, [allRows, kind, from, to, q, customers])

  const income = rows.filter((r) => r.kind === 'income').reduce((s, r) => s + r.amount, 0)
  const expense = rows.filter((r) => r.kind === 'expense').reduce((s, r) => s + r.amount, 0)

  const exportCsv = () => {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
    const header = ['Date', 'Type', 'Category', 'Description', 'Customer', 'Method', 'Reference', 'Amount']
    const lines = rows.map((r) =>
      [
        r.date,
        r.kind,
        r.category,
        r.description,
        customerLabel(customers.find((c) => c.id === r.customerId)).replace('—', ''),
        PAYMENT_METHODS[r.method],
        r.reference,
        (r.kind === 'expense' ? -r.amount : r.amount).toFixed(2),
      ]
        .map(esc)
        .join(','),
    )
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `transactions-${today()}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <>
      <PageHeader
        title="Transactions"
        subtitle="Receipts are recorded automatically. Add other income and expenses manually."
        actions={
          <>
            <Button onClick={exportCsv} disabled={!rows.length}>
              <Download size={15} /> Export CSV
            </Button>
            <Button onClick={() => setEditing(blankTxn('expense'))}>
              <Plus size={15} /> Expense
            </Button>
            <Button variant="primary" onClick={() => setEditing(blankTxn('income'))}>
              <Plus size={15} /> Income
            </Button>
          </>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Summary label="Money in" value={formatMoney(income, currency)} />
        <Summary label="Money out" value={formatMoney(expense, currency)} />
        <Summary label="Net" value={formatMoney(income - expense, currency)} emphasis />
      </div>

      <Card>
        {allRows.length === 0 ? (
          <EmptyState
            icon={<ArrowLeftRight size={22} />}
            title="No transactions yet"
            text="Issue a receipt or add an income / expense entry to see it here."
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 p-3">
              <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
              </div>
              <Select value={kind} onChange={(e) => setKind(e.target.value as '' | TxnKind)} className="w-auto">
                <option value="">Income & expense</option>
                <option value="income">Income only</option>
                <option value="expense">Expense only</option>
              </Select>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" aria-label="From date" />
              <span className="text-sm text-stone-400">to</span>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" aria-label="To date" />
              {(q || kind || from || to) && (
                <Button variant="ghost" onClick={() => { setQ(''); setKind(''); setFrom(''); setTo('') }}>
                  Clear
                </Button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className={tableCls.table}>
                <thead>
                  <tr>
                    <th className={tableCls.th}>Date</th>
                    <th className={tableCls.th}>Type</th>
                    <th className={tableCls.th}>Description</th>
                    <th className={tableCls.th}>Customer</th>
                    <th className={tableCls.th}>Method</th>
                    <th className={`${tableCls.th} text-right`}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const c = customers.find((x) => x.id === r.customerId)
                    const content = (
                      <>
                        <td className={`${tableCls.td} tabular whitespace-nowrap text-stone-600`}>{formatDate(r.date)}</td>
                        <td className={tableCls.td}>
                          <StatusBadge status={r.kind} />
                          <div className="mt-1 text-xs text-stone-500">{r.category}</div>
                        </td>
                        <td className={tableCls.td}>
                          {r.receiptId ? (
                            <Link to={`/d/${DOC_META.receipt.path}/${r.receiptId}`} className="font-medium text-gold-700 hover:underline">
                              {r.description}
                            </Link>
                          ) : (
                            r.description || '—'
                          )}
                          {r.reference && <div className="text-xs text-stone-500">Ref: {r.reference}</div>}
                        </td>
                        <td className={tableCls.td}>{r.customerId ? customerLabel(c) : '—'}</td>
                        <td className={`${tableCls.td} text-stone-600`}>{PAYMENT_METHODS[r.method]}</td>
                        <td className={`${tableCls.td} tabular whitespace-nowrap text-right font-medium ${r.kind === 'expense' ? 'text-red-700' : 'text-emerald-700'}`}>
                          {r.kind === 'expense' ? '−' : '+'} {formatMoney(r.amount, currency)}
                        </td>
                      </>
                    )
                    return r.txn ? (
                      <tr key={r.key} className={tableCls.tr} onClick={() => setEditing(r.txn!)}>
                        {content}
                      </tr>
                    ) : (
                      <tr key={r.key}>{content}</tr>
                    )
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-stone-500">
                        Nothing matches these filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <TxnModal
        txn={editing}
        onClose={() => setEditing(null)}
        onSave={(t) => {
          saveTransaction(t)
          setEditing(null)
        }}
        onDelete={
          editing && transactions.some((t) => t.id === editing.id)
            ? () => {
                if (confirm('Delete this transaction?')) {
                  deleteTransaction(editing.id)
                  setEditing(null)
                }
              }
            : undefined
        }
      />
    </>
  )
}

function Summary({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <Card className="px-5 py-4">
      <div className="text-xs font-medium text-stone-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${emphasis ? 'text-gold-700' : 'text-stone-900'}`}>{value}</div>
    </Card>
  )
}

function TxnModal({
  txn,
  onClose,
  onSave,
  onDelete,
}: {
  txn: Transaction | null
  onClose: () => void
  onSave: (t: Transaction) => void
  onDelete?: () => void
}) {
  const customers = useStore((s) => s.customers)
  const currency = useStore((s) => s.settings.currency)
  const [form, setForm] = useState<Transaction | null>(txn)
  const [lastTxn, setLastTxn] = useState(txn)
  if (txn !== lastTxn) {
    setLastTxn(txn)
    setForm(txn)
  }
  if (!form) return null

  const set = <K extends keyof Transaction>(k: K, v: Transaction[K]) => setForm({ ...form, [k]: v })
  const valid = form.amount > 0 && form.date

  return (
    <Modal
      open={!!txn}
      onClose={onClose}
      title={`${onDelete ? 'Edit' : 'New'} ${form.kind}`}
      footer={
        <>
          {onDelete && (
            <Button variant="danger" onClick={onDelete} className="mr-auto">
              Delete
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!valid} onClick={() => onSave(form)}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Type">
          <Select
            value={form.kind}
            onChange={(e) => {
              const k = e.target.value as TxnKind
              setForm({ ...form, kind: k, category: CATEGORIES[k][0] })
            }}
          >
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </Select>
        </Field>
        <Field label="Category">
          <Select value={form.category} onChange={(e) => set('category', e.target.value)}>
            {CATEGORIES[form.kind].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Date">
          <Input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label={`Amount (${currency})`}>
          <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => set('amount', Number(e.target.value) || 0)} />
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <Input value={form.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <Field label="Customer (optional)">
          <Select value={form.customerId ?? ''} onChange={(e) => set('customerId', e.target.value)}>
            <option value="">—</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {customerLabel(c)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Method">
          <Select value={form.method} onChange={(e) => set('method', e.target.value as PaymentMethod)}>
            {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Reference" className="sm:col-span-2">
          <Input value={form.reference} onChange={(e) => set('reference', e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}
