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

Every record carries `id`, `createdAt`, `updatedAt` and `syncState` so it can be synced to a cloud database later. Until cloud sync is added, data stays on the device it was entered on.

## Plan

1. Foundation, logins and offline mode (this step)
2. Inventory section with Excel/CSV upload
3. Quotations and invoices on the company letterhead
4. Payments (manual mobile money/bank with proof of payment, then a payment gateway), cloud sync and hosting

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests
npm run build    # production build in dist/
```
