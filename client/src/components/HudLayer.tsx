import HudCard from './HudCard';
import type { Card } from '../types';

/** Floating stack of holographic cards docked to the side of the screen. */
export default function HudLayer({ cards, onClose }: { cards: Card[]; onClose: (id: string) => void }) {
  if (cards.length === 0) return null;
  return (
    <div className="hud-layer" aria-live="polite">
      {cards.map((c) => (
        <HudCard key={c.id} card={c} onClose={onClose} />
      ))}
    </div>
  );
}
