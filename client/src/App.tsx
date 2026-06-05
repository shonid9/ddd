import { useState } from 'react';
import EyeAvatar from './avatar/EyeAvatar';
import MicButton from './components/MicButton';
import StatusOverlay from './components/StatusOverlay';
import Toolbar from './components/Toolbar';
import HudLayer from './components/HudLayer';
import { useConversation } from './hooks/useConversation';

export default function App() {
  const {
    status,
    live,
    wakeEnabled,
    wakeSupported,
    lastUser,
    lastReply,
    error,
    cards,
    toggle,
    toggleLive,
    setWakeEnabled,
    dismissCard,
    describeImage,
    summarizeUrl,
    reset,
    getLevel,
  } = useConversation();
  const [showCaptions, setShowCaptions] = useState(true);

  return (
    <main className="app">
      <EyeAvatar getLevel={getLevel} />

      <header className="topbar">
        <h1 className="brand">אורקל</h1>
        <div className="topbar-actions">
          <button
            className={`icon-btn ${showCaptions ? 'is-on' : ''}`}
            onClick={() => setShowCaptions((v) => !v)}
            aria-pressed={showCaptions}
            aria-label={showCaptions ? 'הסתר כתוביות' : 'הצג כתוביות'}
            title={showCaptions ? 'הסתר כתוביות' : 'הצג כתוביות'}
          >
            {showCaptions ? <EyeOpenIcon /> : <EyeOffIcon />}
          </button>
          <button className="reset-btn" onClick={reset} aria-label="התחל שיחה מחדש" title="התחל מחדש">
            איפוס
          </button>
        </div>
      </header>

      <HudLayer cards={cards} onClose={dismissCard} />

      <StatusOverlay
        status={status}
        live={live}
        lastUser={lastUser}
        lastReply={lastReply}
        error={error}
        visible={showCaptions}
      />

      <footer className="controls">
        <Toolbar
          live={live}
          onToggleLive={toggleLive}
          wakeEnabled={wakeEnabled}
          wakeSupported={wakeSupported}
          onToggleWake={() => setWakeEnabled((v) => !v)}
          onImage={(file) => void describeImage(file)}
          onLink={(url) => void summarizeUrl(url)}
        />
        <MicButton status={status} live={live} onClick={toggle} getLevel={getLevel} />
      </footer>
    </main>
  );
}

function EyeOpenIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a13.2 13.2 0 0 1-2.16 2.97" />
      <path d="M6.06 6.06C3.43 7.74 2 11 2 11s3.5 7 10 7a9.3 9.3 0 0 0 4.94-1.06" />
      <path d="m9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}
