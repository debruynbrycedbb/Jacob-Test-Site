import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/**
 * Progress (0 → 1) of a tall "scrolly" section while its sticky stage is pinned.
 * 0 = section top reaches the viewport top, 1 = section bottom reaches the viewport bottom.
 *
 * Play-once: when `done` is true the section freezes at progress 1 and collapses its
 * scroll runway to a single screen, adjusting scroll so nothing jumps. Scrolling back
 * up then passes it like a normal section instead of replaying the animation.
 *
 * Returns { ref, progress, progressRef }. progressRef updates every frame without a
 * re-render (for canvas / WebGL loops); `progress` state is quantised.
 */
export default function useScrollProgress({ steps = 400, done = false } = {}) {
  const ref = useRef(null);
  const progressRef = useRef(0);
  const heightRef = useRef(0);
  const scrollYRef = useRef(0);
  const doneRef = useRef(done);
  const [progress, setProgress] = useState(0);
  doneRef.current = done;

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      heightRef.current = el.offsetHeight;
      scrollYRef.current = window.scrollY;
      if (doneRef.current) return;
      const r = el.getBoundingClientRect();
      const total = Math.max(1, r.height - window.innerHeight);
      const p = clamp(-r.top / total);
      progressRef.current = p;
      setProgress(Math.round(p * steps) / steps);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [steps]);

  // Collapse once done, compensating the scroll position before the browser paints
  useLayoutEffect(() => {
    if (!done) return;
    progressRef.current = 1;
    setProgress(1);
    const el = ref.current;
    if (!el) return;
    const before = heightRef.current;
    const after = el.offsetHeight;
    const delta = before - after;
    // Use the scroll position from just before the collapse: if the page got shorter the
    // browser may already have clamped window.scrollY, and subtracting from that overshoots.
    const sectionTop = el.getBoundingClientRect().top + window.scrollY;
    if (delta > 0 && scrollYRef.current > sectionTop) {
      window.scrollTo({ top: Math.max(sectionTop, scrollYRef.current - delta), behavior: 'instant' });
    }
    heightRef.current = after;
  }, [done]);

  return { ref, progress, progressRef };
}

/**
 * Holds the page at the end of a section (no scrolling further down) while `locked` is true.
 * Scrolling back up stays possible.
 */
export function useScrollHold(ref, locked) {
  useEffect(() => {
    if (!locked) return undefined;
    const limit = () => {
      const el = ref.current;
      if (!el) return Infinity;
      const top = el.getBoundingClientRect().top + window.scrollY;
      return top + el.offsetHeight - window.innerHeight;
    };
    const atLimit = () => window.scrollY >= limit() - 2;

    const onWheel = (e) => {
      if (e.deltaY > 0 && atLimit()) e.preventDefault();
    };
    let touchY = 0;
    const onTouchStart = (e) => {
      touchY = e.touches[0].clientY;
    };
    const onTouchMove = (e) => {
      const dy = touchY - e.touches[0].clientY; // > 0 = finger up = scroll down
      if (dy > 0 && atLimit()) e.preventDefault();
    };
    const onKey = (e) => {
      const downKeys = [' ', 'Spacebar', 'PageDown', 'ArrowDown', 'End'];
      if (downKeys.includes(e.key) && !e.shiftKey && atLimit()) {
        const t = e.target;
        if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
        e.preventDefault();
      }
    };
    // Scrollbar drags and momentum can still overshoot: pull back to the limit
    const onScroll = () => {
      const l = limit();
      if (window.scrollY > l + 1) window.scrollTo({ top: l, behavior: 'instant' });
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll);
    };
  }, [ref, locked]);
}

export { clamp };
