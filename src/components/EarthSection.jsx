import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import useScrollProgress, { clamp } from '../hooks/useScrollProgress.js';
import colorMap from '../assets/earth/earth-color.jpg';
import bumpMap from '../assets/earth/earth-bump.jpg';
import waterMap from '../assets/earth/earth-water.jpg';
import cloudMap from '../assets/earth/earth-clouds.jpg';

const TOTAL_KG = 5475;

const atmosphereVert = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const atmosphereFrag = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    // back faces: strongest right at the planet's limb, fading to nothing at the halo's edge
    float facing = clamp(-dot(vNormal, vView), 0.0, 1.0);
    float glow = pow(facing, 3.2) * 0.85;
    gl_FragColor = vec4(vec3(0.38, 0.62, 1.0) * glow, glow);
  }
`;

function Globe({ progressRef }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    } catch (e) {
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0, 4.4);

    // Sunlight from the upper left, soft fill so the night side isn't pitch black
    const sun = new THREE.DirectionalLight(0xffffff, 2.6);
    sun.position.set(-4, 2.2, 3.2);
    scene.add(sun);
    scene.add(new THREE.AmbientLight(0x8fa8d8, 0.55));

    const tilt = new THREE.Group();
    tilt.rotation.z = THREE.MathUtils.degToRad(23.4);
    scene.add(tilt);

    const loader = new THREE.TextureLoader();
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const tex = (src, srgb) => {
      const t = loader.load(src, () => {
        loaded += 1;
        if (loaded === 4) {
          setReady(true);
          render(true);
        }
      });
      t.anisotropy = maxAniso;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    let loaded = 0;

    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(1, 160, 160),
      new THREE.MeshPhongMaterial({
        map: tex(colorMap, true),
        bumpMap: tex(bumpMap),
        bumpScale: 6,
        specularMap: tex(waterMap),
        specular: new THREE.Color(0x3a4a5a),
        shininess: 18,
      })
    );
    tilt.add(earth);

    const clouds = new THREE.Mesh(
      new THREE.SphereGeometry(1.012, 128, 128),
      new THREE.MeshPhongMaterial({
        color: 0xffffff,
        alphaMap: tex(cloudMap),
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      })
    );
    tilt.add(clouds);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 96, 96),
      new THREE.ShaderMaterial({
        vertexShader: atmosphereVert,
        fragmentShader: atmosphereFrag,
        side: THREE.BackSide,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    scene.add(atmosphere);

    let rot = 0;
    let raf = 0;
    let visible = false;
    let disposed = false;

    function resize() {
      const { width, height } = wrap.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      render(true);
    }

    function render(force) {
      if (disposed) return;
      const p = progressRef.current;
      // 1.5 turns over the section, smoothed so scroll wheels don't feel steppy
      const target = -0.6 + p * Math.PI * 3;
      const prev = rot;
      rot += (target - rot) * (force ? 1 : 0.12);
      earth.rotation.y = rot;
      clouds.rotation.y = rot * 1.08 + 0.4;
      const s = 0.82 + 0.18 * clamp(p * 2.2);
      tilt.scale.setScalar(s);
      atmosphere.scale.setScalar(s);
      renderer.render(scene, camera);
      return Math.abs(target - prev) > 0.0005;
    }

    const onScreen = () => {
      const r = wrap.getBoundingClientRect();
      return r.bottom > 0 && r.top < window.innerHeight;
    };

    function loop() {
      raf = 0;
      if (!visible || disposed) return;
      if (!onScreen()) {
        raf = requestAnimationFrame(loop); // skip drawing, keep listening
        return;
      }
      render(false);
      raf = requestAnimationFrame(loop);
    }

    const io = new IntersectionObserver((entries) => {
      const e = entries[entries.length - 1]; // latest state wins when updates are batched
      visible = e.isIntersecting;
      // take the WebGL layer out of compositing entirely while off-screen
      canvas.style.visibility = visible ? '' : 'hidden';
      if (visible && !raf) raf = requestAnimationFrame(loop);
    });
    io.observe(wrap);
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          Object.values(o.material).forEach((v) => v && v.isTexture && v.dispose());
          o.material.dispose();
        }
      });
      renderer.dispose();
    };
  }, [progressRef]);

  return (
    <div ref={wrapRef} className={`globe ${ready ? 'is-ready' : ''}`} aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}

export default function EarthSection() {
  const [done, setDone] = useState(false);
  const { ref, progress, progressRef } = useScrollProgress({ steps: 600, done });
  // Count up over the middle of the section; once finished it stays put
  const kg = done ? TOTAL_KG : Math.round(TOTAL_KG * clamp((progress - 0.1) / 0.65));
  useEffect(() => {
    if (!done && progress >= 0.995) setDone(true);
  }, [progress, done]);

  return (
    <section ref={ref} className={`scrolly earth ${done ? 'is-done' : ''}`} aria-labelledby="earth-title">
      <div className="scrolly__stage earth__stage">
        <div className="earth__stars" aria-hidden="true" />
        <h2 id="earth-title" className="impact-title earth__title">
          What have we done for the planet?
        </h2>
        <Globe progressRef={progressRef} />
        <div className="earth__copy">
          <p className="earth__lede">
            Since 2017, we have given <strong>a second life to clothes with a total weight of</strong>
          </p>
          <p className="earth__kg" aria-label={`plus ${TOTAL_KG.toLocaleString('en-US')} kilograms`}>
            +{kg.toLocaleString('en-US')}KG
          </p>
        </div>
      </div>
    </section>
  );
}
