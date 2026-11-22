import type { ProductInput } from './inventory';

const K = (k: number) => Math.round(k * 100);

/** Made-up items for testing until the client's real stock list is uploaded. */
export const SAMPLE_PRODUCTS: ProductInput[] = [
  { code: 'HW-001', name: 'Cement 50kg bag', category: 'Building materials', unit: 'bag', priceNgwee: K(165), costNgwee: K(140), quantity: 240, reorderLevel: 50 },
  { code: 'HW-002', name: 'Y12 reinforcement bar 6m', category: 'Building materials', unit: 'length', priceNgwee: K(145), costNgwee: K(118), quantity: 180, reorderLevel: 40 },
  { code: 'HW-003', name: 'River sand', category: 'Building materials', unit: 'tonne', priceNgwee: K(350), costNgwee: K(260), quantity: 12, reorderLevel: 5 },
  { code: 'HW-004', name: 'IBR roofing sheet 0.47mm 3m', category: 'Building materials', unit: 'sheet', priceNgwee: K(285), costNgwee: K(230), quantity: 6, reorderLevel: 20 },
  { code: 'HW-010', name: 'Wire nails 75mm', category: 'Hardware', unit: 'kg', priceNgwee: K(42), costNgwee: K(31), quantity: 95, reorderLevel: 25 },
  { code: 'HW-011', name: 'Padlock 50mm brass', category: 'Hardware', unit: 'each', priceNgwee: K(120), costNgwee: K(85), quantity: 30, reorderLevel: 10 },
  { code: 'HW-012', name: 'PVC pipe 110mm 6m', category: 'Hardware', unit: 'length', priceNgwee: K(310), costNgwee: K(250), quantity: 14, reorderLevel: 10 },
  { code: 'HW-013', name: 'Wheelbarrow heavy duty', category: 'Hardware', unit: 'each', priceNgwee: K(1150), costNgwee: K(900), quantity: 3, reorderLevel: 4 },
  { code: 'TP-001', name: 'Floor tile 600x600 grey', category: 'Tiles and paints', unit: 'box', priceNgwee: K(260), costNgwee: K(205), quantity: 85, reorderLevel: 30 },
  { code: 'TP-002', name: 'Tile adhesive 20kg', category: 'Tiles and paints', unit: 'bag', priceNgwee: K(185), costNgwee: K(150), quantity: 40, reorderLevel: 15 },
  { code: 'TP-003', name: 'Interior PVA paint white 20L', category: 'Tiles and paints', unit: 'tin', priceNgwee: K(780), costNgwee: K(610), quantity: 18, reorderLevel: 6 },
  { code: 'TP-004', name: 'Gloss enamel paint 5L', category: 'Tiles and paints', unit: 'tin', priceNgwee: K(420), costNgwee: K(330), quantity: 0, reorderLevel: 5 },
  { code: 'IT-001', name: 'HP 305 ink cartridge black', category: 'ITC', unit: 'each', priceNgwee: K(395), costNgwee: K(300), quantity: 9, reorderLevel: 5 },
  { code: 'IT-002', name: 'USB flash drive 32GB', category: 'ITC', unit: 'each', priceNgwee: K(150), costNgwee: K(95), quantity: 25, reorderLevel: 10 },
  { code: 'ST-001', name: 'A4 bond paper 80gsm ream', category: 'Stationery and office', unit: 'ream', priceNgwee: K(125), costNgwee: K(98), quantity: 60, reorderLevel: 20 },
  { code: 'ST-002', name: 'Box file', category: 'Stationery and office', unit: 'each', priceNgwee: K(45), costNgwee: K(30), quantity: 48, reorderLevel: 12 },
  { code: 'ST-003', name: 'Ballpoint pens blue (box of 50)', category: 'Stationery and office', unit: 'box', priceNgwee: K(110), costNgwee: K(75), quantity: 7, reorderLevel: 8 },
  { code: 'AS-001', name: 'Engine oil 15W-40 5L', category: 'Auto spares', unit: 'can', priceNgwee: K(520), costNgwee: K(410), quantity: 22, reorderLevel: 8 },
  { code: 'AS-002', name: 'Brake pads Toyota Corolla (front)', category: 'Auto spares', unit: 'set', priceNgwee: K(450), costNgwee: K(330), quantity: 5, reorderLevel: 4 },
  { code: 'AS-003', name: 'Car battery 12V 70Ah', category: 'Auto spares', unit: 'each', priceNgwee: K(2350), costNgwee: K(1900), quantity: 4, reorderLevel: 2 },
];
