/**
 * Fast item search for long stock lists.
 * Typing "ce" shows items whose name starts with "ce" first (Cement...), then items with a word
 * starting with "ce", then any other match. Each group is sorted A to Z.
 * Several words narrow the list: "ce 50" finds "Cement 50kg bag".
 */
export interface Searchable {
  name: string;
  code: string;
}

function rank(item: Searchable, first: string): number {
  const name = item.name.toLowerCase();
  const code = item.code.toLowerCase();
  if (name.startsWith(first)) return 0;
  if (code.startsWith(first)) return 1;
  if (name.split(/[\s\-/(),.]+/).some((w) => w.startsWith(first))) return 2;
  return 3;
}

export function searchItems<T extends Searchable>(items: T[], query: string): T[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...items].sort((a, b) => a.name.localeCompare(b.name));
  const hits: { item: T; r: number }[] = [];
  for (const item of items) {
    const hay = `${item.name} ${item.code}`.toLowerCase();
    if (words.every((w) => hay.includes(w))) hits.push({ item, r: rank(item, words[0]) });
  }
  return hits.sort((a, b) => a.r - b.r || a.item.name.localeCompare(b.item.name)).map((h) => h.item);
}

/** Splits a name so the typed letters can be shown in bold. */
export function highlight(text: string, query: string): { text: string; hit: boolean }[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [{ text, hit: false }];
  const marks = new Array(text.length).fill(false);
  const lower = text.toLowerCase();
  for (const w of words) {
    const i = lower.indexOf(w);
    if (i >= 0) for (let k = i; k < i + w.length; k++) marks[k] = true;
  }
  const parts: { text: string; hit: boolean }[] = [];
  for (let i = 0; i < text.length; i++) {
    const last = parts[parts.length - 1];
    if (last && last.hit === marks[i]) last.text += text[i];
    else parts.push({ text: text[i], hit: marks[i] });
  }
  return parts;
}
