import { parseKwacha } from './money';
import type { ProductInput } from './inventory';

type Field = keyof ProductInput;

/** Column headings we recognise, compared after lower-casing and removing spaces and punctuation. */
const ALIASES: Record<Field, string[]> = {
  code: ['code', 'itemcode', 'sku', 'productcode', 'barcode', 'partnumber', 'partno', 'ref'],
  name: ['name', 'item', 'itemname', 'product', 'productname', 'description', 'itemdescription'],
  category: ['category', 'group', 'department', 'type', 'section'],
  unit: ['unit', 'uom', 'unitofmeasure', 'measure'],
  priceNgwee: ['price', 'sellingprice', 'unitprice', 'retailprice', 'pricezmw', 'pricek', 'sellprice'],
  costNgwee: ['cost', 'costprice', 'buyingprice', 'purchaseprice', 'costzmw', 'costk'],
  quantity: ['quantity', 'qty', 'stock', 'instock', 'onhand', 'quantityonhand', 'balance', 'stocklevel'],
  reorderLevel: ['reorderlevel', 'reorder', 'minimum', 'minstock', 'lowstock', 'lowstocklevel', 'reorderpoint'],
};

export const TEMPLATE_HEADERS = [
  'Code',
  'Name',
  'Category',
  'Unit',
  'Selling price (K)',
  'Buying price (K)',
  'Quantity',
  'Reorder level',
];

function key(h: unknown): string {
  return String(h ?? '')
    .toLowerCase()
    .replace(/\(.*?\)/g, (m) => m.replace(/[()]/g, ''))
    .replace(/[^a-z0-9]/g, '');
}

export function mapHeaders(headers: unknown[]): { columns: Partial<Record<Field, number>>; ignored: string[] } {
  const columns: Partial<Record<Field, number>> = {};
  const ignored: string[] = [];
  headers.forEach((h, i) => {
    const k = key(h);
    if (!k) return;
    const free = (Object.keys(ALIASES) as Field[]).filter((f) => columns[f] === undefined);
    // Exact heading first ("Unit price" is a price, not a unit), then the longest alias the heading starts with.
    let field = free.find((f) => ALIASES[f].includes(k));
    if (!field) {
      let best = 0;
      for (const f of free)
        for (const a of ALIASES[f])
          if (a.length >= 4 && k.startsWith(a) && a.length > best) {
            best = a.length;
            field = f;
          }
    }
    if (field) columns[field] = i;
    else ignored.push(String(h));
  });
  return { columns, ignored };
}

export interface ParsedRow {
  row: number;
  item: ProductInput;
}

export interface RowError {
  row: number;
  message: string;
}

export interface ParseResult {
  items: ParsedRow[];
  /** Which fields the file has a column for. Existing items keep their values for the rest. */
  fields: (keyof ProductInput)[];
  errors: RowError[];
  ignoredColumns: string[];
  missingColumns: string[];
}

function text(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

function whole(v: unknown): number | null {
  if (v == null || text(v) === '') return 0;
  const n = typeof v === 'number' ? v : Number(text(v).replace(/,/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** rows[0] must be the heading row. Row numbers in results match the spreadsheet (heading = row 1). */
export function parseInventoryRows(rows: unknown[][]): ParseResult {
  const firstNonEmpty = rows.findIndex((r) => r.some((c) => text(c) !== ''));
  if (firstNonEmpty === -1)
    return {
      items: [],
      fields: [],
      errors: [{ row: 1, message: 'The file is empty.' }],
      ignoredColumns: [],
      missingColumns: [],
    };
  const { columns, ignored } = mapHeaders(rows[firstNonEmpty]);
  const missingColumns: string[] = [];
  if (columns.name === undefined) missingColumns.push('Name');
  if (columns.priceNgwee === undefined) missingColumns.push('Selling price');
  if (missingColumns.length)
    return {
      items: [],
      fields: [],
      errors: [{ row: firstNonEmpty + 1, message: `Missing column: ${missingColumns.join(', ')}.` }],
      ignoredColumns: ignored,
      missingColumns,
    };

  const items: ParsedRow[] = [];
  const errors: RowError[] = [];
  const seen = new Map<string, number>();
  const get = (r: unknown[], f: Field) => (columns[f] === undefined ? undefined : r[columns[f]!]);

  rows.slice(firstNonEmpty + 1).forEach((r, idx) => {
    const row = firstNonEmpty + idx + 2;
    if (!r.some((c) => text(c) !== '')) return;
    const name = text(get(r, 'name'));
    const code = text(get(r, 'code'));
    const problems: string[] = [];
    if (!name) problems.push('no name');
    const price = parseKwacha(get(r, 'priceNgwee'));
    if (price === null) problems.push(`selling price "${text(get(r, 'priceNgwee'))}" is not a number`);
    const costRaw = get(r, 'costNgwee');
    const cost = text(costRaw) === '' ? null : parseKwacha(costRaw);
    if (text(costRaw) !== '' && cost === null) problems.push(`buying price "${text(costRaw)}" is not a number`);
    const quantity = whole(get(r, 'quantity'));
    if (quantity === null) problems.push(`quantity "${text(get(r, 'quantity'))}" is not a number`);
    const reorder = whole(get(r, 'reorderLevel'));
    if (reorder === null) problems.push(`reorder level "${text(get(r, 'reorderLevel'))}" is not a number`);
    const dupKey = (code || name).toLowerCase();
    if (dupKey && seen.has(dupKey)) problems.push(`same ${code ? 'code' : 'name'} as row ${seen.get(dupKey)}`);
    if (problems.length) {
      errors.push({ row, message: `${name || code || 'Row'}: ${problems.join('; ')}` });
      return;
    }
    seen.set(dupKey, row);
    items.push({
      row,
      item: {
        code,
        name,
        category: text(get(r, 'category')),
        unit: text(get(r, 'unit')),
        priceNgwee: price!,
        costNgwee: cost,
        quantity: quantity!,
        reorderLevel: reorder!,
      },
    });
  });
  const fields = (Object.keys(columns) as Field[]).filter((f) => columns[f] !== undefined);
  return { items, fields, errors, ignoredColumns: ignored, missingColumns };
}
