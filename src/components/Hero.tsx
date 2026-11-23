import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SHOWCASE, Sticker } from './Stickers';

const WORDS = ['cement', 'hardware', 'tiles', 'paints', 'roofing', 'ITC', 'stationery', 'auto spares'];

/** Rotating word in the tagline. */
function useRotatingWord(ms = 2200) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % WORDS.length), ms);
    return () => clearInterval(t);
  }, [ms]);
  return WORDS[i];
}

/** Floating product stickers. Clicking one opens that part of the stock list when `canOpen` is true. */
export function StickerCloud({ canOpen = false }: { canOpen?: boolean }) {
  const navigate = useNavigate();
  return (
    <div className="sticker-cloud">
      {SHOWCASE.map((s, i) => (
        <button
          key={s.sticker}
          type="button"
          className={`sticker s${i}`}
          style={{ animationDelay: `${i * 0.08}s, ${(i % 5) * -0.9}s` }}
          onClick={canOpen ? () => navigate('/inventory', { state: { category: s.category } }) : undefined}
          tabIndex={canOpen ? 0 : -1}
          aria-label={canOpen ? `Open ${s.label} in the stock list` : s.label}
          title={s.label}
        >
          <Sticker name={s.sticker} />
          <span className="sticker-label">{s.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Hero({ greeting, children, canOpen }: { greeting: string; children?: React.ReactNode; canOpen?: boolean }) {
  const word = useRotatingWord();
  return (
    <section className="hero">
      <div className="hero-chevrons" aria-hidden="true" />
      <div className="hero-copy">
        <p className="hero-kicker">Patience Suppliers (Z) Ltd · Siavonga</p>
        <h1 className="hero-title">{greeting}</h1>
        <p className="hero-tag">
          Quality{' '}
          <span className="hero-word" key={word}>
            {word}
          </span>{' '}
          at affordable prices.
        </p>
        {children && <div className="hero-actions">{children}</div>}
      </div>
      <StickerCloud canOpen={canOpen} />
      <div className="hero-marquee" aria-hidden="true">
        <div>
          {[...SHOWCASE, ...SHOWCASE].map((s, i) => (
            <span key={i}>
              <Sticker name={s.sticker} size={22} /> {s.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
