import {
  ArrowLeftRight,
  BarChart3,
  ClipboardCheck,
  FileCheck2,
  FileMinus,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  ReceiptText,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import { DOC_META, type DocType } from '../lib/types'

export const DOC_ICON: Record<DocType, LucideIcon> = {
  quotation: FileText,
  proforma: FileSpreadsheet,
  invoice: FileCheck2,
  delivery_order: Truck,
  receipt: ReceiptText,
  credit_note: FileMinus,
  service_report: ClipboardCheck,
  purchase_order: ShoppingCart,
}

/** One line on what each document is for (Create sheet, search). */
export const DOC_HINT: Record<DocType, string> = {
  quotation: 'Price offer to a customer',
  proforma: 'Ask for payment up front',
  invoice: 'Bill a customer',
  delivery_order: 'Goods sent, signed on receipt',
  receipt: 'Record money received',
  credit_note: 'Reduce or refund an invoice',
  service_report: 'Work done on site',
  purchase_order: 'Order from a supplier',
}

export type NavCount = 'quotations' | 'invoices'
export interface NavLinkItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  /** Badge with a live count. */
  count?: NavCount
}
export type NavItem = NavLinkItem | { section: string }

const doc = (t: DocType, count?: NavCount): NavLinkItem => ({ to: `/d/${DOC_META[t].path}`, label: DOC_META[t].plural, icon: DOC_ICON[t], count })

export const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/suppliers', label: 'Suppliers', icon: Warehouse },
  { section: 'Sales' },
  doc('quotation', 'quotations'),
  doc('proforma'),
  doc('invoice', 'invoices'),
  doc('delivery_order'),
  doc('receipt'),
  doc('credit_note'),
  doc('service_report'),
  { section: 'Purchases' },
  doc('purchase_order'),
  { section: 'Finance' },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
