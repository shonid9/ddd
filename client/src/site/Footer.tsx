import { scrollToId } from '../hooks/useSmoothScroll';

export default function Footer() {
  return (
    <footer className="section section-footer">
      <div className="footer-top reveal">
        <span className="footer-eyebrow">מוכן כשתהיה</span>
        <button className="footer-cta" onClick={() => scrollToId('console')}>
          דבר עם אורקל
          <span className="footer-cta-line" />
        </button>
      </div>
      <div className="footer-bottom">
        <span className="footer-brand">ORACLE · אורקל</span>
        <span className="footer-meta">תודעת בינה בעברית · {new Date().getFullYear()}</span>
      </div>
    </footer>
  );
}
