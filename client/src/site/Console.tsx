import { useEffect, useRef } from 'react';
import type { Conversation } from '../hooks/useConversation';

/** The live console — the eye shows through behind a pulsing voice orb. */
export default function Console({ c }: { c: Conversation }) {
  const ringRef = useRef<HTMLSpanElement>(null);
  const busy = c.active || c.live;

  // Pulse the orb ring with the live audio level.
  useEffect(() => {
    if (!busy) {
      if (ringRef.current) ringRef.current.style.transform = 'scale(1)';
      return;
    }
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const lvl = c.getLevel();
      if (ringRef.current) {
        ringRef.current.style.transform = `scale(${1 + lvl * 0.6})`;
        ringRef.current.style.opacity = String(0.35 + lvl * 0.55);
      }
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [busy, c]);

  const onOrb = () => {
    if (!c.primed) void c.prime();
    else c.toggle();
  };

  const orbLabel = !c.primed
    ? 'הקש כדי להתעורר'
    : c.live
      ? 'מצב חי — הקש לעצירה'
      : c.active
        ? 'מקשיב — הקש לעצירה'
        : 'הקש כדי לדבר';

  const caption =
    c.error || (c.status === 'thinking' ? 'חושב…' : '') || c.lastReply || c.lastUser || 'אני מקשיב. פשוט דבר.';

  return (
    <section id="console" className="section section-console">
      <div className="console-inner">
        <span className="section-eyebrow reveal">CONSOLE</span>
        <h2 className="section-title reveal">דבר איתה</h2>

        <button
          className={`orb status-${c.status} ${c.live ? 'is-live' : ''} ${busy ? 'is-busy' : ''}`}
          onClick={onOrb}
          aria-label={orbLabel}
        >
          <span ref={ringRef} className="orb-ring" aria-hidden="true" />
          <span className="orb-glow" aria-hidden="true" />
          <span className="orb-label">{orbLabel}</span>
        </button>

        <p className={`console-caption ${c.error ? 'is-error' : ''} ${c.status === 'speaking' || c.live ? 'is-speaking' : ''}`}>
          {caption}
        </p>
      </div>
    </section>
  );
}
