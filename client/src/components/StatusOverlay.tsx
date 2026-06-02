import type { Status } from '../hooks/useConversation';

interface Props {
  status: Status;
  lastUser: string;
  lastReply: string;
  error: string | null;
}

const STATUS_TEXT: Record<Status, string> = {
  idle: 'הקש על הכפתור ודבר איתי',
  listening: 'אני מקשיבה…',
  thinking: 'חושבת…',
  speaking: 'מדברת…',
  error: 'משהו השתבש',
};

/** Hebrew RTL captions: live status + the last exchange, shown over the avatar. */
export default function StatusOverlay({ status, lastUser, lastReply, error }: Props) {
  return (
    <section className="overlay" aria-live="polite">
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
    </section>
  );
}
