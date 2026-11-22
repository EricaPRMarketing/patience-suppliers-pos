import { useState, type FormEvent } from 'react';
import type { Product, User } from '../../db/db';
import { can } from '../../auth/permissions';
import { createProduct, InventoryError, updateProduct } from '../../lib/inventory';
import { parseKwacha } from '../../lib/money';
import { Modal } from '../../components/Modal';

const kw = (ngwee: number | null) => (ngwee == null ? '' : (ngwee / 100).toFixed(2));

export function ProductForm({
  actor,
  product,
  categories,
  onClose,
  onArchive,
}: {
  actor: User;
  product?: Product;
  categories: string[];
  onClose: (message?: string) => void;
  onArchive?: () => void;
}) {
  const [code, setCode] = useState(product?.code ?? '');
  const [name, setName] = useState(product?.name ?? '');
  const [category, setCategory] = useState(product?.category ?? '');
  const [unit, setUnit] = useState(product?.unit ?? 'each');
  const [price, setPrice] = useState(kw(product?.priceNgwee ?? null));
  const [cost, setCost] = useState(kw(product?.costNgwee ?? null));
  const [quantity, setQuantity] = useState(String(product?.quantity ?? 0));
  const [reorder, setReorder] = useState(String(product?.reorderLevel ?? 5));
  const [error, setError] = useState('');
  const canPrice = can(actor.role, 'prices.edit') || !product;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const priceNgwee = parseKwacha(price);
    if (priceNgwee === null) return setError('Enter a valid selling price, for example 125.50.');
    const costNgwee = cost.trim() === '' ? null : parseKwacha(cost);
    if (cost.trim() !== '' && costNgwee === null) return setError('Enter a valid buying price.');
    const base = { code, name, category, unit, priceNgwee, costNgwee, reorderLevel: Number(reorder) };
    try {
      if (product) {
        await updateProduct(actor, product.id, base);
        onClose(`${name} saved.`);
      } else {
        await createProduct(actor, { ...base, quantity: Number(quantity) });
        onClose(`${name} added to stock.`);
      }
    } catch (err) {
      setError(err instanceof InventoryError ? err.message : 'Could not save the item.');
    }
  }

  return (
    <Modal title={product ? 'Edit item' : 'Add item'} onClose={() => onClose()}>
      <form className="form-grid" onSubmit={submit}>
        <label>
          Item code
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Optional, e.g. HW-001" />
        </label>
        <label className="span-2">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </label>
        <label>
          Category
          <input value={category} onChange={(e) => setCategory(e.target.value)} list="categories" />
          <datalist id="categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label>
          Unit
          <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="each, bag, litre…" />
        </label>
        <label>
          Selling price (K)
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="decimal"
            disabled={!canPrice}
            required
          />
        </label>
        {can(actor.role, 'inventory.viewCost') && (
          <label>
            Buying price (K)
            <input value={cost} onChange={(e) => setCost(e.target.value)} inputMode="decimal" placeholder="Optional" />
          </label>
        )}
        {!product && (
          <label>
            Opening quantity
            <input type="number" min={0} step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </label>
        )}
        <label>
          Low-stock level
          <input type="number" min={0} step="any" value={reorder} onChange={(e) => setReorder(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="form-actions">
          {product && onArchive && (
            <button type="button" className="ghost danger push-left" onClick={onArchive}>
              Archive item
            </button>
          )}
          <button type="button" className="ghost" onClick={() => onClose()}>
            Cancel
          </button>
          <button type="submit">{product ? 'Save changes' : 'Add item'}</button>
        </div>
      </form>
    </Modal>
  );
}
