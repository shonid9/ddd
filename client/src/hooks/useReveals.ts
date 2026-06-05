import { useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Scroll-reveal choreography. Once active, any element marked `.reveal` rises
 * and fades in as it enters; `[data-stagger]` containers reveal their children
 * in sequence; `.reveal-line` elements wipe their underline in.
 */
export function useReveals(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('.reveal').forEach((el) => {
        gsap.from(el, {
          yPercent: 18,
          opacity: 0,
          duration: 1,
          ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 88%' },
        });
      });

      gsap.utils.toArray<HTMLElement>('[data-stagger]').forEach((group) => {
        gsap.from(group.children, {
          yPercent: 30,
          opacity: 0,
          duration: 0.9,
          stagger: 0.09,
          ease: 'power3.out',
          scrollTrigger: { trigger: group, start: 'top 82%' },
        });
      });

      gsap.utils.toArray<HTMLElement>('.reveal-line').forEach((el) => {
        gsap.from(el, {
          scaleX: 0,
          transformOrigin: 'right center',
          duration: 1.1,
          ease: 'power4.out',
          scrollTrigger: { trigger: el, start: 'top 90%' },
        });
      });
    });

    const t = setTimeout(() => ScrollTrigger.refresh(), 60);
    return () => {
      clearTimeout(t);
      ctx.revert();
    };
  }, [active]);
}
