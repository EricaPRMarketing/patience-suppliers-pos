/** Parse "1,250.50", "K 1250.5", 1250.5 etc. into ngwee. Returns null when not a valid amount. */
export function parseKwacha(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : null;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/zmw|k/gi, '').replace(/[,\s]/g, '');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  return Math.round(parseFloat(cleaned) * 100);
}

export function ngweeToKwacha(ngwee: number): number {
  return ngwee / 100;
}
