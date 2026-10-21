import { useState } from 'react'
import { FileSpreadsheet, LoaderCircle } from 'lucide-react'
import { accountsSheets, accountsWorkbook } from '../lib/accountsExport'
import { addDays, formatDate, today } from '../lib/calc'
import { shareFile } from '../lib/pdf'
import { useStore } from '../lib/store'
import { Button, ChipGroup, Field, Input, Modal } from './ui'

type Preset = 'This month' | 'Last month' | 'This year' | 'Last year' | 'Custom'

function range(p: Exclude<Preset, 'Custom'>, t = today()): [string, string] {
  const [y, m] = t.split('-').map(Number)
  const ym = (yy: number, mm: number) => `${yy}-${String(mm).padStart(2, '0')}`
  if (p === 'This month') return [`${ym(y, m)}-01`, t]
  if (p === 'Last month') {
    const first = m === 1 ? `${ym(y - 1, 12)}-01` : `${ym(y, m - 1)}-01`
    return [first, addDays(`${ym(y, m)}-01`, -1)]
  }
  if (p === 'This year') return [`${y}-01-01`, t]
  return [`${y - 1}-01-01`, `${y - 1}-12-31`]
}

/** "Export for accountant": an Excel file of the accounts for a chosen period. */
export default function AccountsExportButton() {
  const [open, setOpen] = useState(false)
  const [preset, setPreset] = useState<Preset>('Last month')
  const [[from, to], setRange] = useState<[string, string]>(() => range('Last month'))
  const [busy, setBusy] = useState(false)

  const choose = (p: Preset) => {
    setPreset(p)
    if (p !== 'Custom') setRange(range(p))
  }

  async function run() {
    setBusy(true)
    try {
      const { documents, transactions, customers, settings } = useStore.getState()
      const sheets = accountsSheets({ documents, transactions, customers, companyName: settings.companyName, taxLabel: settings.taxLabel || 'SST', from, to })
      const file = await accountsWorkbook(sheets, `Accounts ${from} to ${to}.xlsx`)
      await shareFile(file, `${settings.companyName} accounts, ${formatDate(from)} – ${formatDate(to)}`)
      setOpen(false)
    } catch (e) {
      console.error(e)
      alert('Could not make the Excel file.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="no-print">
        <FileSpreadsheet size={15} /> Export for accountant
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Export for accountant"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={run} disabled={busy || !from || !to || from > to}>
              {busy ? <LoaderCircle size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />} Export Excel
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-stone-600">
          One Excel file with tabs for the summary, sales invoices, credit notes, money in, expenses and SST — ready for your
          accountant or tax filing.
        </p>
        <ChipGroup
          label="Period"
          value={preset}
          onChange={choose}
          options={(['This month', 'Last month', 'This year', 'Last year', 'Custom'] as Preset[]).map((p) => ({ value: p, label: p }))}
        />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="From">
            <Input
              type="date"
              value={from}
              onChange={(e) => {
                setPreset('Custom')
                setRange([e.target.value, to])
              }}
            />
          </Field>
          <Field label="To">
            <Input
              type="date"
              value={to}
              onChange={(e) => {
                setPreset('Custom')
                setRange([from, e.target.value])
              }}
            />
          </Field>
        </div>
      </Modal>
    </>
  )
}
