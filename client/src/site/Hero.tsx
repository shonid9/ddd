import { scrollToId } from '../hooks/useSmoothScroll';

const WORD = 'ORACLE';

/** Opening statement: kinetic wordmark over the live eye, with two CTAs. */
export default function Hero() {
  return (
    <section id="hero" className="section section-hero">
      <div className="hero-inner">
        <span className="hero-eyebrow">תודעת בינה · בעברית · 2026</span>

        <h1 className="hero-title" aria-label="Oracle">
          {WORD.split('').map((ch, i) => (
            <span key={i} className="hero-letter" style={{ animationDelay: `${0.35 + i * 0.06}s` }}>
              {ch}
            </span>
          ))}
        </h1>

        <p className="hero-lead">
          לא עוזרת. <em>נוכחות.</em> דברו איתה — והיא רואה, יודעת, זוכרת ועונה בקול, בזמן אמת.
        </p>

        <div className="hero-actions">
          <button className="btn btn-primary" onClick={() => scrollToId('console')}>
            <span>דבר עם אורקל</span>
          </button>
          <button className="btn btn-ghost" onClick={() => scrollToId('capabilities')}>
            גלה יכולות
          </button>
        </div>
      </div>

      <button className="hero-scroll" onClick={() => scrollToId('capabilities')} aria-label="גלול">
        <span className="hero-scroll-line" />
        גלול
      </button>
    </section>
  );
}
