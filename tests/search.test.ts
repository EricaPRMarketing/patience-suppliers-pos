import { describe, expect, it } from 'vitest';
import { highlight, searchItems } from '../src/lib/search';

const items = [
  { name: 'Tile adhesive 20kg', code: 'TP-002' },
  { name: 'Ceiling board 6mm', code: 'HW-020' },
  { name: 'White cement 5kg', code: 'HW-021' },
  { name: 'Cement 50kg bag', code: 'HW-001' },
  { name: 'Padlock 50mm brass', code: 'HW-011' },
  { name: 'Spacers for tiles', code: 'CE-900' },
];

describe('searchItems', () => {
  it('puts names starting with the typed letters first, A to Z', () => {
    expect(searchItems(items, 'ce').map((i) => i.name)).toEqual([
      'Ceiling board 6mm',
      'Cement 50kg bag',
      'Spacers for tiles', // code starts with CE
      'White cement 5kg', // a later word starts with ce
    ]);
  });
  it('narrows with several words', () => {
    expect(searchItems(items, 'ce 50').map((i) => i.name)).toEqual(['Cement 50kg bag']);
  });
  it('is not case sensitive and finds codes', () => {
    expect(searchItems(items, 'HW-01').map((i) => i.code)).toEqual(['HW-011']);
  });
  it('lists everything A to Z when empty', () => {
    expect(searchItems(items, '  ')[0].name).toBe('Ceiling board 6mm');
  });
});

describe('highlight', () => {
  it('marks the typed letters', () => {
    expect(highlight('Cement 50kg', 'ce')).toEqual([
      { text: 'Ce', hit: true },
      { text: 'ment 50kg', hit: false },
    ]);
  });
});
