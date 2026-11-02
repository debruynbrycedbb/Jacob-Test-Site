import { useEffect, useId, useRef, useState } from 'react';
import useScrollProgress, { clamp, useScrollHold } from '../hooks/useScrollProgress.js';
import ImpactBar from './ImpactBar.jsx';
import { DropIcon } from './Icons.jsx';

const POOLS = 22;
const LITRES_PER_POOL = 2.5; // million litres in an Olympic pool (50 × 25 × 2 m)
// time for the last pool to finish flooding (+ ropes) — matches the CSS transitions
const FILL_MS = 2600;

// Top-down Olympic pool (50 m × 25 m, 8 lanes). Water floods in from the starting end.
function Pool({ on, index }) {
  const uid = useId().replace(/:/g, '');
  const lanes = 8;
  const bx = 12, by = 12, bw = 196, bh = 96;
  const laneH = bh / lanes;

  return (
    <svg
      className={`pool ${on ? 'is-on' : ''}`}
      viewBox="0 0 220 120"
      style={{ '--d': `${(index % 3) * 40}ms` }}
      aria-hidden="true"
    >
      <defs>
        <clipPath id={`basin-${uid}`}>
          <rect x={bx} y={by} width={bw} height={bh} rx="2" />
        </clipPath>
        <linearGradient id={`water-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7fb2f2" />
          <stop offset="1" stopColor="#4a86d8" />
        </linearGradient>
        <pattern id={`caustic-${uid}`} width="40" height="24" patternUnits="userSpaceOnUse">
          <path
            d="M0 12c6-6 14-6 20 0s14 6 20 0M-10 0c6-6 14-6 20 0s14 6 20 0M-10 24c6-6 14-6 20 0s14 6 20 0"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.16"
            strokeWidth="1.2"
          />
        </pattern>
      </defs>

      {/* deck */}
      <rect width="220" height="120" rx="6" className="pool__deck" />
      {/* empty basin + floor lane markings */}
      <rect x={bx} y={by} width={bw} height={bh} rx="2" className="pool__basin" />
      {Array.from({ length: lanes }, (_, i) => {
        const cy = by + laneH * (i + 0.5);
        return (
          <g key={i} className="pool__marking">
            <rect x={bx + 10} y={cy - 0.9} width={bw - 20} height="1.8" />
            <rect x={bx + 10} y={cy - 3.5} width="1.8" height="7" />
            <rect x={bx + bw - 11.8} y={cy - 3.5} width="1.8" height="7" />
          </g>
        );
      })}

      {/* water floods in */}
      <g clipPath={`url(#basin-${uid})`}>
        <g className="pool__water">
          <rect x={bx - 4} y={by} width={bw + 4} height={bh} fill={`url(#water-${uid})`} opacity="0.8" />
          <path
            className="pool__front"
            d={`M${bx + bw} ${by} q8 12 0 24 t0 24 t0 24 t0 24 v0 h10 v-${bh} z`}
            fill={`url(#water-${uid})`}
            opacity="0.86"
          />
          <rect
            className="pool__caustics"
            x={bx - 40}
            y={by}
            width={bw + 80}
            height={bh}
            fill={`url(#caustic-${uid})`}
          />
        </g>
      </g>

      {/* lane ropes appear once full */}
      <g className="pool__ropes">
        {Array.from({ length: lanes - 1 }, (_, i) => (
          <line
            key={i}
            x1={bx}
            x2={bx + bw}
            y1={by + laneH * (i + 1)}
            y2={by + laneH * (i + 1)}
            stroke={i === 0 || i === lanes - 2 ? '#f08a7e' : '#ffffff'}
            strokeOpacity="0.85"
            strokeWidth="0.9"
            strokeDasharray="1.5 2.5"
          />
        ))}
      </g>

      {/* starting blocks */}
      {Array.from({ length: lanes }, (_, i) => (
        <rect key={i} x="4" y={by + laneH * (i + 0.5) - 2.5} width="6" height="5" rx="1" className="pool__block" />
      ))}
    </svg>
  );
}

export default function WaterSection() {
  const [done, setDone] = useState(false);
  const { ref, progress } = useScrollProgress({ steps: 400, done });
  // pools appear in order between 6% and 86% of the section; the bar reaches 100% at the end
  const filled = done ? POOLS : progress < 0.06 ? 0 : Math.min(POOLS, Math.ceil(((progress - 0.06) / 0.8) * POOLS));
  const barFill = done ? 1 : clamp((progress - 0.04) / 0.96);

  // Remember when the last pool started filling
  const allOnAt = useRef(0);
  useEffect(() => {
    if (filled === POOLS && !allOnAt.current) allOnAt.current = performance.now();
    if (filled < POOLS) allOnAt.current = 0;
  }, [filled]);

  // Finished = scrolled to the end, bar at 100% and every pool done filling
  useEffect(() => {
    if (done || filled < POOLS || progress < 0.995) return undefined;
    const wait = Math.max(0, allOnAt.current + FILL_MS - performance.now()) + 350;
    const t = setTimeout(() => setDone(true), wait);
    return () => clearTimeout(t);
  }, [done, filled, progress]);

  // Hold the page at the end of this section until it has finished
  useScrollHold(ref, !done);

  return (
    <section ref={ref} className={`scrolly scrolly--pools water ${done ? 'is-done' : ''}`} data-theme="light" aria-labelledby="water-title">
      <div className="scrolly__stage impact">
        <header className="impact__head">
          <div className="impact__label">
            <DropIcon className="impact__icon" />
            <h2 id="water-title" className="impact-title">55 million liters of water saved</h2>
          </div>
          <div className="impact__meta">
            <p className="impact__equiv">(equivalent to ~22 Olympic swimming pools)</p>
            <ImpactBar value={100 * barFill} label={Math.round(100 * barFill)} color="var(--water)" />
          </div>
        </header>

        <div className="pools" role="img" aria-label={`${filled} of ${POOLS} Olympic swimming pools filled`}>
          {Array.from({ length: POOLS }, (_, i) => (
            <Pool key={i} index={i} on={i < filled} />
          ))}
        </div>

        <p className="impact__counter" aria-live="polite">
          <span className="impact__count">{filled}</span>
          <span>of {POOLS} pools</span>
          <span className="impact__sep" aria-hidden="true" />
          <span>{(filled * LITRES_PER_POOL).toLocaleString('en-US', { maximumFractionDigits: 1 })} million liters</span>
        </p>
      </div>
    </section>
  );
}
