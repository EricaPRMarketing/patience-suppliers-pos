import Papa from 'papaparse';

export async function readSpreadsheet(file: File): Promise<unknown[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv') || file.type === 'text/csv') return parseCsv(await file.text());
  if (name.endsWith('.xlsx')) {
    const { readSheet } = await import('read-excel-file/browser');
    return (await readSheet(file)) as unknown[][];
  }
  if (name.endsWith('.xls'))
    throw new Error('Old .xls files are not supported. In Excel, use File > Save As and choose .xlsx or CSV.');
  throw new Error('Choose an Excel (.xlsx) or CSV file.');
}

export function parseCsv(text: string): unknown[][] {
  const result = Papa.parse<string[]>(text.replace(/^﻿/, ''), { skipEmptyLines: false });
  return result.data;
}

export function downloadTemplate(headers: string[], sample: (string | number)[][]) {
  const csv = Papa.unparse([headers, ...sample]);
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'patience-suppliers-inventory-template.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
