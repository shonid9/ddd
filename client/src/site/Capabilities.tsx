const CAPS = [
  { n: '01', t: 'קול חי', d: 'שיחה רציפה בעברית — צחוקים, נשימות, ואפשר להפסיק אותה באמצע משפט.' },
  { n: '02', t: 'ידע בזמן אמת', d: 'מחוברת לאינטרנט. מזג אוויר, חדשות, מחירים, אירועים — יודעת עכשיו.' },
  { n: '03', t: 'ראייה', d: 'הראה לה תמונה או צילום מסך — היא מבינה, קוראת ומסבירה בעברית.' },
  { n: '04', t: 'זיכרון', d: 'זוכרת מי אתה, את ההעדפות וההקשר — בין שיחה לשיחה.' },
];

/** What she can do — kinetic numbered rows with wiping underlines (no icons). */
export default function Capabilities() {
  return (
    <section id="capabilities" className="section section-caps">
      <div className="section-head">
        <span className="section-eyebrow reveal">יכולות</span>
        <h2 className="section-title reveal">מה היא יודעת לעשות</h2>
      </div>

      <div className="caps-list" data-stagger>
        {CAPS.map((c) => (
          <article className="cap-row" key={c.n}>
            <span className="cap-n">{c.n}</span>
            <div className="cap-body">
              <h3 className="cap-t">{c.t}</h3>
              <p className="cap-d">{c.d}</p>
            </div>
            <span className="cap-line reveal-line" />
          </article>
        ))}
      </div>
    </section>
  );
}
