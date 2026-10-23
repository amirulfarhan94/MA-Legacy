# Feature Spec: Split Payment (3×) for Electrical Work

Business: MA Legacy Solutions (SSM-registered sole proprietorship, Selangor).
Goal: let customers pay for electrical jobs in three interest-free payments, and let the app
produce the invoice schedule, the agreement, per-payment receipts and payment reminders.

## 1. Business rules

| Rule | Value |
| --- | --- |
| Number of payments | 3 |
| Split | Payment 1 = 40% (deposit), Payment 2 = 30%, Payment 3 = 30% |
| Job value allowed | RM300.00 minimum, RM1,500.00 maximum |
| Interest / fees | None. No late fee, no admin fee, no price increase for using the plan |
| Payment 1 due | Before work starts (work is only scheduled after it is paid) |
| Payment 2 due | 1 month after Payment 1 date |
| Payment 3 due | 2 months after Payment 1 date |
| Due-date rule | Same day of month as Payment 1; if that day does not exist, use the last day of that month (e.g. 31 Jan → 28/29 Feb → 31 Mar) |
| Rounding | Payments 1 and 2 rounded to the nearest RM1.00; Payment 3 = total − P1 − P2 |
| Active plans per customer | 1 at a time |
| Max active plans overall | Configurable setting, default 5 |
| Late payment | More than 7 days overdue → plan can be flagged "Overdue"; business may request the full balance |
| Early settlement | Allowed at any time, no charge |
| Warranty | Workmanship warranty valid only after all 3 payments are received |
| Cancellation before work | Refund Payment 1 less materials already bought |

Worked example: total RM1,200 → RM480 + RM360 + RM360.
Rounding example: total RM1,050 → P1 = RM420, P2 = RM315, P3 = RM315.
Rounding example: total RM999 → P1 = RM400 (399.60 rounded), P2 = RM300 (299.70 rounded), P3 = RM299.

## 2. Data to store (adapt to the app's existing storage; do not add a new backend)

**Split plan**
- Agreement no. (format `MAL-SP-YYYY-NNN`, running number per year)
- Linked quotation no. and invoice no.
- Customer: full name, IC no., phone, email, premises address
- Description of work, planned work date
- Total job value
- Plan status: `Active`, `Completed`, `Overdue`, `Cancelled`
- Created date, Payment 1 date

**Plan payments (3 per plan)**
- Sequence (1, 2, 3), percentage, amount, due date
- Status: `Pending`, `Paid`, `Overdue`
- Paid date, payment method, reference, receipt no.

## 3. Screens and behaviour

1. **Invoice editor:** a "Split payment (3×)" toggle.
   - Only enabled when total is RM300–RM1,500; show a clear message otherwise.
   - Block it if the customer already has an active plan, or the max active plans is reached.
   - When on, auto-calculate the 3 amounts and due dates from the Payment 1 date.
2. **Record payment:** mark a payment as paid (date, method, reference).
   - Generates a receipt for that payment and updates the invoice balance.
   - When Payment 3 is paid, plan becomes `Completed`.
   - Allow "Settle remaining balance" in one go (early settlement).
3. **Upcoming payments list / dashboard card:** payments due in the next 7 days and all overdue ones,
   with customer, amount, due date and a "Copy WhatsApp reminder" button.
4. **Agreement:** generate the Split Payment Agreement (section 5) from the plan data, printable as PDF.
5. Mark a payment `Overdue` automatically when today is past its due date and it is unpaid.

## 4. Invoice print layout

Keep the existing MA Legacy invoice design (black and gold). When split payment is on, add a
"Payment Schedule" box under the totals:

| Payment | Share | Amount (RM) | Due date | Status |
| --- | --- | --- | --- | --- |
| Payment 1 (deposit) | 40% | … | dd/mm/yyyy, before work | ☐ Paid |
| Payment 2 | 30% | … | dd/mm/yyyy, +1 month | ☐ Paid |
| Payment 3 | 30% | … | dd/mm/yyyy, +2 months | ☐ Paid |

- Header badge on the invoice: `SPLIT PAYMENT · 3×`
- Show the agreement no. in the invoice details.
- Line under the box: "0% interest · no extra charges. Work starts after Payment 1 is received.
  Workmanship warranty is valid once all payments are complete."
- Payment details always show "Account name: MA Legacy Solutions" + bank + account no. + invoice no. as reference.

## 5. Agreement template (English)

Title: **Split Payment Agreement** · Agreement No.: MAL-SP-YYYY-NNN · Date

**Parties:** Service Provider = MA Legacy Solutions (SSM no., address, phone, email);
Customer = full name as per IC, IC no., premises address, phone, email.

**Scope of Work:** quotation no., description of work, site address, total job value (max RM1,500.00),
planned work date. "Any work outside this scope will be quoted separately and is not covered by this
split payment plan."

**Payment Schedule:** the 40/30/30 table with amounts and due dates, the rounding sentence, and payment
details (Account name: MA Legacy Solutions, bank, account no., reference = agreement no.).
"Please send the payment slip via WhatsApp. A receipt will be issued for each payment."

**Terms and Conditions:**
1. Eligibility. Electrical work with a total value between RM300 and RM1,500. One active plan per customer.
2. No interest or fees. The Customer pays only the total job value. No interest, late fee or administration charge applies.
3. Due dates. Payments 2 and 3 fall on the same day of the month as Payment 1. If that day does not exist in a month, the due date is the last day of that month.
4. Reminders. A WhatsApp reminder is sent about 3 days before each due date.
5. Late payment. If a payment is more than 7 days late, MA Legacy Solutions may ask for the full remaining balance to be paid at once.
6. Warranty. The workmanship warranty starts from the work completion date and is valid only after all three payments are received in full.
7. Materials. Materials supplied remain the property of MA Legacy Solutions until full payment is received.
8. Early settlement. The Customer may pay the remaining balance at any time without any charge.
9. Cancellation. If the Customer cancels before work starts, Payment 1 is refunded less the cost of any materials already purchased for the job.
10. Records. A receipt will be issued for every payment received.

**Declaration and Signatures:** "I confirm that I have read and understood the payment schedule and terms
above, and I agree to pay the full job value according to this schedule." Signature, name, IC no. /
position and date for Customer and for MA Legacy Solutions; company stamp; "A copy of the Customer's IC
is attached to this agreement."

## 6. WhatsApp reminder template (Bahasa Malaysia, copied to clipboard)

```
Salam {nama}, ini peringatan mesra daripada MA Legacy Solutions.

Bayaran ke-{n} sebanyak RM{amaun} untuk invois {no_invois} akan jatuh tempo pada {tarikh}.

Akaun: MA Legacy Solutions
Bank: {bank}
No. akaun: {no_akaun}
Rujukan: {no_invois}

Sila hantar slip bayaran di sini selepas membuat bayaran. Terima kasih!
```

## 7. Acceptance checks

- RM1,200 plan → 480 / 360 / 360, dates +1 and +2 months.
- RM1,050 → 420 / 315 / 315. RM999 → 400 / 300 / 299 (sum = total).
- Payment 1 on 31 Jan 2027 → Payment 2 on 28 Feb 2027, Payment 3 on 31 Mar 2027.
- RM299 and RM1,501 cannot use split payment.
- A customer with an active plan cannot start a second one.
- Recording all 3 payments marks the plan Completed and produces 3 receipts.
- Normal (non-split) invoices look and behave exactly as before.
