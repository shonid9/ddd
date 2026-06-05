import { useEffect, useState } from 'react';

/**
 * Cinematic intro: animated scan-stripes, a counting odometer (000→100) and a
 * brand lockup, then a staggered "blinds" wipe that reveals the site — the kind
 * of loading sequence used on award-winning sites.
 */
export default function Loader({ onDone }: { onDone: () => void }) {
  const [pct, setPct] = useState(0);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const duration = 2600;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      setPct(Math.round(eased * 100));
      if (k < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setExiting(true);
        window.setTimeout(onDone, 950);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  return (
    <div className={`loader ${exiting ? 'is-exiting' : ''}`} aria-hidden={exiting}>
      <div className="loader-grid" />
      <div className="loader-stripes" />

      <div className="loader-center">
        <span className="loader-eyebrow">ORACLE · אורקל</span>
        <h1 className="loader-brand" data-text="ORACLE">
          ORACLE
        </h1>
        <span className="loader-sub">{exiting ? 'מוכן' : 'מתעורר…'}</span>
      </div>

      <div className="loader-foot">
        <span className="loader-count">{String(pct).padStart(3, '0')}</span>
        <span className="loader-track">
          <span className="loader-fill" style={{ transform: `scaleX(${pct / 100})` }} />
        </span>
        <span className="loader-pct">%</span>
      </div>

      <div className="loader-blinds" aria-hidden="true">
        {Array.from({ length: 7 }).map((_, i) => (
          <span key={i} style={{ transitionDelay: `${i * 55}ms` }} />
        ))}
      </div>
    </div>
  );
}
