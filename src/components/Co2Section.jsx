import { useEffect, useRef, useState } from 'react';
import useScrollProgress, { clamp } from '../hooks/useScrollProgress.js';
import ImpactBar from './ImpactBar.jsx';
import { CloudIcon } from './Icons.jsx';

const CARS = 32;
const TONNES = 147;
const SAVING = 80;
const LANES = 4;
const PER_LANE = CARS / LANES;
const MAX_PUFFS = 420;

const CAR_COLOURS = ['#d8d4cc', '#2b2f36', '#8e9aa6', '#b23a2e', '#3d5a80', '#e9e6df', '#556b4f', '#c58b3a'];

// Pre-rendered soft smoke puff sprite
function makePuff() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(92,95,102,1)');
  grd.addColorStop(0.5, 'rgba(100,103,110,0.5)');
  grd.addColorStop(1, 'rgba(110,112,118,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return c;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Top-down car, drawn facing +x, centred on (0,0)
function drawCar(ctx, L, W, colour) {
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  roundRect(ctx, -L / 2 + 2, -W / 2 + 3, L, W, W * 0.32);
  ctx.fill();
  // wheels peeking out
  ctx.fillStyle = '#16181b';
  for (const wx of [-L * 0.3, L * 0.28]) {
    roundRect(ctx, wx - L * 0.09, -W / 2 - 1.2, L * 0.18, W + 2.4, 2);
    ctx.fill();
  }
  // body
  ctx.fillStyle = colour;
  roundRect(ctx, -L / 2, -W / 2, L, W, W * 0.32);
  ctx.fill();
  // cabin glass
  ctx.fillStyle = 'rgba(20,28,38,0.82)';
  roundRect(ctx, -L * 0.2, -W * 0.38, L * 0.46, W * 0.76, W * 0.18);
  ctx.fill();
  // roof
  ctx.fillStyle = colour;
  roundRect(ctx, -L * 0.12, -W * 0.33, L * 0.26, W * 0.66, W * 0.12);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  roundRect(ctx, -L * 0.12, -W * 0.33, L * 0.26, W * 0.2, W * 0.08);
  ctx.fill();
  // lights
  ctx.fillStyle = '#fff3c4';
  ctx.fillRect(L / 2 - 2.2, -W * 0.38, 2.2, W * 0.18);
  ctx.fillRect(L / 2 - 2.2, W * 0.2, 2.2, W * 0.18);
  ctx.fillStyle = '#d6372b';
  ctx.fillRect(-L / 2, -W * 0.38, 2, W * 0.16);
  ctx.fillRect(-L / 2, W * 0.22, 2, W * 0.16);
}

function Road({ progressRef }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const puff = makePuff();

    let W = 0, H = 0, dpr = 1, L = 50, CW = 24;
    let laneY = [];
    // lanes 0,1 drive right; lanes 2,3 drive left (two-way road)
    const lanes = Array.from({ length: LANES }, (_, i) => ({
      dir: i < 2 ? -1 : 1,
      speed: [0.15, 0.125, 0.135, 0.16][i], // fraction of road width per second
      cars: [],
    }));
    const smoke = [];
    let raf = 0, visible = false, last = performance.now(), dashOffset = 0;

    function resize() {
      const r = wrap.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width;
      H = r.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      L = clamp(W / 22, 30, 62);
      CW = L * 0.46;
      const top = H * 0.16, bottom = H * 0.84, lh = (bottom - top) / LANES;
      laneY = Array.from({ length: LANES }, (_, i) => top + lh * (i + 0.5));
      draw(0);
    }

    const span = () => W + L * 2;
    const minGap = () => span() / PER_LANE;

    // Car index k joins lane k % 4; the number wanted follows scroll position
    function wanted(lane) {
      const active = Math.round(clamp((progressRef.current - 0.06) / 0.8) * CARS);
      let n = 0;
      for (let k = 0; k < active; k++) if (k % LANES === lane) n++;
      return n;
    }
    function activeCount() {
      return Math.round(clamp((progressRef.current - 0.06) / 0.8) * CARS);
    }

    function step(dt) {
      lanes.forEach((lane, li) => {
        const v = lane.speed * W * lane.dir;
        // entry position: just off-screen on the side the lane comes from
        const entry = lane.dir > 0 ? -L : W + L;
        lane.cars.forEach((c) => {
          c.x += v * dt;
          c.wheel += dt;
          c.puffT -= dt;
          if (c.puffT <= 0 && !reduce && smoke.length < MAX_PUFFS) {
            c.puffT = 0.13 + Math.random() * 0.07;
            smoke.push({
              x: c.x - lane.dir * L * 0.55,
              y: laneY[li] + CW * 0.22 + (Math.random() - 0.5) * 4,
              vx: -lane.dir * (10 + Math.random() * 18) + v * 0.1,
              vy: (Math.random() - 0.5) * 14 - 5,
              r0: CW * 0.2,
              r1: CW * (1.1 + Math.random() * 0.6),
              t: 0,
              life: 1.6 + Math.random() * 0.7,
            });
          }
        });
        // wrap around, or leave the road if scrolled back up
        const want = wanted(li);
        lane.cars = lane.cars.filter((c) => {
          const out = lane.dir > 0 ? c.x > W + L : c.x < -L;
          if (!out) return true;
          if (lane.cars.length > want) return false;
          c.x = entry;
          return true;
        });
        // join traffic when there's room at the entry
        if (lane.cars.length < want) {
          // distances measured round the loop: from the entry to the car just ahead, and from the car behind
          const pos = lane.cars.map((c) => (lane.dir > 0 ? c.x - entry : entry - c.x));
          const ahead = pos.length ? Math.min(...pos) : Infinity;
          const behind = pos.length ? span() - Math.max(...pos) : Infinity;
          // with a backlog (fast scrolling) let cars squeeze in closer so traffic keeps up
          const backlog = want - lane.cars.length;
          const need = backlog > 1 ? Math.max(L * 1.35, minGap() * 0.5) : minGap();
          if (ahead >= need && behind >= L * 1.4) {
            const k = lane.cars.length * LANES + li;
            lane.cars.push({ x: entry, wheel: 0, puffT: Math.random() * 0.1, colour: CAR_COLOURS[(k * 3) % CAR_COLOURS.length] });
          }
        }
      });
      for (let i = smoke.length - 1; i >= 0; i--) {
        const s = smoke[i];
        s.t += dt;
        if (s.t > s.life) smoke.splice(i, 1);
        else {
          s.x += s.vx * dt;
          s.y += s.vy * dt;
        }
      }
    }

    function drawRoad(dt) {
      // verge / pavement
      ctx.fillStyle = '#e4e0d7';
      ctx.fillRect(0, 0, W, H);
      const top = H * 0.12, bottom = H * 0.88;
      ctx.fillStyle = '#d3cec3';
      ctx.fillRect(0, top - 6, W, 6);
      ctx.fillRect(0, bottom, W, 6);
      // asphalt
      ctx.fillStyle = '#34373c';
      ctx.fillRect(0, top, W, bottom - top);
      // edge lines
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillRect(0, top + 5, W, 2);
      ctx.fillRect(0, bottom - 7, W, 2);
      // centre double line
      const mid = (laneY[1] + laneY[2]) / 2;
      ctx.fillStyle = '#e8b64a';
      ctx.fillRect(0, mid - 3, W, 2);
      ctx.fillRect(0, mid + 1, W, 2);
      // lane dashes (static — the cars do the moving)
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      const dash = 26, gap = 22;
      for (const y of [(laneY[0] + laneY[1]) / 2, (laneY[2] + laneY[3]) / 2]) {
        for (let x = -((dashOffset) % (dash + gap)); x < W; x += dash + gap) ctx.fillRect(x, y - 1, dash, 2);
      }
    }

    function draw(dt) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawRoad(dt);
      // smoke under the cars that made it
      for (const s of smoke) {
        const k = s.t / s.life;
        const r = s.r0 + (s.r1 - s.r0) * Math.sqrt(k);
        ctx.globalAlpha = 0.6 * Math.pow(1 - k, 1.4);
        ctx.drawImage(puff, s.x - r, s.y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
      lanes.forEach((lane, li) => {
        lane.cars.forEach((c) => {
          ctx.save();
          ctx.translate(c.x, laneY[li]);
          if (lane.dir < 0) ctx.scale(-1, 1);
          drawCar(ctx, L, CW, c.colour);
          ctx.restore();
        });
      });
    }

    function seedStatic() {
      // reduced motion: place the wanted cars evenly, no driving
      lanes.forEach((lane, li) => {
        const n = wanted(li);
        lane.cars = Array.from({ length: n }, (_, j) => ({
          x: -L + (span() / PER_LANE) * (j + 0.5),
          wheel: 0,
          puffT: 0,
          colour: CAR_COLOURS[((j * LANES + li) * 3) % CAR_COLOURS.length],
        }));
      });
    }

    function frame(now) {
      raf = 0;
      if (!visible) return;
      const r = wrap.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) {
        // briefly off-screen (e.g. while a finished section collapses): skip, don't stop
        last = now;
        raf = requestAnimationFrame(frame);
        return;
      }
      const dt = Math.min((now - last) / 1000, 0.25); // keep real-time speed even on slow frames
      last = now;
      if (reduce) seedStatic();
      else step(dt);
      draw(dt);
      raf = requestAnimationFrame(frame);
    }

    const io = new IntersectionObserver((entries) => {
      const e = entries[entries.length - 1]; // latest state wins when updates are batched
      visible = e.isIntersecting;
      if (visible && !raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    });
    io.observe(wrap);
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    // test hook
    wrap.__road = { cars: () => lanes.reduce((n, l) => n + l.cars.length, 0), wanted: activeCount };

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
    };
  }, [progressRef]);

  return (
    <div ref={wrapRef} className="road" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}

export default function Co2Section() {
  const [done, setDone] = useState(false);
  const { ref, progress, progressRef } = useScrollProgress({ steps: 400, done });
  const cars = done ? CARS : Math.round(clamp((progress - 0.06) / 0.8) * CARS);
  useEffect(() => {
    if (!done && progress >= 0.995) setDone(true);
  }, [progress, done]);
  const tonnes = Math.round((TONNES * cars) / CARS);
  const barFill = done ? 1 : clamp((progress - 0.04) / 0.86);

  return (
    <section ref={ref} className={`scrolly scrolly--road co2 ${done ? 'is-done' : ''}`} data-theme="light" aria-labelledby="co2-title">
      <div className="scrolly__stage impact">
        <header className="impact__head">
          <div className="impact__label">
            <CloudIcon className="impact__icon" />
            <h2 id="co2-title" className="impact-title">
              147 tons of CO<sub>2</sub> less
            </h2>
          </div>
          <div className="impact__meta">
            <p className="impact__equiv">(equivalent to the annual emissions of ~32 cars)</p>
            <ImpactBar value={SAVING * barFill} label={SAVING} color="var(--co2)" />
          </div>
        </header>

        <Road progressRef={progressRef} />

        <p className="impact__counter" aria-live="polite">
          <span className="impact__count">{cars}</span>
          <span>of {CARS} cars</span>
          <span className="impact__sep" aria-hidden="true" />
          <span>
            {tonnes} tons of CO<sub>2</sub>
          </span>
        </p>
      </div>
    </section>
  );
}
