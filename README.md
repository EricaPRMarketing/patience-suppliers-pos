# Patience Suppliers POS

Point-of-sale web app for Patience Suppliers (Z) Ltd, Siavonga. Prices are in Kwacha with no VAT.

## What works now (step 1)

- **Installable, offline-first web app.** All data is stored on the device (IndexedDB), and the app shell is cached by a service worker, so it opens and works with no internet.
- **Three roles**
  - *Owner*: everything, including creating managers and staff and seeing every action.
  - *Manager*: selling, stock and prices, payment confirmation, and can create staff accounts and see staff activity.
  - *Staff*: sales, quotations and invoices, and can view stock.
- **Activity log** of sign-ins, failed sign-ins, account changes and (in later steps) every sale, quote, invoice and payment.
- First launch asks for the owner account.

## Inventory (step 2)

- Items with code, name, category, unit, selling price in Kwacha (stored in ngwee), optional buying price, quantity and low-stock level.
- Staff can view stock. Managers and the owner can add, edit, archive, adjust stock and upload a stock list.
- Upload from Excel (.xlsx) or CSV. Column headings are matched flexibly (for example "Item code", "Description", "Unit price", "Qty"). Rows with problems are listed with their spreadsheet row number and skipped; existing items are matched by code, or by name when there is no code. Columns missing from the file leave existing values unchanged.
- Every quantity change is recorded as a stock movement with who, when and why. Price changes are written to the activity log with old and new price.
- "Load sample items" adds 20 made-up items for testing.

## Quotations, invoices and sales (step 3)

- Quotations (Q-YYYY-0001) and invoices (INV-YYYY-0001) numbered in sequence; numbers are never reused, so a missing number is flagged to the owner.
- Prices always come from inventory. Only managers and the owner can give line or whole-document discounts; discounts of 10%+ raise an owner alert.
- A quotation can be edited while draft or sent, marked sent or accepted, cancelled, or turned into an invoice in one click.
- Issuing an invoice takes the stock out and refuses to sell more than is in stock. Voiding (managers and owner, with a reason) puts the stock back and alerts the owner.
- Cash payments can be recorded against an invoice (paid, part paid, unpaid). The Sales page is a quick till for cash sales.
- Every document prints on the Patience Suppliers letterhead on A4; "Save as PDF" in the print window makes the PDF.

## Security

- Passwords: at least 8 characters with letters and numbers, hashed with PBKDF2 (210,000 rounds). Accounts lock for 15 minutes after 5 wrong passwords; the owner or a manager can unlock them sooner. Everyone is signed out after 15 minutes without activity.
- Role separation is enforced in the data functions, not only by hiding menu items. The Users page shows a table of what each role can do.
- The activity log is a hash chain: every entry stores a SHA-256 of itself and the entry before it. The owner's Security page re-checks the chain and reports edited, deleted or truncated entries.
- Unusual-activity alerts for the owner: account lockouts, blocked sign-ins, large or repeated stock removals, uploads that lower stock, big price cuts, prices lowered then put back, out-of-hours activity, and stock quantities that no longer match their own history.
- Limits: until cloud sync is added, all data lives on the device. Someone with full control of the device could delete the whole database; the checks above detect partial edits but not a full wipe. Cloud sync will keep a copy staff cannot reach.

Every record carries `id`, `createdAt`, `updatedAt` and `syncState` so it can be synced to a cloud database later. Until cloud sync is added, data stays on the device it was entered on.

## Plan

1. Foundation, logins and offline mode (done)
2. Inventory section with Excel/CSV upload (done)
3. Quotations and invoices on the company letterhead (done)
4. Payments (manual mobile money/bank with proof of payment, then a payment gateway), cloud sync and hosting

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests
npm run build    # production build in dist/
```
