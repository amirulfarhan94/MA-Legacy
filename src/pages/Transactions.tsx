import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Download, Plus, Search, X } from 'lucide-react'
import { docTotals, formatDate, formatMoney, today } from '../lib/calc'
import { cashMovements } from '../lib/finance'
import { customerLabel, uid, useStore } from '../lib/store'
import { DOC_META, PAYMENT_METHODS, type PaymentMethod, type Transaction, type TxnKind } from '../lib/types'
import { Button, Card, ChipGroup, EmptyState, Field, Input, MetricStrip, Modal, NumberInput, PageHeader, Select, StatusBadge, tableCls } from '../components/ui'

const CATEGORIES: Record<TxnKind, string[]> = {
  income: ['Sales', 'Service', 'Deposit', 'Other income'],
  expense: ['Purchases', 'Materials', 'Equipment', 'Transport', 'Salary', 'Rental', 'Utilities', 'Marketing', 'Subcontractor', 'Other expense'],
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
  /** Rows from receipts / credit-note refunds link to that document; manual rows are editable. */
  docId?: string
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
  const [params, setParams] = useSearchParams()

  // "Record payment" on a purchase order lands here with ?po=<id>: open a pre-filled expense.
  useEffect(() => {
    const poId = params.get('po')
    if (!poId) return
    const po = documents.find((d) => d.id === poId)
    if (po) {
      const paid = transactions.filter((t) => t.docId === po.id).reduce((s, t) => s + t.amount, 0)
      setEditing({
        ...blankTxn('expense'),
        category: 'Purchases',
        description: `Payment for ${po.number}`,
        amount: Math.max(0, Math.round((docTotals(po).total - paid) * 100) / 100),
        customerId: po.customerId,
        reference: po.number,
        docId: po.id,
      })
    }
    setParams({}, { replace: true })
  }, [params, setParams, documents, transactions])

  const allRows = useMemo<Row[]>(
    () =>
      cashMovements(documents, transactions).map((m) => ({
        key: m.key,
        date: m.date,
        kind: m.amount < 0 ? 'expense' : 'income',
        category: m.category,
        description: m.description,
        customerId: m.customerId,
        method: m.method,
        reference: m.reference,
        amount: Math.abs(m.amount),
        docId: m.docId,
        txn: m.txn,
      })),
    [documents, transactions],
  )


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

  const docLink = (id: string) => {
    const d = documents.find((x) => x.id === id)
    return d ? `/d/${DOC_META[d.type].path}/${d.id}` : '#'
  }

  const filtered = !!(q || kind || from || to)
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
        subtitle="Receipts and credit-note refunds are recorded automatically. Add other income and expenses manually."
        actions={
          <>
            <Button onClick={exportCsv} disabled={!rows.length} title="Export CSV" aria-label="Export CSV">
              <Download size={15} /> <span className="hidden sm:inline">Export CSV</span>
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

      <div className="mb-5">
        <MetricStrip
          currency={currency}
          items={[
            { label: 'Money in', value: income, tone: 'good' },
            { label: 'Money out', value: expense, tone: 'bad' },
            { label: filtered ? 'Net (filtered)' : 'Net', value: income - expense, tone: 'gold' },
          ]}
        />
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
            <div className="space-y-2.5 border-b border-stone-200 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[180px] flex-1 sm:max-w-sm">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <Input placeholder="Search description, customer, ref…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
                </div>
                <div className="flex min-w-0 items-center gap-2 max-sm:w-full">
                  <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="min-w-0 flex-1 sm:w-auto sm:flex-none" aria-label="From date" />
                  <span className="text-sm text-stone-400">to</span>
                  <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="min-w-0 flex-1 sm:w-auto sm:flex-none" aria-label="To date" />
                </div>
                {filtered && (
                  <Button variant="ghost" onClick={() => { setQ(''); setKind(''); setFrom(''); setTo('') }}>
                    <X size={14} /> Clear
                  </Button>
                )}
              </div>
              <ChipGroup
                label="Type"
                value={kind}
                onChange={setKind}
                options={[
                  { value: '' as const, label: 'All', count: allRows.length },
                  { value: 'income' as const, label: 'Income', count: allRows.filter((r) => r.kind === 'income').length, dot: 'var(--good)' },
                  { value: 'expense' as const, label: 'Expense', count: allRows.filter((r) => r.kind === 'expense').length, dot: 'var(--critical)' },
                ]}
              />
            </div>
            <div className="@container">
              {rows.length === 0 && <p className="px-4 py-10 text-center text-sm text-stone-500">Nothing matches these filters.</p>}
              <ul className="divide-y divide-stone-200 @min-[760px]:hidden">
                {rows.map((r) => {
                  const c = customers.find((x) => x.id === r.customerId)
                  const isIn = r.kind === 'income'
                  const body = (
                    <>
                      <span className={`mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl ${isIn ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                        {isIn ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-3">
                          <span className="line-clamp-2 text-sm font-semibold text-stone-900">{r.description || r.category}</span>
                          <span className={`tabular shrink-0 whitespace-nowrap text-sm font-bold ${isIn ? 'text-emerald-700' : 'text-red-700'}`}>
                            {isIn ? '+' : '−'} {formatMoney(r.amount, currency)}
                          </span>
                        </span>
                        <span className="tabular mt-1 block text-xs text-stone-500">
                          {[formatDate(r.date), r.category, r.customerId ? customerLabel(c) : '', PAYMENT_METHODS[r.method]].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                    </>
                  )
                  const cls = 'flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[var(--item-hover)]'
                  return (
                    <li key={r.key}>
                      {r.txn ? (
                        <button type="button" className={cls} onClick={() => setEditing(r.txn!)}>
                          {body}
                        </button>
                      ) : r.docId ? (
                        <Link to={docLink(r.docId)} className={cls}>
                          {body}
                        </Link>
                      ) : (
                        <div className={cls}>{body}</div>
                      )}
                    </li>
                  )
                })}
              </ul>
              <div className="hidden overflow-x-auto @min-[760px]:block">
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
                            {r.docId ? (
                              <Link to={docLink(r.docId)} className="font-medium text-gold-700 hover:underline">
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
                  </tbody>
                </table>
              </div>
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
          <NumberInput value={form.amount} onValueChange={(v) => set('amount', v)} placeholder="0.00" />
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <Input value={form.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <Field label="Customer / supplier (optional)">
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
