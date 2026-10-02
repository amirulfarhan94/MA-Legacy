import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { addDays, invoiceBalance, nextDocNumber, today } from './calc'
import type { Customer, Document, DocType, Settings, Transaction } from './types'

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)

const now = () => new Date().toISOString()

export const defaultSettings: Settings = {
  companyName: 'MA Legacy Solutions',
  regNo: '',
  sstNo: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  bankName: '',
  bankAccountName: 'MA Legacy Solutions',
  bankAccountNo: '',
  currency: 'RM',
  defaultTaxRate: 0,
  taxLabel: 'SST',
  prefixes: {
    quotation: 'QT',
    proforma: 'PI',
    invoice: 'INV',
    delivery_order: 'DO',
    receipt: 'OR',
    credit_note: 'CN',
    service_report: 'SR',
    purchase_order: 'PO',
  },
  defaultTerms: {
    quotation:
      '1. This quotation is valid for the period stated above.\n2. 50% deposit is required upon confirmation.\n3. Prices are subject to change after the validity period.',
    proforma: 'Payment is required before goods/services are delivered.',
    invoice: 'Please make payment within the due date to the bank account stated above.',
    receipt: 'Thank you for your payment.',
    service_report: 'The customer acknowledges that the above work has been carried out satisfactorily.',
    delivery_order: 'Goods received in good order and condition. Please check upon delivery.',
    credit_note: 'This credit note reduces the amount owed on the invoice stated above.',
    purchase_order: 'Please quote our PO number on your delivery order and invoice.',
  },
  defaultDueDays: 14,
  quotationValidDays: 30,
  logoDataUrl: '',
  paymentQrDataUrl: '',
  paymentQrLabel: 'Scan to pay with DuitNow',
}

/** Fills settings keys added in later versions (new document types, QR…) from the defaults. */
function normalizeSettings(s: Partial<Settings> | undefined): Settings {
  return {
    ...defaultSettings,
    ...s,
    prefixes: { ...defaultSettings.prefixes, ...s?.prefixes },
    defaultTerms: { ...defaultSettings.defaultTerms, ...s?.defaultTerms },
  }
}

export interface BackupData {
  version: 1
  exportedAt: string
  customers: Customer[]
  documents: Document[]
  transactions: Transaction[]
  settings: Settings
}

interface State {
  customers: Customer[]
  documents: Document[]
  transactions: Transaction[]
  settings: Settings

  saveCustomer: (c: Customer) => void
  deleteCustomer: (id: string) => void

  newDocument: (type: DocType, customerId?: string) => Document
  saveDocument: (d: Document) => Document
  deleteDocument: (id: string) => void
  /** Copies a document into a new one of another type (e.g. quotation → invoice). */
  convertDocument: (id: string, to: DocType) => Document
  /** Receipt pre-filled with the invoice's outstanding balance. */
  receiptForInvoice: (invoiceId: string) => Document
  /** Credit note pre-filled with the invoice's lines, to trim down to what is credited. */
  creditNoteForInvoice: (invoiceId: string) => Document

  saveTransaction: (t: Transaction) => void
  deleteTransaction: (id: string) => void

  updateSettings: (s: Partial<Settings>) => void
  exportData: () => BackupData
  importData: (data: BackupData) => void
  resetAll: () => void
}

function blankDocument(type: DocType, s: Settings, docs: Document[], customerId = ''): Document {
  const date = today()
  const dueDays = type === 'quotation' ? s.quotationValidDays : s.defaultDueDays
  const hasDue = type === 'quotation' || type === 'invoice' || type === 'proforma' || type === 'purchase_order'
  const isCredit = type === 'credit_note'
  return {
    id: uid(),
    type,
    number: nextDocNumber(type, s.prefixes[type], date, docs),
    customerId,
    date,
    dueDate: hasDue ? addDays(date, dueDays) : '',
    reference: '',
    items:
      type === 'receipt'
        ? []
        : [{ id: uid(), description: '', qty: 1, unit: type === 'service_report' ? 'pcs' : 'unit', unitPrice: 0 }],
    discount: 0,
    taxRate: s.defaultTaxRate,
    notes: '',
    terms: s.defaultTerms[type] ?? '',
    status: type === 'receipt' ? 'completed' : isCredit ? 'issued' : 'draft',
    amountPaid: type === 'receipt' ? 0 : undefined,
    refundAmount: isCredit ? 0 : undefined,
    refundDate: isCredit ? date : undefined,
    paymentMethod: type === 'receipt' || isCredit ? 'bank_transfer' : undefined,
    paymentRef: type === 'receipt' || isCredit ? '' : undefined,
    service:
      type === 'service_report'
        ? {
            technician: '',
            location: '',
            equipment: '',
            serialNo: '',
            timeIn: '',
            timeOut: '',
            problem: '',
            workDone: '',
            recommendation: '',
            acknowledgedBy: '',
          }
        : undefined,
    createdAt: now(),
    updatedAt: now(),
  }
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      customers: [],
      documents: [],
      transactions: [],
      settings: defaultSettings,

      saveCustomer: (c) =>
        set((st) => {
          const exists = st.customers.some((x) => x.id === c.id)
          return {
            customers: exists ? st.customers.map((x) => (x.id === c.id ? c : x)) : [c, ...st.customers],
          }
        }),
      deleteCustomer: (id) => set((st) => ({ customers: st.customers.filter((c) => c.id !== id) })),

      newDocument: (type, customerId) => blankDocument(type, get().settings, get().documents, customerId),

      saveDocument: (d) => {
        const saved = { ...d, updatedAt: now() }
        set((st) => {
          const exists = st.documents.some((x) => x.id === d.id)
          let documents = exists ? st.documents.map((x) => (x.id === d.id ? saved : x)) : [saved, ...st.documents]
          if (!exists) {
            // Follow-on documents move their source along the workflow.
            documents = documents.map((x) => {
              if (saved.type === 'receipt' && x.id === saved.invoiceId && x.status === 'draft') {
                return { ...x, status: 'sent', updatedAt: now() }
              }
              if (x.id === saved.sourceId && x.type === 'quotation' && (x.status === 'draft' || x.status === 'sent')) {
                return { ...x, status: 'accepted', updatedAt: now() }
              }
              return x
            })
          }
          return { documents }
        })
        return saved
      },
      deleteDocument: (id) =>
        set((st) => ({
          documents: st.documents
            .filter((d) => d.id !== id)
            // Unlink anything that pointed at the deleted document.
            .map((d) => (d.sourceId === id ? { ...d, sourceId: undefined } : d))
            .map((d) => (d.invoiceId === id ? { ...d, invoiceId: undefined } : d)),
        })),

      convertDocument: (id, to) => {
        const src = get().documents.find((d) => d.id === id)
        if (!src) throw new Error('Document not found')
        const base = blankDocument(to, get().settings, get().documents, src.customerId)
        return {
          ...base,
          sourceId: src.id,
          reference: src.number,
          items: src.items.map((i) => ({ ...i, id: uid() })),
          discount: src.discount,
          taxRate: src.taxRate,
          itemAdjustments: src.itemAdjustments,
          notes: src.notes,
        }
      },

      receiptForInvoice: (invoiceId) => {
        const docs = get().documents
        const inv = docs.find((d) => d.id === invoiceId)
        if (!inv) throw new Error('Invoice not found')
        const base = blankDocument('receipt', get().settings, docs, inv.customerId)
        return {
          ...base,
          invoiceId: inv.id,
          sourceId: inv.id,
          reference: inv.number,
          amountPaid: invoiceBalance(inv, docs),
          notes: `Payment for ${inv.number}`,
        }
      },

      creditNoteForInvoice: (invoiceId) => {
        const docs = get().documents
        const inv = docs.find((d) => d.id === invoiceId)
        if (!inv) throw new Error('Invoice not found')
        const base = blankDocument('credit_note', get().settings, docs, inv.customerId)
        return {
          ...base,
          invoiceId: inv.id,
          sourceId: inv.id,
          reference: inv.number,
          items: inv.items.map((i) => ({ ...i, id: uid() })),
          taxRate: inv.taxRate,
          itemAdjustments: inv.itemAdjustments,
          notes: `Credit for invoice ${inv.number}`,
        }
      },

      saveTransaction: (t) =>
        set((st) => {
          const exists = st.transactions.some((x) => x.id === t.id)
          return {
            transactions: exists ? st.transactions.map((x) => (x.id === t.id ? t : x)) : [t, ...st.transactions],
          }
        }),
      deleteTransaction: (id) => set((st) => ({ transactions: st.transactions.filter((t) => t.id !== id) })),

      updateSettings: (s) => set((st) => ({ settings: { ...st.settings, ...s } })),

      exportData: () => {
        const { customers, documents, transactions, settings } = get()
        return { version: 1, exportedAt: now(), customers, documents, transactions, settings }
      },
      importData: (data) => {
        if (!data || !Array.isArray(data.customers) || !Array.isArray(data.documents)) {
          throw new Error('This file is not a valid MA Legacy backup.')
        }
        set({
          customers: data.customers,
          documents: data.documents,
          transactions: Array.isArray(data.transactions) ? data.transactions : [],
          settings: normalizeSettings(data.settings),
        })
      },
      resetAll: () => set({ customers: [], documents: [], transactions: [], settings: defaultSettings }),
    }),
    {
      name: 'ma-legacy-data',
      version: 1,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>
        return {
          ...current,
          ...p,
          settings: normalizeSettings(p.settings),
        }
      },
    },
  ),
)

export function useCustomer(id: string | undefined) {
  return useStore((s) => s.customers.find((c) => c.id === id))
}

export const contactKind = (c: Customer | undefined) => c?.kind ?? 'customer'

export function customerLabel(c: Customer | undefined): string {
  if (!c) return '—'
  return c.company || c.name
}
