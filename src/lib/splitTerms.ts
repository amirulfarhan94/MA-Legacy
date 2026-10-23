import { SPLIT_MAX, SPLIT_MIN } from './split'

/** Terms and conditions of a split payment agreement (spec section 5), shown to the customer and printed. */
export const SPLIT_TERMS: [string, string][] = [
  ['Eligibility', `Electrical work with a total value between RM${SPLIT_MIN} and RM${SPLIT_MAX.toLocaleString('en-MY')}. One active plan per customer.`],
  ['No interest or fees', 'The Customer pays only the total job value. No interest, late fee or administration charge applies.'],
  ['Due dates', 'Payments 2 and 3 fall on the same day of the month as Payment 1. If that day does not exist in a month, the due date is the last day of that month.'],
  ['Reminders', 'A WhatsApp reminder is sent about 3 days before each due date.'],
  ['Late payment', 'If a payment is more than 7 days late, MA Legacy Solutions may ask for the full remaining balance to be paid at once.'],
  ['Warranty', 'The workmanship warranty starts from the work completion date and is valid only after all three payments are received in full.'],
  ['Materials', 'Materials supplied remain the property of MA Legacy Solutions until full payment is received.'],
  ['Early settlement', 'The Customer may pay the remaining balance at any time without any charge.'],
  ['Cancellation', 'If the Customer cancels before work starts, Payment 1 is refunded less the cost of any materials already purchased for the job.'],
  ['Records', 'A receipt will be issued for every payment received.'],
]
