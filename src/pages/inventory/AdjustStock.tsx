import { useState, type FormEvent } from 'react';
import type { Product, User } from '../../db/db';
import { adjustStock, InventoryError } from '../../lib/inventory';
import { Modal } from '../../components/Modal';

const REASONS = ['New delivery', 'Stock count correction', 'Damaged', 'Returned by customer', 'Returned to supplier'];

export function AdjustStock({
  actor,
  product,
  onClose,
}: {
  actor: User;
  product: Product;
  onClose: (m?: string) => void;
}) {
  const [direction, setDirection] = useState<'add' | 'remove'>('add');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState(REASONS[0]);
  const [error, setError] = useState('');
  const n = Number(amount) || 0;
  const after = product.quantity + (direction === 'add' ? n : -n);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await adjustStock(actor, product.id, direction === 'add' ? n : -n, reason);
      onClose(`${product.name} now has ${after} ${product.unit} in stock.`);
    } catch (err) {
      setError(err instanceof InventoryError ? err.message : 'Could not change the stock.');
    }
  }

  return (
    <Modal title={`Adjust stock: ${product.name}`} onClose={() => onClose()}>
      <form className="form-grid" onSubmit={submit}>
        <div className="segmented span-all" role="radiogroup" aria-label="Add or remove">
          <button type="button" className={direction === 'add' ? 'on' : 'ghost'} onClick={() => setDirection('add')}>
            + Add stock
          </button>
          <button
            type="button"
            className={direction === 'remove' ? 'on' : 'ghost'}
            onClick={() => setDirection('remove')}
          >
            − Remove stock
          </button>
        </div>
        <label>
          How many ({product.unit})
          <input
            type="number"
            min={0}
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            autoFocus
          />
        </label>
        <label>
          Reason
          <select value={reason} onChange={(e) => setReason(e.target.value)}>
            {REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <p className="muted span-all">
          In stock now: <strong>{product.quantity}</strong> · after this change: <strong>{after}</strong>
        </p>
        {error && <p className="error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="ghost" onClick={() => onClose()}>
            Cancel
          </button>
          <button type="submit">Save</button>
        </div>
      </form>
    </Modal>
  );
}
