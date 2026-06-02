import EyeAvatar from './avatar/EyeAvatar';
import MicButton from './components/MicButton';
import StatusOverlay from './components/StatusOverlay';
import { useConversation } from './hooks/useConversation';

export default function App() {
  const { status, lastUser, lastReply, error, toggle, reset, getLevel } = useConversation();

  return (
    <main className="app">
      <EyeAvatar getLevel={getLevel} />

      <header className="topbar">
        <h1 className="brand">אורקל</h1>
        <button
          className="reset-btn"
          onClick={reset}
          aria-label="התחל שיחה מחדש"
          title="התחל מחדש"
        >
          איפוס
        </button>
      </header>

      <StatusOverlay status={status} lastUser={lastUser} lastReply={lastReply} error={error} />

      <footer className="controls">
        <MicButton status={status} onClick={toggle} getLevel={getLevel} />
      </footer>
    </main>
  );
}
