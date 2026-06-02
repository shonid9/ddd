import type { Status } from '../hooks/useConversation';

interface Props {
  status: Status;
  lastUser: string;
  lastReply: string;
  error: string | null;
  visible: boolean;
}

const STATUS_TEXT: Record<Status, string> = {
  idle: 'הקש על הכפתור ודבר איתי',
  listening: 'מקשיב…',
  thinking: 'חושב…',
  speaking: 'מדבר…',
  error: 'משהו השתבש',
};

/**
 * Hebrew RTL captions docked to the side (desktop) / bottom (phones) so they
 * never sit over the eye. Can be hidden entirely for a clean view.
 */
export default function StatusOverlay({ status, lastUser, lastReply, error, visible }: Props) {
  if (!visible) return null;

  return (
    <section className="overlay" aria-live="polite">
      <div className="caption-panel">
        {lastUser && (
          <p className="bubble bubble-user">
            <span className="bubble-label">אתה</span>
            {lastUser}
          </p>
        )}
        {lastReply && status !== 'thinking' && (
          <p className="bubble bubble-oracle">
            <span className="bubble-label">אורקל</span>
            {lastReply}
          </p>
        )}

        <p className={`status status-${status}`}>
          {status === 'error' && error ? error : STATUS_TEXT[status]}
        </p>
      </div>
    </section>
  );
}
