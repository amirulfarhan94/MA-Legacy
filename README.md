# MA Legacy Solutions — Business Documents

Web app for MA Legacy Solutions to issue and track:

- **Quotations** → convert to proforma invoice or invoice in one click
- **Proforma invoices**
- **Invoices** — paid / partial / overdue status is worked out automatically from receipts
- **Official receipts** — "Record payment" on an invoice pre-fills the outstanding balance
- **Service reports** — technician, site, equipment, problem, work done, parts used, customer acknowledgement
- **Delivery orders** — from a quotation, proforma or invoice; quantities only, with a delivery address
- **Credit notes** — issued against an invoice to lower its balance, with an optional refund (shown as money out)
- **Purchase orders** — to suppliers; "Record payment" logs the expense against the PO

Any priced document can switch on **discount % and SST per item**; the document-level discount is spread across
lines before tax, and the totals show tax per rate. Upload a **DuitNow / bank QR** in Settings to print it on
invoices, proforma invoices and statements.

Plus a **dashboard** (a greeting that follows the time of day — set your name in Settings — quick create buttons with
the next document number, collected this month, outstanding, open quotations, net for the year, and a money-collected
chart for 12 months, this year or 90 days), **search** (Ctrl K / ⌘K or the search bar: documents, customers, suppliers,
pages and "new …" shortcuts),
**transactions** (receipts, refunds and manual income/expense entries, date filters, CSV export), **customer and
supplier records** (every document per contact, billed / paid / outstanding), a printable **statement of account** per
customer (running balance and aging), **reports** (outstanding invoices by age, monthly profit & loss, expenses by
category) with **Export for accountant** — one Excel file for a chosen period with tabs for the summary, sales
invoices, credit notes, money in, expenses and SST by month — and an **items catalog**: products and services with their
usual price, suggested (with items from earlier quotations and invoices) as you type a line; "Save to catalog" under a
line adds it.

Every document prints on A4 with the company logo, amount in words (Ringgit Malaysia), bank details and signature
blocks. Use **Print / PDF** and choose "Save as PDF" to get a PDF file. **Share PDF** (documents and statements)
makes the PDF in the app and opens the phone's share sheet, so it goes to a customer on WhatsApp as an attachment with
a ready-written message; on a computer it downloads instead. Customers with a phone number also get a **WhatsApp**
button that opens their chat with that message. Sharing a draft this way (Share PDF or WhatsApp) marks it **Sent**.
Unpaid invoices get a **Remind** button: the invoice PDF with a polite reminder (how many days late, balance due, bank
details) goes out through the share sheet — on a computer the PDF downloads and the customer's WhatsApp chat opens with
the message — and the invoice keeps a count of reminders sent.

Pick the look of printed documents under **Settings → Document style**: **Engineering** (the default — a title
block, mono figures, and page numbers with a running header on long documents) or **Classic** (the original look).
Both styles' fonts ship with the app, so they print the same offline. Page numbers need a recent Chrome or Edge (131+).

**Split payment (3×)** — see `docs/split-payment-spec.md`. An invoice of RM300–RM1,500 can be paid in three
interest-free payments (40% deposit, then 30% and 30% one and two months later; same day of the month, or the month's
last day). Turn it on in the invoice editor: it is refused below or above the range, when the customer already has an
active plan, or when the "Max active split payment plans" limit in Settings is reached. The plan (agreement no.
MAL-SP-YYYY-NNN, customer's name as per IC, IC no., site, work, dates) is saved on the invoice itself. On the invoice
page, **Record** each payment (a receipt is made and the balance goes down; if Payment 1 is paid on another day the app
offers to move Payments 2 and 3 to follow it), or **Settle remaining balance** at once. Payment and plan statuses
(Pending / Paid / Overdue; Active / Completed / Overdue / Cancelled) are worked out from the receipts and today's date.
The printed invoice gets a SPLIT PAYMENT · 3× badge, the agreement no. and a payment schedule; **Agreement** prints the
Split Payment Agreement. The dashboard and **Split plans** list payments due in the next 7 days and overdue ones, with
**Copy WhatsApp reminder** (Bahasa Malaysia). While a plan is active and the last backup is over 7 days old, a banner
asks for a backup, since plans hold IC numbers and money owed.

Invoices, service reports and quotations can carry **work photos** (site photos on a quotation): add them from the
camera or gallery in the editor, with a caption each. They print, and go into **Share PDF**, as report pages after the
document, four photos to a page. Photos are scaled down and kept on this device only (in the browser's storage, not
synced); backups include them, so restoring a backup on another device brings them along. Converting a service report
to an invoice carries its photos over.

## Install as an app (PWA)

The app is a Progressive Web App: it installs to the home screen / desktop, opens full-screen without the
browser bar, and keeps working **offline** after the first visit.

- **Android / Chrome / Edge:** tap **Install app** in the menu (or the install icon in the address bar).
- **iPhone / iPad:** open in Safari → **Share** → **Add to Home Screen**.
- Long-press the icon for shortcuts to a new quotation, invoice or receipt.
- When a new version is deployed, a prompt appears asking you to update — save any open form first.

Installing needs HTTPS (any of the hosts below provide it). The installed app shares the same browser storage,
so the backup advice below still applies.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests for totals, numbering, payment status, amount in words
npm run build    # static site in dist/
```

## First-time setup

1. Open **Settings** and fill in the SSM no., address, phone, bank account, and SST rate (0 if not registered).
2. Add a customer, then create a quotation.
3. Not ready yet? **Settings → Load sample data** fills the app with demo records to explore.

## Where the data lives

Everything is saved in the browser's storage (IndexedDB) on the device you use — no server, no login. Data from
earlier versions, kept in localStorage, moves over by itself. The app asks the browser to protect its storage from
automatic clean-up (Settings → Backup shows whether it is protected and how much is used), warns at once if a save
fails, and if a screen ever crashes it offers a backup and reload instead of a blank page. That means:

- Use the same browser on the same device, or move data with **Settings → Back up now / Restore from backup**.
- Clearing browser data, uninstalling the app or losing the phone deletes the records.
- The app reminds you when the last backup is 7+ days old. **Back up now** opens the phone's share sheet so the file
  can go straight to Google Drive or WhatsApp (on a computer it downloads instead). Restore accepts the `.json` or
  `.txt` file.

## Deploying

The build is a static site (`dist/`) that runs from any static host — Netlify, Vercel, Cloudflare Pages or
GitHub Pages. For GitHub Pages, `.github/workflows/deploy.yml` builds and deploys on every push to `main`;
enable it once under **Settings → Pages → Source: GitHub Actions**.

## Tech

React + TypeScript + Vite, Tailwind CSS, Zustand (persisted to IndexedDB), React Router (hash routes, so it works
on any static host).
