import { useEffect, useRef } from 'react';
import mp4 from '../assets/studio/jackob-studio.mp4';
import webm from '../assets/studio/jackob-studio.webm';
import poster from '../assets/studio/jackob-studio-poster.jpg';

// Full-screen loop of the studio GIF (re-encoded as video: same frames, a fraction of the weight)
export default function StudioSection() {
  const videoRef = useRef(null);

  // Only play while on screen
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return undefined;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const io = new IntersectionObserver((entries) => {
      const e = entries[entries.length - 1]; // latest state wins when updates are batched
      if (e.isIntersecting && !reduce) v.play().catch(() => {});
      else v.pause();
    });
    io.observe(v);
    return () => io.disconnect();
  }, []);

  return (
    <section className="studio" aria-label="Jackob Buczynski in the studio with patchwork pieces">
      <video
        ref={videoRef}
        className="studio__video"
        poster={poster}
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
      >
        <source src={webm} type="video/webm" />
        <source src={mp4} type="video/mp4" />
      </video>
    </section>
  );
}
