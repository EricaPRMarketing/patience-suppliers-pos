export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-ZM', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Kwacha, no VAT. */
export function formatKwacha(amount: number): string {
  return 'K ' + amount.toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatNgwee(ngwee: number): string {
  return formatKwacha(ngwee / 100);
}
