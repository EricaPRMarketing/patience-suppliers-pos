import { describe, expect, it } from 'vitest';
import { mapHeaders, parseInventoryRows, TEMPLATE_HEADERS } from '../src/lib/importParse';
import { parseCsv } from '../src/lib/importFile';
import { parseKwacha } from '../src/lib/money';

describe('parseKwacha', () => {
  it('reads common price formats into ngwee', () => {
    expect(parseKwacha('1,250.50')).toBe(125050);
    expect(parseKwacha('K 99')).toBe(9900);
    expect(parseKwacha('ZMW 10.5')).toBe(1050);
    expect(parseKwacha(12.345)).toBe(1235);
    expect(parseKwacha('abc')).toBeNull();
    expect(parseKwacha('-5')).toBeNull();
  });
});

describe('mapHeaders', () => {
  it('recognises the template and common alternatives', () => {
    expect(mapHeaders(TEMPLATE_HEADERS).columns).toEqual({
      code: 0, name: 1, category: 2, unit: 3, priceNgwee: 4, costNgwee: 5, quantity: 6, reorderLevel: 7,
    });
    const { columns, ignored } = mapHeaders(['Item Code', 'Description', 'Unit Price', 'Qty', 'Supplier']);
    expect(columns).toEqual({ code: 0, name: 1, priceNgwee: 2, quantity: 3 });
    expect(ignored).toEqual(['Supplier']);
  });
});

describe('parseInventoryRows', () => {
  it('parses a CSV, skipping blank rows and reporting bad ones with spreadsheet row numbers', () => {
    const csv = [
      'Code,Name,Category,Unit,Selling price (K),Quantity',
      'HW-1,Cement 50kg,Building,bag,"1,165.00",10',
      ',,,,,',
      'HW-2,Nails,Hardware,kg,abc,5',
      'HW-1,Cement again,Building,bag,10,1',
      ',Sand,,tonne,350,',
    ].join('\n');
    const r = parseInventoryRows(parseCsv(csv));
    expect(r.items.map((i) => [i.row, i.item.name, i.item.priceNgwee, i.item.quantity])).toEqual([
      [2, 'Cement 50kg', 116500, 10],
      [6, 'Sand', 35000, 0],
    ]);
    expect(r.errors.map((e) => e.row)).toEqual([4, 5]);
    expect(r.errors[1].message).toMatch(/same code as row 2/);
  });

  it('refuses a file without name or price columns', () => {
    const r = parseInventoryRows([['Code', 'Qty'], ['A', 1]]);
    expect(r.items).toHaveLength(0);
    expect(r.missingColumns).toEqual(['Name', 'Selling price']);
  });

  it('handles numbers straight from Excel cells', () => {
    const r = parseInventoryRows([
      ['Name', 'Price', 'Stock'],
      ['Paint 20L', 780, 18],
    ]);
    expect(r.items[0].item).toMatchObject({ name: 'Paint 20L', priceNgwee: 78000, quantity: 18 });
  });
});
