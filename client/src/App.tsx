import { useState } from 'react';
import EyeAvatar from './avatar/EyeAvatar';
import Menu from './components/Menu';
import StatusOverlay from './components/StatusOverlay';
import HudLayer from './components/HudLayer';
import { useConversation } from './hooks/useConversation';

export default function App() {
  const c = useConversation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showCaptions, setShowCaptions] = useState(false);

  return (
    <main className="app">
      <EyeAvatar getLevel={c.getLevel} />

      {/* The whole eye is the primary control: tap to start / stop talking. */}
      <button
        className={`eye-tap status-${c.status} ${c.live ? 'is-live' : ''}`}
        onClick={c.toggle}
        aria-label={c.active || c.live ? 'עצור שיחה' : 'התחל שיחה'}
      />

      <button className="hamburger" onClick={() => setMenuOpen(true)} aria-label="תפריט" title="תפריט">
        <span />
        <span />
        <span />
      </button>

      <HudLayer cards={c.cards} onClose={c.dismissCard} />

      <Menu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        active={c.active}
        live={c.live}
        status={c.status}
        wakeEnabled={c.wakeEnabled}
        wakeSupported={c.wakeSupported}
        showCaptions={showCaptions}
        onToggleConversation={c.toggle}
        onToggleLive={c.toggleLive}
        onToggleWake={() => c.setWakeEnabled((v) => !v)}
        onToggleCaptions={() => setShowCaptions((v) => !v)}
        onImage={(file) => void c.describeImage(file)}
        onClearMemory={c.clearMemory}
        onReset={c.reset}
      />

      <StatusOverlay
        status={c.status}
        live={c.live}
        lastUser={c.lastUser}
        lastReply={c.lastReply}
        error={c.error}
        visible={showCaptions}
      />

      {/* Surface errors even when captions are off, as a brief toast. */}
      {c.error && !showCaptions && <div className="toast-error">{c.error}</div>}

      {/* First-run gate: one tap unlocks audio (iOS) and arms the wake word. */}
      {!c.primed && (
        <div className="wake-gate" onClick={() => void c.prime()}>
          <div className="wake-gate-inner">
            <div className="wake-orb" aria-hidden="true" />
            <p className="wake-title">הקש כדי להעיר את אורקל</p>
            <p className="wake-sub">ואז פשוט דבר — אני מקשיב. הקש על העין כדי לעצור או להמשיך.</p>
          </div>
        </div>
      )}
    </main>
  );
}
