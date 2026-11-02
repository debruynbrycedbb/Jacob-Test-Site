import { useEffect, useRef, useState } from 'react';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/**
 * Progress (0 → 1) of a tall "scrolly" section while its sticky stage is pinned.
 * 0 = section top reaches the viewport top, 1 = section bottom reaches the viewport bottom.
 *
 * Returns [ref, progress, progressRef]. progressRef is updated every frame without re-rendering,
 * for canvases / WebGL loops; `progress` state is quantised so React re-renders stay cheap.
 */
export default function useScrollProgress(steps = 400) {
  const ref = useRef(null);
  const progressRef = useRef(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
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

  return [ref, progress, progressRef];
}

export { clamp };
