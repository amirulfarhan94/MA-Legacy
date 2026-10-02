# MA Legacy Solutions — Business Documents

Web app for MA Legacy Solutions to issue and track:

- **Quotations** → convert to proforma invoice or invoice in one click
- **Proforma invoices**
- **Invoices** — paid / partial / overdue status is worked out automatically from receipts
- **Official receipts** — "Record payment" on an invoice pre-fills the outstanding balance
- **Service reports** — technician, site, equipment, problem, work done, parts used, customer acknowledgement

Plus a **dashboard** (collected this month, outstanding, open quotations, net for the year, 12-month collection chart),
**transactions** (all receipts + manual income/expense entries, date filters, CSV export) and **customer records**
(contact details, every document per customer, billed / paid / outstanding).

Every document prints on A4 with the company logo, amount in words (Ringgit Malaysia), bank details and signature
blocks. Use **Print / PDF** and choose "Save as PDF" to get a PDF file. Customers with a phone number also get a
**WhatsApp** button.

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

Everything is saved in the browser's local storage on the device you use — no server, no login.
That means:

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

React + TypeScript + Vite, Tailwind CSS, Zustand (persisted to localStorage), React Router (hash routes, so it works
on any static host).
