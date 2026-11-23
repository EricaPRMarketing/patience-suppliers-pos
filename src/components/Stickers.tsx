import type { ReactElement } from 'react';

/** Hand-drawn style stickers for the things Patience Suppliers sells. Pure SVG, so they work offline. */
const G = '#009541';
const L = '#a4c536';
const C = '#1f1d1d';
const GR = '#8d8c8b';

export type StickerName = 'cement' | 'tools' | 'paint' | 'tiles' | 'laptop' | 'stationery' | 'tyre' | 'wheelbarrow' | 'roof' | 'battery';

const ART: Record<StickerName, ReactElement> = {
  cement: (
    <>
      <path d="M14 14 Q32 8 50 14 L54 52 Q32 58 10 52 Z" fill="#e9e4d8" stroke={C} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M14 14 Q32 20 50 14" fill="none" stroke={C} strokeWidth="2" />
      <rect x="18" y="26" width="28" height="15" rx="3" fill={G} />
      <text x="32" y="37" textAnchor="middle" fontSize="9" fontWeight="800" fill="#fff" fontFamily="system-ui">50kg</text>
      <path d="M12 46 Q32 51 52 46" fill="none" stroke={L} strokeWidth="3" />
    </>
  ),
  tools: (
    <>
      <g transform="rotate(40 32 32)">
        <rect x="29" y="20" width="6" height="38" rx="3" fill="#c98a3c" stroke={C} strokeWidth="2" />
        <path d="M17 10 H44 a4 4 0 0 1 4 4 V20 a2 2 0 0 1 -2 2 H17 Q12 16 17 10 Z" fill={GR} stroke={C} strokeWidth="2.5" strokeLinejoin="round" />
      </g>
      <g transform="rotate(-40 32 32)">
        <rect x="29" y="22" width="7" height="34" rx="3" fill={L} stroke={C} strokeWidth="2" />
        <path d="M24 12 a9 9 0 1 0 17 0 l-4 0 l0 6 l-9 0 l0 -6 z" fill={L} stroke={C} strokeWidth="2.5" strokeLinejoin="round" />
      </g>
    </>
  ),
  paint: (
    <>
      <path d="M14 22 L50 22 L46 54 Q32 58 18 54 Z" fill="#fff" stroke={C} strokeWidth="2.5" strokeLinejoin="round" />
      <ellipse cx="32" cy="22" rx="18" ry="5" fill={G} stroke={C} strokeWidth="2.5" />
      <path d="M20 23 Q21 36 24 34 Q26 32 26 24 M36 24 Q37 42 40 40 Q42 38 42 24" fill={G} />
      <rect x="22" y="38" width="20" height="9" rx="2" fill={L} />
      <path d="M14 22 Q32 2 50 22" fill="none" stroke={C} strokeWidth="2" />
    </>
  ),
  tiles: (
    <>
      <g stroke={C} strokeWidth="2.5" strokeLinejoin="round">
        <rect x="10" y="10" width="21" height="21" rx="2" fill={G} />
        <rect x="33" y="10" width="21" height="21" rx="2" fill="#e8eee9" />
        <rect x="10" y="33" width="21" height="21" rx="2" fill="#e8eee9" />
        <rect x="33" y="33" width="21" height="21" rx="2" fill={L} />
      </g>
      <path d="M14 14 l6 0 M37 14 l6 0" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
    </>
  ),
  laptop: (
    <>
      <rect x="14" y="14" width="36" height="25" rx="3" fill={C} />
      <rect x="17" y="17" width="30" height="19" rx="1.5" fill={G} />
      <path d="M21 31 l6 -6 l5 4 l9 -8" fill="none" stroke={L} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 42 L56 42 L52 49 L12 49 Z" fill={GR} stroke={C} strokeWidth="2.5" strokeLinejoin="round" />
    </>
  ),
  stationery: (
    <>
      <rect x="12" y="12" width="28" height="38" rx="2" fill="#fff" stroke={C} strokeWidth="2.5" transform="rotate(-8 26 31)" />
      <path d="M17 22 h17 M17 29 h17 M17 36 h12" stroke={GR} strokeWidth="2" strokeLinecap="round" transform="rotate(-8 26 31)" />
      <g transform="rotate(35 44 34)">
        <rect x="40" y="8" width="9" height="36" fill={L} stroke={C} strokeWidth="2.5" />
        <path d="M40 44 L44.5 54 L49 44 Z" fill="#f2d7a7" stroke={C} strokeWidth="2.5" strokeLinejoin="round" />
        <rect x="40" y="4" width="9" height="6" rx="1" fill={G} stroke={C} strokeWidth="2.5" />
      </g>
    </>
  ),
  tyre: (
    <>
      <circle cx="32" cy="32" r="22" fill={C} />
      <circle cx="32" cy="32" r="22" fill="none" stroke="#3a3737" strokeWidth="5" strokeDasharray="4 4" />
      <circle cx="32" cy="32" r="12" fill={GR} stroke="#fff" strokeWidth="2" />
      <circle cx="32" cy="32" r="4" fill={G} />
      <g fill={L}>
        <circle cx="32" cy="24" r="2" /><circle cx="40" cy="32" r="2" /><circle cx="32" cy="40" r="2" /><circle cx="24" cy="32" r="2" />
      </g>
    </>
  ),
  wheelbarrow: (
    <>
      <path d="M8 22 L46 22 L40 38 L16 38 Z" fill={G} stroke={C} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M12 24 L42 24" stroke="#fff" strokeWidth="2" opacity="0.5" />
      <path d="M40 34 L56 30 M20 38 L18 50 M36 38 L38 50" stroke={C} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="28" cy="48" r="7" fill={C} />
      <circle cx="28" cy="48" r="2.5" fill={L} />
      <path d="M12 22 Q20 12 30 16 Q38 10 44 22" fill="#e9e4d8" stroke={C} strokeWidth="2" />
    </>
  ),
  roof: (
    <>
      <path d="M8 34 L32 12 L56 34" fill="none" stroke={C} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M14 30 L32 14 L50 30 L50 54 L14 54 Z" fill="#fff" stroke={C} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M6 34 L32 10 L58 34 L52 36 L32 18 L12 36 Z" fill={G} stroke={C} strokeWidth="2" strokeLinejoin="round" />
      <rect x="27" y="38" width="10" height="16" fill={L} stroke={C} strokeWidth="2" />
      <rect x="17" y="36" width="7" height="7" fill="#cfe7d8" stroke={C} strokeWidth="1.5" />
    </>
  ),
  battery: (
    <>
      <rect x="10" y="18" width="44" height="32" rx="4" fill={C} />
      <rect x="10" y="18" width="44" height="9" rx="3" fill={G} />
      <rect x="16" y="12" width="8" height="6" rx="1" fill={GR} />
      <rect x="40" y="12" width="8" height="6" rx="1" fill={GR} />
      <path d="M34 30 L27 40 L32 40 L30 47 L38 36 L33 36 Z" fill={L} />
      <text x="20" y="25" fontSize="7" fontWeight="800" fill="#fff" fontFamily="system-ui">+</text>
      <text x="42" y="25" fontSize="7" fontWeight="800" fill="#fff" fontFamily="system-ui">−</text>
    </>
  ),
};

export function Sticker({ name, size = 64 }: { name: StickerName; size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false">
      {ART[name]}
    </svg>
  );
}

/** What each sticker stands for, and which inventory category it opens. */
export const SHOWCASE: { sticker: StickerName; label: string; category: string }[] = [
  { sticker: 'cement', label: 'Cement and building', category: 'Building materials' },
  { sticker: 'tools', label: 'Hardware and tools', category: 'Hardware' },
  { sticker: 'paint', label: 'Paints', category: 'Tiles and paints' },
  { sticker: 'tiles', label: 'Tiles', category: 'Tiles and paints' },
  { sticker: 'roof', label: 'Roofing', category: 'Building materials' },
  { sticker: 'laptop', label: 'ITC', category: 'ITC' },
  { sticker: 'stationery', label: 'Stationery and office', category: 'Stationery and office' },
  { sticker: 'wheelbarrow', label: 'Site equipment', category: 'Hardware' },
  { sticker: 'tyre', label: 'Auto spares', category: 'Auto spares' },
  { sticker: 'battery', label: 'Batteries', category: 'Auto spares' },
];
