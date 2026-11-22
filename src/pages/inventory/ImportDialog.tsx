import { useState } from 'react';
import type { User } from '../../db/db';
import { importProducts, InventoryError } from '../../lib/inventory';
import { downloadTemplate, readSpreadsheet } from '../../lib/importFile';
import { parseInventoryRows, TEMPLATE_HEADERS, type ParseResult } from '../../lib/importParse';
import { formatNgwee } from '../../lib/format';
import { Modal } from '../../components/Modal';

export function ImportDialog({ actor, onClose }: { actor: User; onClose: (m?: string) => void }) {
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function choose(file: File | undefined) {
    if (!file) return;
    setError('');
    setResult(null);
    setFileName(file.name);
    try {
      setResult(parseInventoryRows(await readSpreadsheet(file)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file.');
    }
  }

  async function confirm() {
    if (!result) return;
    setBusy(true);
    try {
      const s = await importProducts(
        actor,
        result.items.map((r) => r.item),
        fileName,
        result.fields,
      );
      onClose(`Upload complete: ${s.created} new items, ${s.updated} updated.`);
    } catch (err) {
      setError(err instanceof InventoryError ? err.message : 'The upload failed. Nothing was changed.');
      setBusy(false);
    }
  }

  return (
    <Modal title="Upload stock from Excel or CSV" onClose={() => onClose()} wide>
      <div className="import">
        <ol className="steps">
          <li>
            Use one row per item. Needed columns: <strong>Name</strong> and <strong>Selling price</strong>. Optional:
            Code, Category, Unit, Buying price, Quantity, Reorder level.{' '}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                downloadTemplate(TEMPLATE_HEADERS, [
                  ['HW-001', 'Cement 50kg bag', 'Building materials', 'bag', 165, 140, 240, 50],
                  ['TP-003', 'Interior PVA paint white 20L', 'Tiles and paints', 'tin', 780, 610, 18, 6],
                ]);
              }}
            >
              Download the template
            </a>
            .
          </li>
          <li>
            Items that already exist (same code, or same name when there is no code) are updated, and the file's
            quantity becomes the stock level. Columns the file does not have are left as they are.
          </li>
        </ol>
        <label className="dropzone">
          <input type="file" accept=".xlsx,.csv,text/csv" onChange={(e) => choose(e.target.files?.[0])} />
          <span>{fileName ? `Selected: ${fileName}` : 'Click to choose a file (.xlsx or .csv)'}</span>
        </label>
        {error && <p className="error">{error}</p>}
        {result && (
          <>
            <div className="import-summary">
              <span className="pill ok">{result.items.length} items ready</span>
              {result.errors.length > 0 && <span className="pill warn">{result.errors.length} rows need fixing</span>}
              {result.ignoredColumns.length > 0 && (
                <span className="muted">Ignored columns: {result.ignoredColumns.join(', ')}</span>
              )}
            </div>
            {result.errors.length > 0 && (
              <ul className="row-errors">
                {result.errors.slice(0, 20).map((e) => (
                  <li key={e.row}>
                    Row {e.row}: {e.message}
                  </li>
                ))}
                {result.errors.length > 20 && <li>…and {result.errors.length - 20} more</li>}
              </ul>
            )}
            {result.items.length > 0 && (
              <div className="table-wrap preview-table">
                <table>
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Code</th>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.items.slice(0, 8).map(({ row, item }) => (
                      <tr key={row}>
                        <td className="muted">{row}</td>
                        <td>{item.code}</td>
                        <td>{item.name}</td>
                        <td>{item.category}</td>
                        <td className="nowrap">{formatNgwee(item.priceNgwee)}</td>
                        <td>{item.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.items.length > 8 && <p className="muted">…and {result.items.length - 8} more.</p>}
              </div>
            )}
          </>
        )}
        <div className="form-actions">
          <button type="button" className="ghost" onClick={() => onClose()}>
            Cancel
          </button>
          <button type="button" onClick={confirm} disabled={!result || result.items.length === 0 || busy}>
            {busy
              ? 'Uploading…'
              : result && result.errors.length
                ? `Upload the ${result.items.length} good rows`
                : 'Upload'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
