export type DocType = 'quotation' | 'proforma' | 'invoice' | 'receipt' | 'service_report'

export const DOC_TYPES: DocType[] = ['quotation', 'proforma', 'invoice', 'receipt', 'service_report']

export const DOC_META: Record<DocType, { label: string; plural: string; title: string; path: string }> = {
  quotation: { label: 'Quotation', plural: 'Quotations', title: 'QUOTATION', path: 'quotations' },
  proforma: { label: 'Proforma Invoice', plural: 'Proforma Invoices', title: 'PROFORMA INVOICE', path: 'proforma' },
  invoice: { label: 'Invoice', plural: 'Invoices', title: 'INVOICE', path: 'invoices' },
  receipt: { label: 'Receipt', plural: 'Receipts', title: 'OFFICIAL RECEIPT', path: 'receipts' },
  service_report: { label: 'Service Report', plural: 'Service Reports', title: 'SERVICE REPORT', path: 'service-reports' },
}

export function docTypeFromPath(path: string | undefined): DocType | undefined {
  return DOC_TYPES.find((t) => DOC_META[t].path === path)
}

export interface Customer {
  id: string
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

export const STATUS_OPTIONS: Record<DocType, DocStatus[]> = {
  quotation: ['draft', 'sent', 'accepted', 'rejected', 'cancelled'],
  proforma: ['draft', 'sent', 'accepted', 'cancelled'],
  // Invoice payment status (unpaid/partial/paid) is derived from receipts;
  // only draft/sent/cancelled are set by hand.
  invoice: ['draft', 'sent', 'cancelled'],
  receipt: ['completed', 'cancelled'],
  service_report: ['draft', 'completed', 'cancelled'],
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
  /** Quotation: valid until. Invoice/proforma: payment due date. */
  dueDate: string
  reference: string
  items: LineItem[]
  discount: number
  taxRate: number
  notes: string
  terms: string
  status: DocStatus
  /** The document this one was converted from (e.g. invoice ← quotation). */
  sourceId?: string
  /** Receipts only. */
  invoiceId?: string
  amountPaid?: number
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
}
