import { useEffect, useRef } from 'react';
import type { Status } from '../hooks/useConversation';

interface Props {
  status: Status;
  onClick: () => void;
  getLevel: () => number;
}

/** The primary control: a glassy mic button whose halo reacts to the voice. */
export default function MicButton({ status, onClick, getLevel }: Props) {
  const haloRef = useRef<HTMLSpanElement>(null);
  const active = status === 'listening' || status === 'speaking';

  useEffect(() => {
    if (!active) {
      if (haloRef.current) haloRef.current.style.transform = 'scale(1)';
      return;
    }
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const level = getLevel();
      if (haloRef.current) {
        haloRef.current.style.transform = `scale(${1 + level * 0.9})`;
        haloRef.current.style.opacity = String(0.25 + level * 0.6);
      }
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [active, getLevel]);

  const label =
    status === 'listening'
      ? 'סיים והקשב לתשובה'
      : status === 'speaking'
        ? 'עצור'
        : status === 'thinking'
          ? 'חושבת'
          : 'התחל לדבר';

  return (
    <button
      className={`mic-btn mic-${status}`}
      onClick={onClick}
      disabled={status === 'thinking'}
      aria-label={label}
      title={label}
    >
      <span ref={haloRef} className="mic-halo" aria-hidden="true" />
      <span className="mic-icon" aria-hidden="true">
        {status === 'listening' ? (
          <StopIcon />
        ) : status === 'thinking' ? (
          <Dots />
        ) : status === 'speaking' ? (
          <Wave />
        ) : (
          <MicIcon />
        )}
      </span>
    </button>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" stroke="none" />
      <path d="M5 11a7 7 0 0 0 14 0" strokeLinecap="round" />
      <line x1="12" y1="18" x2="12" y2="21" strokeLinecap="round" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2.5" />
    </svg>
  );
}

function Dots() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor">
      <circle className="dot d1" cx="5" cy="12" r="2" />
      <circle className="dot d2" cx="12" cy="12" r="2" />
      <circle className="dot d3" cx="19" cy="12" r="2" />
    </svg>
  );
}

function Wave() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line className="bar b1" x1="5" y1="9" x2="5" y2="15" />
      <line className="bar b2" x1="10" y1="6" x2="10" y2="18" />
      <line className="bar b3" x1="14" y1="6" x2="14" y2="18" />
      <line className="bar b4" x1="19" y1="9" x2="19" y2="15" />
    </svg>
  );
}
