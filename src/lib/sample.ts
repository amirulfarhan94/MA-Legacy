import { addDays, docTotals, today } from './calc'
import { defaultSettings, uid, type BackupData } from './store'
import type { Customer, Document, LineItem, Transaction } from './types'

/** Demo data spread over the last few months so the dashboard has something to show. */
export function sampleData(): BackupData {
  const t = today()
  const stamp = new Date().toISOString()
  const year = t.slice(0, 4)
  const cust = (name: string, company: string, phone: string, address: string): Customer => ({
    id: uid(), name, company, phone, address, email: '', regNo: '', notes: '', createdAt: stamp,
  })
  const customers = [
    cust('Encik Hafiz', 'Hafiz Engineering Sdn Bhd', '012-345 6789', 'No. 12, Jalan Perusahaan 3\n40000 Shah Alam, Selangor'),
    cust('Puan Aisyah', 'Aisyah Catering Enterprise', '013-222 1100', 'Lot 5, Jalan Pasar\n43000 Kajang, Selangor'),
    cust('Mr. Tan', 'TKL Trading', '016-778 9900', '23, Jalan SS2/24\n47300 Petaling Jaya, Selangor'),
  ]
  const item = (description: string, qty: number, unitPrice: number, unit = 'unit'): LineItem => ({ id: uid(), description, qty, unit, unitPrice })

  const docs: Document[] = []
  const counters: Record<string, number> = {}
  const mk = (type: Document['type'], customer: Customer, daysAgo: number, items: LineItem[], extra: Partial<Document> = {}): Document => {
    const prefix = defaultSettings.prefixes[type]
    counters[type] = (counters[type] ?? 0) + 1
    const date = addDays(t, -daysAgo)
    const d: Document = {
      id: uid(),
      type,
      number: `${prefix}-${year}-${String(counters[type]).padStart(4, '0')}`,
      customerId: customer.id,
      date,
      dueDate: ['receipt', 'service_report', 'credit_note', 'delivery_order'].includes(type) ? '' : addDays(date, 14),
      reference: '',
      items,
      discount: 0,
      taxRate: 0,
      notes: '',
      terms: defaultSettings.defaultTerms[type],
      status: 'sent',
      createdAt: stamp,
      updatedAt: stamp,
      ...extra,
    }
    docs.push(d)
    return d
  }
  const receipt = (inv: Document, daysAgo: number, amount = docTotals(inv).total) =>
    mk('receipt', customers.find((c) => c.id === inv.customerId)!, daysAgo, [], {
      invoiceId: inv.id, sourceId: inv.id, reference: inv.number, amountPaid: amount,
      paymentMethod: 'bank_transfer', paymentRef: '', notes: `Payment for ${inv.number}`, status: 'completed',
    })

  const [hafiz, aisyah, tan] = customers
  const supplier: Customer = { ...cust('Mr. Lim', 'Lim Electronics Supply Sdn Bhd', '03-7781 2233', 'No. 8, Jalan Kenari 5\n47100 Puchong, Selangor'), kind: 'supplier' }
  customers.push(supplier)
  const q1 = mk('quotation', hafiz, 150, [item('Supply & install CCTV camera 4MP', 8, 380), item('NVR 8-channel with 2TB HDD', 1, 1250), item('Cabling & installation', 1, 1800, 'lot')], { status: 'accepted' })
  const i1 = mk('invoice', hafiz, 140, q1.items.map((i) => ({ ...i, id: uid() })), { sourceId: q1.id, reference: q1.number })
  receipt(i1, 120)
  const i2 = mk('invoice', aisyah, 95, [item('Kitchen exhaust servicing', 1, 950, 'job'), item('Replace filter', 4, 85, 'pcs')])
  receipt(i2, 80)
  const i3 = mk('invoice', tan, 60, [item('Network setup — office 20 users', 1, 4200, 'lot'), item('Wi-Fi access point', 3, 520)])
  mk('delivery_order', tan, 58, [item('Wi-Fi access point', 3, 0), item('24-port network switch', 1, 0)], { status: 'delivered', sourceId: i3.id, reference: i3.number })
  receipt(i3, 45, 2000)
  // One access point returned: credit RM520 and refund it.
  mk('credit_note', tan, 30, [item('Wi-Fi access point (returned)', 1, 520)], {
    status: 'issued', invoiceId: i3.id, sourceId: i3.id, reference: i3.number, notes: 'Unit returned — faulty on arrival.',
    refundAmount: 0, paymentMethod: 'bank_transfer', paymentRef: '',
  })
  receipt(i3, 20, 3240)
  mk('quotation', tan, 30, [item('Annual maintenance contract', 12, 350, 'month')], { status: 'sent' })
  const i4 = mk('invoice', hafiz, 25, [item('Preventive maintenance — CCTV', 1, 650, 'job')])
  receipt(i4, 10)
  mk('invoice', aisyah, 12, [item('Aircond servicing', 3, 120), item('Gas top-up', 2, 150)])
  mk('proforma', tan, 5, [item('Firewall appliance', 1, 3800)], { status: 'sent' })
  const po = mk('purchase_order', supplier, 9, [item('IP camera 4MP', 6, 240), item('Cat6 cable box 305m', 2, 380, 'box')], { status: 'received' })
  // Older invoice, partly paid and long overdue, so the aging report has something in 60+ days.
  const i5 = mk('invoice', aisyah, 80, [item('Exhaust hood deep cleaning', 1, 1600, 'job')], { itemAdjustments: true })
  i5.items[0].discountPct = 10
  i5.items[0].taxRate = 8
  receipt(i5, 70, 500)
  mk('service_report', hafiz, 25, [item('Cat6 cable', 20, 0, 'm'), item('RJ45 connector', 10, 0, 'pcs')], {
    status: 'completed',
    service: {
      technician: 'Amirul', location: 'Hafiz Engineering, Shah Alam', equipment: 'CCTV system (8 cameras)', serialNo: '',
      timeIn: '09:30', timeOut: '12:45', problem: 'Camera 3 and 5 no display.',
      workDone: 'Checked cabling, re-terminated connectors for camera 3 and 5. Cleaned all camera lenses. Tested recording playback.',
      recommendation: 'Replace camera 5 power adapter within 3 months.', acknowledgedBy: 'Encik Hafiz',
    },
  })

  const txn = (kind: Transaction['kind'], daysAgo: number, category: string, description: string, amount: number): Transaction => ({
    id: uid(), kind, date: addDays(t, -daysAgo), category, description, amount, method: 'bank_transfer', customerId: '', reference: '', createdAt: stamp,
  })
  const transactions = [
    txn('expense', 138, 'Materials', 'CCTV cameras & NVR from supplier', 3900),
    txn('expense', 90, 'Transport', 'Fuel & toll', 180),
    txn('expense', 58, 'Equipment', 'Access points & switches', 2100),
    txn('expense', 30, 'Rental', 'Office rental', 1200),
    txn('expense', 8, 'Marketing', 'Facebook ads', 250),
    { ...txn('expense', 6, 'Purchases', `Deposit for ${po.number}`, 1000), customerId: supplier.id, reference: po.number, docId: po.id },
  ]

  return { version: 1, exportedAt: stamp, customers, documents: docs, transactions, settings: defaultSettings }
}
