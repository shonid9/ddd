import type { Card, CardKind } from '../types';

const KIND_META: Record<CardKind, { label: string; icon: string }> = {
  weather: { label: 'מזג אוויר', icon: '☀' },
  news: { label: 'חדשות', icon: '⚡' },
  search: { label: 'תוצאות', icon: '⌕' },
  summary: { label: 'סיכום', icon: '≡' },
  recommendation: { label: 'המלצה', icon: '★' },
  list: { label: 'רשימה', icon: '•' },
  note: { label: 'הערה', icon: '✎' },
  reminder: { label: 'תזכורת', icon: '◷' },
  vision: { label: 'ראייה', icon: '👁' },
};

export default function HudCard({ card, onClose }: { card: Card; onClose: (id: string) => void }) {
  const meta = KIND_META[card.kind] ?? KIND_META.note;
  return (
    <article className={`hud-card hud-${card.kind}`} role="dialog" aria-label={card.title}>
      <div className="hud-scan" aria-hidden="true" />
      <header className="hud-head">
        <span className="hud-kind">
          <span className="hud-icon" aria-hidden="true">
            {meta.icon}
          </span>
          {meta.label}
        </span>
        <button className="hud-close" onClick={() => onClose(card.id)} aria-label="סגור" title="סגור">
          ✕
        </button>
      </header>

      <h3 className="hud-title">{card.title}</h3>
      {card.subtitle && <p className="hud-subtitle">{card.subtitle}</p>}
      {card.body && <p className="hud-body">{card.body}</p>}

      {card.bullets && card.bullets.length > 0 && (
        <ul className="hud-bullets">
          {card.bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      )}

      {card.source && <footer className="hud-source">{card.source}</footer>}
    </article>
  );
}
