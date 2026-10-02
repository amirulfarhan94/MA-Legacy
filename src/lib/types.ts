export type DocType =
  | 'quotation'
  | 'proforma'
  | 'invoice'
  | 'delivery_order'
  | 'receipt'
  | 'credit_note'
  | 'service_report'
  | 'purchase_order'

export const DOC_TYPES: DocType[] = [
  'quotation',
  'proforma',
  'invoice',
  'delivery_order',
  'receipt',
  'credit_note',
  'service_report',
  'purchase_order',
]

/** Documents issued to suppliers rather than customers. */
export const isPurchaseDoc = (t: DocType) => t === 'purchase_order'
/** Documents that carry prices and totals. */
export const isPricedDoc = (t: DocType) => t !== 'receipt' && t !== 'service_report' && t !== 'delivery_order'

export const DOC_META: Record<DocType, { label: string; plural: string; title: string; path: string }> = {
  quotation: { label: 'Quotation', plural: 'Quotations', title: 'QUOTATION', path: 'quotations' },
  proforma: { label: 'Proforma Invoice', plural: 'Proforma Invoices', title: 'PROFORMA INVOICE', path: 'proforma' },
  invoice: { label: 'Invoice', plural: 'Invoices', title: 'INVOICE', path: 'invoices' },
  receipt: { label: 'Receipt', plural: 'Receipts', title: 'OFFICIAL RECEIPT', path: 'receipts' },
  service_report: { label: 'Service Report', plural: 'Service Reports', title: 'SERVICE REPORT', path: 'service-reports' },
  delivery_order: { label: 'Delivery Order', plural: 'Delivery Orders', title: 'DELIVERY ORDER', path: 'delivery-orders' },
  credit_note: { label: 'Credit Note', plural: 'Credit Notes', title: 'CREDIT NOTE', path: 'credit-notes' },
  purchase_order: { label: 'Purchase Order', plural: 'Purchase Orders', title: 'PURCHASE ORDER', path: 'purchase-orders' },
}

export function docTypeFromPath(path: string | undefined): DocType | undefined {
  return DOC_TYPES.find((t) => DOC_META[t].path === path)
}

export type ContactKind = 'customer' | 'supplier'

export interface Customer {
  id: string
  /** Missing on records created before suppliers existed: treat as customer. */
  kind?: ContactKind
  name: string
  company: string
  regNo: string
  email: string
  phone: string
  address: string
  notes: string
  createdAt: string
}

export interface LineItem {
  id: string
  description: string
  qty: number
  unit: string
  unitPrice: number
  /** Line discount in percent; only applied when the document has itemAdjustments on. */
  discountPct?: number
  /** Line tax rate in percent; only applied when the document has itemAdjustments on. */
  taxRate?: number
}

export type DocStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'rejected'
  | 'unpaid'
  | 'partial'
  | 'paid'
  | 'cancelled'
  | 'completed'
  | 'issued'
  | 'delivered'
  | 'received'

export const STATUS_OPTIONS: Record<DocType, DocStatus[]> = {
  quotation: ['draft', 'sent', 'accepted', 'rejected', 'cancelled'],
  proforma: ['draft', 'sent', 'accepted', 'cancelled'],
  // Invoice payment status (unpaid/partial/paid) is derived from receipts;
  // only draft/sent/cancelled are set by hand.
  invoice: ['draft', 'sent', 'cancelled'],
  receipt: ['completed', 'cancelled'],
  service_report: ['draft', 'completed', 'cancelled'],
  delivery_order: ['draft', 'delivered', 'cancelled'],
  credit_note: ['draft', 'issued', 'cancelled'],
  purchase_order: ['draft', 'sent', 'received', 'cancelled'],
}

export type PaymentMethod = 'bank_transfer' | 'cash' | 'cheque' | 'card' | 'ewallet' | 'other'

export const PAYMENT_METHODS: Record<PaymentMethod, string> = {
  bank_transfer: 'Bank Transfer',
  cash: 'Cash',
  cheque: 'Cheque',
  card: 'Card',
  ewallet: 'E-Wallet / DuitNow',
  other: 'Other',
}

export interface ServiceReportFields {
  technician: string
  location: string
  equipment: string
  serialNo: string
  timeIn: string
  timeOut: string
  problem: string
  workDone: string
  recommendation: string
  acknowledgedBy: string
}

export interface Document {
  id: string
  type: DocType
  number: string
  customerId: string
  date: string
  /** Quotation: valid until. Invoice/proforma: payment due date. Purchase order: delivery date. */
  dueDate: string
  reference: string
  items: LineItem[]
  discount: number
  taxRate: number
  /** Per-line discount % and tax rate. Off (undefined) = one tax rate for the whole document. */
  itemAdjustments?: boolean
  /** Delivery orders and purchase orders: where the goods go. */
  deliverTo?: string
  notes: string
  terms: string
  status: DocStatus
  /** The document this one was converted from (e.g. invoice ← quotation). */
  sourceId?: string
  /** Receipts and credit notes: the invoice they apply to. */
  invoiceId?: string
  /** Receipts: money received. */
  amountPaid?: number
  /** Credit notes: money paid back to the customer (0 = credit only). */
  refundAmount?: number
  refundDate?: string
  /** Receipts: how the customer paid. Credit notes: how the refund was paid. */
  paymentMethod?: PaymentMethod
  paymentRef?: string
  service?: ServiceReportFields
  createdAt: string
  updatedAt: string
}

export type TxnKind = 'income' | 'expense'

/** Manual ledger entries. Receipts are also shown as income in Transactions. */
export interface Transaction {
  id: string
  kind: TxnKind
  date: string
  category: string
  description: string
  amount: number
  method: PaymentMethod
  customerId?: string
  reference: string
  /** Document this entry pays for (e.g. a purchase order). */
  docId?: string
  createdAt: string
}

export interface Settings {
  companyName: string
  regNo: string
  sstNo: string
  address: string
  phone: string
  email: string
  website: string
  bankName: string
  bankAccountName: string
  bankAccountNo: string
  currency: string
  defaultTaxRate: number
  taxLabel: string
  prefixes: Record<DocType, string>
  defaultTerms: Record<DocType, string>
  defaultDueDays: number
  quotationValidDays: number
  logoDataUrl: string
  /** DuitNow / bank QR image shown on invoices and proforma invoices. */
  paymentQrDataUrl: string
  paymentQrLabel: string
}
