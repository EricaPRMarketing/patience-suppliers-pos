import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Product } from '../../db/db';
import { useCurrentUser } from '../../auth/AuthContext';
import { can } from '../../auth/permissions';
import { importProducts, isLowStock, setProductActive } from '../../lib/inventory';
import { SAMPLE_PRODUCTS } from '../../lib/sampleProducts';
import { formatDateTime, formatNgwee } from '../../lib/format';
import { searchItems } from '../../lib/search';
import { useLocation } from 'react-router-dom';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { ProductForm } from './ProductForm';
import { AdjustStock } from './AdjustStock';
import { ImportDialog } from './ImportDialog';

type Dialog =
  | { kind: 'add' }
  | { kind: 'edit'; product: Product }
  | { kind: 'adjust'; product: Product }
  | { kind: 'history'; product: Product }
  | { kind: 'import' }
  | null;

export function InventoryPage() {
  const user = useCurrentUser();
  const canEdit = can(user.role, 'inventory.edit');
  const canImport = can(user.role, 'inventory.import');
  const showCost = can(user.role, 'inventory.viewCost');
  const products = useLiveQuery(() => db.products.orderBy('name').toArray(), []);
  const [search, setSearch] = useState('');
  const location = useLocation();
  const [category, setCategory] = useState<string>((location.state as { category?: string } | null)?.category ?? '');
  const [lowOnly, setLowOnly] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [message, setMessage] = useState('');

  const categories = useMemo(() => [...new Set(products?.map((p) => p.category))].sort(), [products]);
  const active = products?.filter((p) => p.active) ?? [];
  const lowCount = active.filter(isLowStock).length;
  const stockValue = active.reduce((sum, p) => sum + p.priceNgwee * p.quantity, 0);
  const shown = searchItems(
    (products ?? []).filter(
      (p) =>
        (showArchived ? !p.active : p.active) && (!category || p.category === category) && (!lowOnly || isLowStock(p)),
    ),
    search,
  );

  const close = (m?: string) => {
    setDialog(null);
    if (m) setMessage(m);
  };

  async function loadSamples() {
    const s = await importProducts(user, SAMPLE_PRODUCTS, 'Sample items');
    setMessage(`${s.created} sample items added. Upload the real stock list when it is ready.`);
  }

  async function toggleArchive(p: Product) {
    await setProductActive(user, p.id, !p.active);
    setMessage(p.active ? `${p.name} archived. It no longer shows for selling.` : `${p.name} restored.`);
  }

  return (
    <>
      <div className="page-head">
        <h1>Inventory</h1>
        <div className="head-actions">
          {canImport && (
            <button className="ghost" onClick={() => setDialog({ kind: 'import' })}>
              <Icon name="upload" size={18} /> Upload Excel or CSV
            </button>
          )}
          {canEdit && (
            <button onClick={() => setDialog({ kind: 'add' })}>
              <Icon name="plus" size={18} /> Add item
            </button>
          )}
        </div>
      </div>

      {message && (
        <p className="notice" onClick={() => setMessage('')}>
          {message}
        </p>
      )}

      <div className="tiles">
        <div className="tile">
          <span>Items in stock list</span>
          <strong>{active.length}</strong>
        </div>
        <button type="button" className={`tile tile-button ${lowOnly ? 'selected' : ''}`} onClick={() => setLowOnly(!lowOnly)}>
          <span>Low or out of stock</span>
          <strong className={lowCount ? 'warn-text' : ''}>{lowCount}</strong>
        </button>
        <div className="tile">
          <span>Stock value at selling price</span>
          <strong>{formatNgwee(stockValue)}</strong>
        </div>
      </div>

      {products && products.length === 0 ? (
        <div className="card empty">
          <div className="preview-badge">
            <Icon name="inventory" size={36} />
          </div>
          <div>
            <h2>No items yet</h2>
            <p className="muted">
              {canImport
                ? 'Upload the stock list from Excel or CSV, add items one by one, or load sample items to try the app.'
                : 'A manager or the owner needs to add the stock list.'}
            </p>
            {canImport && (
              <div className="head-actions">
                <button onClick={() => setDialog({ kind: 'import' })}>Upload stock list</button>
                <button className="ghost" onClick={loadSamples}>
                  Load sample items
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="filters">
            <input
              placeholder="Search items, e.g. ce"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search"
            />
            <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <label className="check">
              <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} /> Low stock only
            </label>
            {canEdit && (
              <label className="check">
                <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />{' '}
                Archived items
              </label>
            )}
          </div>
          <section className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th className="num">Price</th>
                    {showCost && <th className="num">Cost</th>}
                    <th className="num">In stock</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((p) => (
                    <tr key={p.id}>
                      <td className="muted nowrap">{p.code}</td>
                      <td>{p.name}</td>
                      <td>
                        <span className="chip">{p.category}</span>
                      </td>
                      <td className="num nowrap">{formatNgwee(p.priceNgwee)}</td>
                      {showCost && <td className="num nowrap muted">{p.costNgwee == null ? '' : formatNgwee(p.costNgwee)}</td>}
                      <td className="num nowrap">
                        <span className={p.quantity === 0 ? 'qty out' : isLowStock(p) ? 'qty low' : 'qty'}>
                          {p.quantity} {p.unit}
                        </span>
                      </td>
                      <td className="actions">
                        <button className="ghost" onClick={() => setDialog({ kind: 'history', product: p })}>
                          History
                        </button>
                        {canEdit && p.active && (
                          <>
                            <button className="ghost" onClick={() => setDialog({ kind: 'adjust', product: p })}>
                              Stock
                            </button>
                            <button className="ghost" onClick={() => setDialog({ kind: 'edit', product: p })}>
                              Edit
                            </button>
                          </>
                        )}
                        {canEdit && !p.active && (
                          <button className="ghost" onClick={() => toggleArchive(p)}>
                            Restore
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {shown.length === 0 && <p className="muted">No items match.</p>}
            </div>
          </section>
        </>
      )}

      {dialog?.kind === 'add' && <ProductForm actor={user} categories={categories} onClose={close} />}
      {dialog?.kind === 'edit' && (
        <ProductForm
          actor={user}
          product={dialog.product}
          categories={categories}
          onClose={close}
          onArchive={() => {
            setDialog(null);
            toggleArchive(dialog.product);
          }}
        />
      )}
      {dialog?.kind === 'adjust' && <AdjustStock actor={user} product={dialog.product} onClose={close} />}
      {dialog?.kind === 'import' && <ImportDialog actor={user} onClose={close} />}
      {dialog?.kind === 'history' && <StockHistory product={dialog.product} onClose={() => setDialog(null)} />}
    </>
  );
}

function StockHistory({ product, onClose }: { product: Product; onClose: () => void }) {
  const moves = useLiveQuery(
    () => db.stockMovements.where('productId').equals(product.id).reverse().sortBy('at'),
    [product.id],
  );
  return (
    <Modal title={`Stock history: ${product.name}`} onClose={onClose} wide>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>Reason</th>
              <th className="num">Change</th>
              <th className="num">Balance</th>
            </tr>
          </thead>
          <tbody>
            {moves?.map((m) => (
              <tr key={m.id}>
                <td className="nowrap">{formatDateTime(m.at)}</td>
                <td>{m.username}</td>
                <td>{m.reason}</td>
                <td className={`num ${m.change > 0 ? 'up' : 'down'}`}>
                  {m.change > 0 ? '+' : ''}
                  {m.change}
                </td>
                <td className="num">{m.quantityAfter}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {moves?.length === 0 && <p className="muted">No stock movements yet.</p>}
      </div>
    </Modal>
  );
}
