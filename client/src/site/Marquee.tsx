interface Props {
  items: string[];
  reverse?: boolean;
}

/** An infinite moving text band — the kinetic "stripe" motif between sections. */
export default function Marquee({ items, reverse }: Props) {
  const row = [...items, ...items, ...items];
  return (
    <div className={`marquee ${reverse ? 'is-reverse' : ''}`} aria-hidden="true">
      <div className="marquee-track">
        {row.map((t, i) => (
          <span className="marquee-item" key={i}>
            {t}
            <span className="marquee-dot">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
