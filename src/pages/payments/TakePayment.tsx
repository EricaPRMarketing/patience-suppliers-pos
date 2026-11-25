import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { SalesDoc } from '../../db/db';
import { useCurrentUser } from '../../auth/AuthContext';
import { formatNgwee } from '../../lib/format';
import { parseKwacha } from '../../lib/money';
import {
  getPaymentAccounts,
  METHOD_LABEL,
  openBalance,
  payQuote,
  recordPayment,
  saveProofOfPayment,
  usableAccounts,
  type Method,
} from '../../lib/payments';

/** Take payment for an invoice, or for a quotation (which is invoiced first). */
export function TakePayment({ doc, onDone, onCancel }: { doc: SalesDoc; onDone: (invoice: SalesDoc, message: string) => void; onCancel?: () => void }) {
  const user = useCurrentUser();
  const accounts = useLiveQuery(async () => usableAccounts(await getPaymentAccounts()), []);
  const due = doc.kind === 'quote' ? doc.totalNgwee : openBalance(doc);
  const [method, setMethod] = useState<Method>('cash');
  const [amount, setAmount] = useState((due / 100).toFixed(2));
  const [channel, setChannel] = useState('');
  const [payer, setPayer] = useState(doc.customer.phone);
  const [reference, setReference] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const options = method === 'mobile_money' ? accounts?.mobileMoney ?? [] : accounts?.bank ?? [];
  const noAccounts = method !== 'cash' && accounts && options.length === 0;
  const selected =
    method === 'mobile_money'
      ? accounts?.mobileMoney.find((m) => m.network === channel)
      : accounts?.bank.find((b) => b.bank === channel);

  function pick(m: Method) {
    setMethod(m);
    setError('');
    const first = m === 'mobile_money' ? accounts?.mobileMoney[0]?.network : m === 'bank' ? accounts?.bank[0]?.bank : '';
    setChannel(first ?? '');
  }

  async function submit() {
    setError('');
    setBusy(true);
    try {
      const popFileId = method !== 'cash' && file ? await saveProofOfPayment(user, file) : undefined;
      const input = { method, amountNgwee: parseKwacha(amount) ?? NaN, channel, payer, reference, popFileId };
      const invoice = doc.kind === 'quote' ? await payQuote(user, doc.id, input) : (await recordPayment(user, doc.id, input), doc);
      onDone(
        invoice,
        method === 'cash'
          ? `${formatNgwee(input.amountNgwee)} cash received on ${invoice.number}.`
          : `${formatNgwee(input.amountNgwee)} ${METHOD_LABEL[method].toLowerCase()} on ${invoice.number} sent to a manager to check against the ${method === 'bank' ? 'bank statement' : 'mobile money account'}.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not record the payment.');
      setBusy(false);
    }
  }

  return (
    <div className="take-payment">
      <div className="method-picker" role="radiogroup" aria-label="How is the customer paying?">
        {(['cash', 'mobile_money', 'bank'] as Method[]).map((m) => (
          <button key={m} type="button" role="radio" aria-checked={method === m} className={method === m ? 'method active' : 'method ghost'} onClick={() => pick(m)}>
            <span className="method-icon" aria-hidden="true">
              {m === 'cash' ? 'K' : m === 'mobile_money' ? '📱' : '🏦'}
            </span>
            {METHOD_LABEL[m]}
          </button>
        ))}
      </div>

      {noAccounts && (
        <p className="notice warn-notice">
          The owner has not added the company's {method === 'bank' ? 'bank account' : 'mobile money numbers'} yet. They do this on the Payments page.
        </p>
      )}

      {method !== 'cash' && !noAccounts && (
        <>
          <label>
            {method === 'bank' ? 'Bank the customer paid into' : 'Network'}
            <select value={channel} onChange={(e) => setChannel(e.target.value)}>
              {options.map((o) => {
                const name = 'network' in o ? o.network : o.bank;
                return <option key={name}>{name}</option>;
              })}
            </select>
          </label>
          {selected && (
            <div className="pay-to">
              <p className="pay-to-title">Ask the customer to send {formatNgwee(parseKwacha(amount) ?? 0)} to:</p>
              {'network' in selected ? (
                <dl>
                  <dt>{selected.network} number</dt>
                  <dd className="big">{selected.number}</dd>
                  <dt>Name on the account</dt>
                  <dd>{selected.accountName}</dd>
                </dl>
              ) : (
                <dl>
                  <dt>Bank</dt>
                  <dd>
                    {selected.bank}
                    {selected.branch && `, ${selected.branch} branch`}
                  </dd>
                  <dt>Account name</dt>
                  <dd>{selected.accountName}</dd>
                  <dt>Account number</dt>
                  <dd className="big">{selected.accountNumber}</dd>
                  {selected.branchCode && (
                    <>
                      <dt>Branch code</dt>
                      <dd>{selected.branchCode}</dd>
                    </>
                  )}
                  {selected.swift && (
                    <>
                      <dt>SWIFT</dt>
                      <dd>{selected.swift}</dd>
                    </>
                  )}
                </dl>
              )}
              <p className="muted small">Reference for the customer to use: {doc.kind === 'invoice' ? doc.number : `${doc.number} (it becomes an invoice)`}</p>
            </div>
          )}
        </>
      )}

      {!noAccounts && (
        <div className="form-grid">
          <label>
            Amount received (K)
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
          </label>
          {method !== 'cash' && (
            <>
              <label>
                {method === 'bank' ? 'Bank reference' : 'Transaction ID from the SMS'}
                <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={method === 'bank' ? 'e.g. FT2633012345' : 'e.g. MP261125.1530.A12345'} />
              </label>
              <label>
                {method === 'bank' ? 'Paid from (account or name)' : 'Paid from (phone number)'}
                <input value={payer} onChange={(e) => setPayer(e.target.value)} inputMode={method === 'bank' ? 'text' : 'tel'} />
              </label>
              <label className="span-all">
                Proof of payment (photo, screenshot or PDF)
                <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            </>
          )}
          <p className="muted small span-all">
            Still owed: {formatNgwee(due)}.
            {method !== 'cash' && ' A manager or the owner confirms it once the money shows in the company account.'}
          </p>
        </div>
      )}

      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        {onCancel && (
          <button type="button" className="ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="button" onClick={submit} disabled={busy || !!noAccounts || due <= 0}>
          {busy ? 'Saving…' : method === 'cash' ? 'Record cash payment' : 'Send for checking'}
        </button>
      </div>
    </div>
  );
}
