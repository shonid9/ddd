import type { Conversation } from '../hooks/useConversation';

/** "What I remember about you" — the account/memory section. */
export default function Memory({ c }: { c: Conversation }) {
  const has = c.facts.length > 0;
  return (
    <section id="memory" className="section section-memory">
      <div className="section-head">
        <span className="section-eyebrow reveal">זיכרון</span>
        <h2 className="section-title reveal">מה אני יודע עליך</h2>
      </div>

      {has ? (
        <>
          <ul className="mem-list" data-stagger>
            {c.facts.map((f, i) => (
              <li className="mem-chip" key={i}>
                {f}
              </li>
            ))}
          </ul>
          <button className="btn btn-ghost reveal" onClick={c.clearMemory}>
            נקה את הזיכרון
          </button>
        </>
      ) : (
        <p className="mem-empty reveal">
          עוד לא סיפרת לי עליך כלום. דבר איתי — ואני אזכור את מה שחשוב, לפעם הבאה.
        </p>
      )}
    </section>
  );
}
