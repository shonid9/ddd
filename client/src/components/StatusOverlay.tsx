import type { Status } from '../hooks/useConversation';

interface Props {
  status: Status;
  live: boolean;
  lastUser: string;
  lastReply: string;
  error: string | null;
  visible: boolean;
}

const STATUS_TEXT: Record<Status, string> = {
  idle: '',
  loading: 'מאתחל…',
  listening: 'מקשיב…',
  thinking: 'חושב…',
  speaking: 'מדבר…',
  error: '',
};

/**
 * A slim, single caption line docked to the very bottom — shows the assistant's
 * last reply (or the live status), clipped to two lines, never covering the eye.
 * Hidden unless the user turns captions on (errors aside).
 */
export default function StatusOverlay({ status, live, lastUser, lastReply, error, visible }: Props) {
  if (!visible) return null;

  const hint = live ? 'מצב חי — דבר חופשי' : STATUS_TEXT[status];
  const text = lastReply || lastUser || hint;
  if (!text && !error) return null;

  return (
    <div className="captions-bar" aria-live="polite">
      {error ? (
        <p className="captions-text is-error">{error}</p>
      ) : (
        <p className={`captions-text ${status === 'speaking' || live ? 'is-speaking' : ''}`}>{text}</p>
      )}
    </div>
  );
}
