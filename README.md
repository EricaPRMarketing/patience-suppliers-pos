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

Every record carries `id`, `createdAt`, `updatedAt` and `syncState` so it can be synced to a cloud database later. Until cloud sync is added, data stays on the device it was entered on.

## Plan

1. Foundation, logins and offline mode (done)
2. Inventory section with Excel/CSV upload (done)
3. Quotations and invoices on the company letterhead
4. Payments (manual mobile money/bank with proof of payment, then a payment gateway), cloud sync and hosting

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests
npm run build    # production build in dist/
```
