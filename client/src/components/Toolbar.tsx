import { useRef } from 'react';

interface Props {
  live: boolean;
  onToggleLive: () => void;
  wakeEnabled: boolean;
  wakeSupported: boolean;
  onToggleWake: () => void;
  onImage: (file: Blob) => void;
  onLink: (url: string) => void;
}

/**
 * Secondary controls around the mic: attach/capture an image for vision,
 * summarise a link, toggle live (Realtime) mode and the "Hey Oracle" wake word.
 */
export default function Toolbar({
  live,
  onToggleLive,
  wakeEnabled,
  wakeSupported,
  onToggleWake,
  onImage,
  onLink,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const pickImage = () => fileRef.current?.click();
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImage(file);
    e.target.value = '';
  };
  const askLink = () => {
    const url = window.prompt('הדבק קישור לסיכום:');
    if (url && url.trim()) onLink(url.trim());
  };

  return (
    <div className="toolbar" role="toolbar" aria-label="כלים">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={onFile}
      />

      <button className="tool-btn" onClick={pickImage} aria-label="צלם או צרף תמונה" title="צלם / צרף תמונה">
        <CameraIcon />
      </button>

      <button className="tool-btn" onClick={askLink} aria-label="סכם קישור" title="סכם קישור">
        <LinkIcon />
      </button>

      <button
        className={`tool-btn ${live ? 'is-on is-live' : ''}`}
        onClick={onToggleLive}
        aria-pressed={live}
        aria-label={live ? 'כבה מצב חי' : 'הפעל מצב חי (JARVIS)'}
        title={live ? 'מצב חי פעיל — כבה' : 'מצב חי (שיחה רציפה, JARVIS)'}
      >
        <LiveIcon />
      </button>

      {wakeSupported && (
        <button
          className={`tool-btn ${wakeEnabled ? 'is-on' : ''}`}
          onClick={onToggleWake}
          aria-pressed={wakeEnabled}
          aria-label={wakeEnabled ? 'כבה מילת השכמה' : 'הפעל "היי אורקל"'}
          title={wakeEnabled ? 'מילת השכמה פעילה — כבה' : 'מילת השכמה: "היי אורקל"'}
        >
          <WakeIcon />
        </button>
      )}
    </div>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M3 8a2 2 0 0 1 2-2h2l1.2-1.6a2 2 0 0 1 1.6-.8h4.4a2 2 0 0 1 1.6.8L19 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8Z" />
      <circle cx="12" cy="12.5" r="3.2" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <path d="M9 13a4 4 0 0 0 5.7.3l3-3a4 4 0 0 0-5.7-5.7L10.5 6" />
      <path d="M15 11a4 4 0 0 0-5.7-.3l-3 3a4 4 0 0 0 5.7 5.7L13.5 18" />
    </svg>
  );
}

function LiveIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7">
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
      <path d="M6.3 6.3a8 8 0 0 0 0 11.4M17.7 6.3a8 8 0 0 1 0 11.4" strokeLinecap="round" />
    </svg>
  );
}

function WakeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
      <circle cx="12" cy="12" r="4.5" />
    </svg>
  );
}
