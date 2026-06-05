import { useRef } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import type { Status } from '../hooks/useConversation';

interface Props {
  open: boolean;
  onClose: () => void;
  active: boolean;
  live: boolean;
  status: Status;
  wakeEnabled: boolean;
  wakeSupported: boolean;
  showCaptions: boolean;
  onToggleConversation: () => void;
  onToggleLive: () => void;
  onToggleWake: () => void;
  onToggleCaptions: () => void;
  onImage: (file: Blob) => void;
  onClearMemory: () => void;
  onReset: () => void;
}

/**
 * The single home for every secondary control — a glass slide-in panel behind
 * one hamburger button, keeping the main screen to just the eye.
 */
export default function Menu(props: Props) {
  const {
    open,
    onClose,
    active,
    live,
    status,
    wakeEnabled,
    wakeSupported,
    showCaptions,
    onToggleConversation,
    onToggleLive,
    onToggleWake,
    onToggleCaptions,
    onImage,
    onClearMemory,
    onReset,
  } = props;

  const fileRef = useRef<HTMLInputElement>(null);
  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImage(file);
    e.target.value = '';
    onClose();
  };

  const busy = status === 'listening' || status === 'thinking' || status === 'speaking';

  return (
    <>
      <div className={`menu-backdrop ${open ? 'is-open' : ''}`} onClick={onClose} aria-hidden={!open} />

      <aside className={`menu-panel ${open ? 'is-open' : ''}`} role="dialog" aria-label="תפריט" aria-hidden={!open}>
        <header className="menu-head">
          <span className="menu-brand">אורקל</span>
          <button className="menu-x" onClick={onClose} aria-label="סגור תפריט">
            ✕
          </button>
        </header>

        <Row
          label={live ? 'מצב חי פעיל' : active ? 'עצור שיחה' : 'התחל שיחה'}
          hint={live ? 'דבר חופשי' : busy ? 'מאזין…' : 'או אמור "היי אורקל"'}
          icon={<MicGlyph />}
          accent={active || live}
          onClick={() => {
            onToggleConversation();
            onClose();
          }}
        />

        <Toggle label="מצב חי (Realtime)" hint="שיחה רציפה, אפשר להפסיק באמצע" on={live} icon={<LiveGlyph />} onClick={onToggleLive} />

        {wakeSupported && (
          <Toggle label='מילת השכמה — "היי אורקל"' hint="הפעלה ללא ידיים" on={wakeEnabled} icon={<WakeGlyph />} onClick={onToggleWake} />
        )}

        <Toggle label="כתוביות" hint="הצגת טקסט בתחתית" on={showCaptions} icon={<TextGlyph />} onClick={onToggleCaptions} />

        <div className="menu-sep" />

        <Row label="הראה לי תמונה" hint="צלם או צרף — ואסביר מה רואים" icon={<CameraGlyph />} onClick={() => fileRef.current?.click()} />

        <Row
          label="נקה זיכרון"
          hint="שכח את כל מה שלמדתי עליך"
          icon={<EraseGlyph />}
          onClick={() => {
            onClearMemory();
            onClose();
          }}
        />
        <Row
          label="התחל שיחה מחדש"
          hint="איפוס ההיסטוריה הנוכחית"
          icon={<ResetGlyph />}
          onClick={() => {
            onReset();
            onClose();
          }}
        />

        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
      </aside>
    </>
  );
}

function Row({
  label,
  hint,
  icon,
  accent,
  onClick,
}: {
  label: string;
  hint?: string;
  icon: ReactNode;
  accent?: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`menu-item ${accent ? 'is-accent' : ''}`} onClick={onClick}>
      <span className="menu-ico" aria-hidden="true">
        {icon}
      </span>
      <span className="menu-text">
        <span className="menu-label">{label}</span>
        {hint && <span className="menu-hint">{hint}</span>}
      </span>
    </button>
  );
}

function Toggle({
  label,
  hint,
  on,
  icon,
  onClick,
}: {
  label: string;
  hint?: string;
  on: boolean;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className={`menu-item ${on ? 'is-accent' : ''}`} onClick={onClick} role="switch" aria-checked={on}>
      <span className="menu-ico" aria-hidden="true">
        {icon}
      </span>
      <span className="menu-text">
        <span className="menu-label">{label}</span>
        {hint && <span className="menu-hint">{hint}</span>}
      </span>
      <span className={`menu-switch ${on ? 'on' : ''}`} aria-hidden="true">
        <span className="menu-knob" />
      </span>
    </button>
  );
}

/* ---- glyphs ---- */
const S = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7 } as const;
function MicGlyph() {
  return (
    <svg {...S}>
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" stroke="none" />
      <path d="M5 11a7 7 0 0 0 14 0" strokeLinecap="round" />
      <line x1="12" y1="18" x2="12" y2="21" strokeLinecap="round" />
    </svg>
  );
}
function LiveGlyph() {
  return (
    <svg {...S}>
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
      <path d="M6.3 6.3a8 8 0 0 0 0 11.4M17.7 6.3a8 8 0 0 1 0 11.4" strokeLinecap="round" />
    </svg>
  );
}
function WakeGlyph() {
  return (
    <svg {...S}>
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="4.5" />
    </svg>
  );
}
function TextGlyph() {
  return (
    <svg {...S} strokeLinecap="round">
      <path d="M4 7h16M4 12h16M4 17h10" />
    </svg>
  );
}
function CameraGlyph() {
  return (
    <svg {...S}>
      <path d="M3 8a2 2 0 0 1 2-2h2l1.2-1.6a2 2 0 0 1 1.6-.8h4.4a2 2 0 0 1 1.6.8L19 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8Z" />
      <circle cx="12" cy="12.5" r="3.2" />
    </svg>
  );
}
function EraseGlyph() {
  return (
    <svg {...S} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 16 14 6l4 4-8 8H6z" />
      <path d="M8 20h12" />
    </svg>
  );
}
function ResetGlyph() {
  return (
    <svg {...S} strokeLinecap="round">
      <path d="M4 4v6h6" />
      <path d="M20 12a8 8 0 1 1-2.3-5.6L20 9" />
    </svg>
  );
}
