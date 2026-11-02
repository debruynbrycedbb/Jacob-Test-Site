import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { quadVert, trailFrag, jacketFrag } from './shaders.js';

const IMG_W = 1207;
const IMG_H = 1303;
const PAD = 0.06; // transparent margin so the bulge never clips at the silhouette
// Reveal tuning: brush size (fraction of jacket height) and how fast it paints per distance moved
const REVEAL_RADIUS = 0.24;
const REVEAL_PER_DISTANCE = 1.8;

// Reads a small alpha map so "hover" only counts when the pointer is on the jacket itself
function buildAlphaMap(img) {
  const w = 160;
  const h = Math.round((w * img.naturalHeight) / img.naturalWidth);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  return (u, v) => {
    if (u < 0 || u > 1 || v < 0 || v > 1) return 0;
    const x = Math.min(w - 1, Math.floor(u * w));
    const y = Math.min(h - 1, Math.floor((1 - v) * h));
    return data[(y * w + x) * 4 + 3] / 255;
  };
}

export default function JacketReveal({ plainSrc, designSrc, label }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const apiRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [fallbackHover, setFallbackHover] = useState(false);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: false,
        premultipliedAlpha: true,
        powerPreference: 'high-performance',
      });
    } catch (e) {
      setFallback(true);
      return;
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // pass texels through untouched
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geo = new THREE.PlaneGeometry(2, 2);

    // Trail ping-pong targets
    const rtOpts = {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
    };
    const TW = 320;
    const TH = Math.round(TW * ((IMG_H + IMG_H * 2 * PAD) / (IMG_W + IMG_W * 2 * PAD)));
    let rtRead = new THREE.WebGLRenderTarget(TW, TH, rtOpts);
    let rtWrite = new THREE.WebGLRenderTarget(TW, TH, rtOpts);
    [rtRead, rtWrite].forEach((rt) => {
      renderer.setRenderTarget(rt);
      renderer.clear();
    });
    renderer.setRenderTarget(null);

    const trailMat = new THREE.ShaderMaterial({
      vertexShader: quadVert,
      fragmentShader: trailFrag,
      uniforms: {
        uPrev: { value: rtRead.texture },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uPrevMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uAspect: { value: TW / TH },
        uRadius: { value: 0.21 },
        uStrength: { value: 0 },
        uDecay: { value: 0 },
        uOrigin: { value: new THREE.Vector2(0.5, 0.5) },
        uBloom: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
    });
    const trailScene = new THREE.Scene();
    trailScene.add(new THREE.Mesh(geo, trailMat));

    const mainMat = new THREE.ShaderMaterial({
      vertexShader: quadVert,
      fragmentShader: jacketFrag,
      uniforms: {
        uPlain: { value: null },
        uDesign: { value: null },
        uTrail: { value: rtWrite.texture },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uHover: { value: 0 },
        uTime: { value: 0 },
        uAspect: { value: 1 },
        uPad: { value: PAD },
        uBulge: { value: reduceMotion ? 0.12 : 0.26 },
        uRadius: { value: 0.2 },
      },
      transparent: true,
      blending: THREE.NoBlending,
      depthTest: false,
      depthWrite: false,
    });
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(geo, mainMat));

    // State
    const target = { x: 0.5, y: 0.5, hover: 0, inside: false };
    const mouse = { x: 0.5, y: 0.5 };
    const prevMouse = { x: 0.5, y: 0.5 };
    let force = 0; // keyboard / programmatic reveal
    let hoverEase = 0;
    let lastActive = performance.now();
    let alphaAt = () => 0;
    let visible = true;
    let raf = 0;
    let disposed = false;

    const resize = () => {
      const { width, height } = wrap.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      mainMat.uniforms.uAspect.value = width / height;
      wake();
    };

    const toUv = (clientX, clientY) => {
      const r = canvas.getBoundingClientRect();
      return { x: (clientX - r.left) / r.width, y: 1 - (clientY - r.top) / r.height };
    };

    const onPointerMove = (e) => {
      const p = toUv(e.clientX, e.clientY);
      target.x = p.x;
      target.y = p.y;
      const iu = (p.x - PAD) / (1 - 2 * PAD);
      const iv = (p.y - PAD) / (1 - 2 * PAD);
      target.inside = alphaAt(iu, iv) > 0.4;
      wake();
    };
    const onPointerLeave = () => {
      target.inside = false;
      wake();
    };

    // Load textures
    const loader = new THREE.TextureLoader();
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const setup = (tex) => {
      tex.colorSpace = THREE.NoColorSpace;
      tex.premultiplyAlpha = true;
      tex.anisotropy = maxAniso;
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.needsUpdate = true;
      return tex;
    };
    let loaded = 0;
    const onLoaded = () => {
      loaded += 1;
      if (loaded === 2 && !disposed) {
        alphaAt = buildAlphaMap(mainMat.uniforms.uPlain.value.image);
        setReady(true);
        wake();
      }
    };
    const plainTex = loader.load(plainSrc, (t) => { setup(t); onLoaded(); }, undefined, () => setFallback(true));
    const designTex = loader.load(designSrc, (t) => { setup(t); onLoaded(); }, undefined, () => setFallback(true));
    mainMat.uniforms.uPlain.value = plainTex;
    mainMat.uniforms.uDesign.value = designTex;

    const start = performance.now();
    let last = start;

    function frame(now) {
      raf = 0;
      if (disposed) return;
      if (!visible) return;
      const vr = wrap.getBoundingClientRect();
      if (vr.bottom < 0 || vr.top > window.innerHeight) {
        raf = requestAnimationFrame(frame); // never draw off-screen, but keep listening
        return;
      }
      const dt = Math.min((now - last) / 16.667, 3); // frames at 60fps
      last = now;

      const wantHover = target.inside ? 1 : 0;
      hoverEase += (wantHover - hoverEase) * (1 - Math.pow(1 - 0.09, dt));
      prevMouse.x = mouse.x;
      prevMouse.y = mouse.y;
      const k = 1 - Math.pow(1 - 0.2, dt);
      mouse.x += (target.x - mouse.x) * k;
      mouse.y += (target.y - mouse.y) * k;

      // Trail pass — the cursor gradually paints the design in; it never fades back
      const tu = trailMat.uniforms;
      tu.uBloom.value = 0;
      tu.uMouse.value.set(mouse.x, mouse.y);
      tu.uPrevMouse.value.set(prevMouse.x, prevMouse.y);
      // Reveal grows with the distance the cursor travels (not time), so it's the same for
      // fast and slow movers: roughly 10 sweeps across the back uncover the whole design.
      const moved = Math.hypot((mouse.x - prevMouse.x) * (TW / TH), mouse.y - prevMouse.y);
      tu.uRadius.value = force > 0 ? 0.6 : REVEAL_RADIUS;
      tu.uStrength.value = target.inside
        ? Math.min(0.3, moved * REVEAL_PER_DISTANCE) + 0.002 * dt
        : force > 0 ? 0.02 * dt : 0;
      tu.uDecay.value = 0;
      if (force > 0) {
        tu.uMouse.value.set(0.5, 0.5);
        tu.uPrevMouse.value.set(0.5, 0.5);
      }
      tu.uPrev.value = rtRead.texture;
      renderer.setRenderTarget(rtWrite);
      renderer.render(trailScene, camera);
      renderer.setRenderTarget(null);

      // Main pass
      const mu = mainMat.uniforms;
      mu.uTrail.value = rtWrite.texture;
      mu.uMouse.value.set(mouse.x, mouse.y);
      mu.uHover.value = hoverEase;
      mu.uTime.value = reduceMotion ? 0 : (now - start) / 1000;
      renderer.render(scene, camera);

      const tmp = rtRead;
      rtRead = rtWrite;
      rtWrite = tmp;

      if (target.inside || force > 0 || hoverEase > 0.002) lastActive = now;
      // keep animating ~3.5s after the last interaction so the reveal can heal, then sleep
      if (visible && now - lastActive < 3500) raf = requestAnimationFrame(frame);
    }

    function wake() {
      if (!raf && visible && !disposed) {
        lastActive = performance.now();
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    }

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    const io = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1]; // latest state wins when updates are batched
      visible = entry.isIntersecting;
      // take the WebGL layer out of compositing entirely while off-screen
      canvas.style.visibility = visible ? '' : 'hidden';
      if (visible) wake();
    });
    io.observe(wrap);

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onPointerLeave);
    wrap.addEventListener('pointerleave', onPointerLeave);

    apiRef.current = {
      reveal(on) {
        force = on ? 1 : 0;
        wake();
      },
      // test hook: drive the pointer programmatically
      pointAt(u, v) {
        target.x = u;
        target.y = v;
        target.inside = alphaAt((u - PAD) / (1 - 2 * PAD), (v - PAD) / (1 - 2 * PAD)) > 0.4;
        wake();
      },
    };
    wrap.__jacket = apiRef.current;

    resize();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerMove);
      document.documentElement.removeEventListener('pointerleave', onPointerLeave);
      wrap.removeEventListener('pointerleave', onPointerLeave);
      plainTex.dispose();
      designTex.dispose();
      rtRead.dispose();
      rtWrite.dispose();
      trailMat.dispose();
      mainMat.dispose();
      geo.dispose();
      renderer.dispose();
    };
  }, [plainSrc, designSrc]);

  const padPct = `${PAD * 100}%`;

  return (
    <div
      ref={wrapRef}
      className={`jacket ${ready ? 'is-ready' : ''} ${fallback ? 'is-fallback' : ''}`}
      role="img"
      aria-label={label}
      tabIndex={0}
      onFocus={() => apiRef.current?.reveal(true)}
      onBlur={() => apiRef.current?.reveal(false)}
      onPointerEnter={() => fallback && setFallbackHover(true)}
      onPointerLeave={() => fallback && setFallbackHover(false)}
      style={{ '--pad': padPct }}
    >
      {/* Static plain jacket shows until WebGL is ready (and is the no-WebGL fallback) */}
      <div className="jacket__still" aria-hidden="true">
        <img src={plainSrc} alt="" width={IMG_W} height={IMG_H} decoding="async" fetchpriority="high" />
        {fallback && (
          <img
            src={designSrc}
            alt=""
            className="jacket__still-design"
            style={{ opacity: fallbackHover ? 1 : 0 }}
          />
        )}
      </div>
      {!fallback && <canvas ref={canvasRef} className="jacket__canvas" aria-hidden="true" />}
    </div>
  );
}
