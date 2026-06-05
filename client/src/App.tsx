import { useState } from 'react';
import EyeAvatar from './avatar/EyeAvatar';
import Menu from './components/Menu';
import StatusOverlay from './components/StatusOverlay';
import HudLayer from './components/HudLayer';
import Loader from './site/Loader';
import Hero from './site/Hero';
import Marquee from './site/Marquee';
import Capabilities from './site/Capabilities';
import Console from './site/Console';
import Memory from './site/Memory';
import Footer from './site/Footer';
import { useConversation } from './hooks/useConversation';
import { useSmoothScroll } from './hooks/useSmoothScroll';
import { useReveals } from './hooks/useReveals';

export default function App() {
  const c = useConversation();
  const [loaded, setLoaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showCaptions, setShowCaptions] = useState(false);

  useSmoothScroll(loaded);
  useReveals(loaded);

  return (
    <div className="app">
      {/* Persistent living eye behind the whole site. */}
      <EyeAvatar getLevel={c.getLevel} />
      <div className="eye-scrim" aria-hidden="true" />

      {!loaded && <Loader onDone={() => setLoaded(true)} />}

      <button className="hamburger" onClick={() => setMenuOpen(true)} aria-label="תפריט" title="תפריט">
        <span />
        <span />
        <span />
      </button>

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

      <HudLayer cards={c.cards} onClose={c.dismissCard} />

      <main className={`site ${loaded ? 'is-ready' : ''}`}>
        <Hero />
        <Marquee items={['בינה', 'קול', 'ידע', 'ראייה', 'זיכרון', 'עברית']} />
        <Capabilities />
        <Marquee items={['ORACLE', 'REAL-TIME', 'VOICE', 'MEMORY', 'VISION']} reverse />
        <Console c={c} />
        <Memory c={c} />
        <Footer />
      </main>

      <StatusOverlay
        status={c.status}
        live={c.live}
        lastUser={c.lastUser}
        lastReply={c.lastReply}
        error={c.error}
        visible={showCaptions}
      />
      {c.error && !showCaptions && <div className="toast-error">{c.error}</div>}
    </div>
  );
}
