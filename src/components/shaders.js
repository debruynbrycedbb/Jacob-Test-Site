// Shared full-screen-quad vertex shader
export const quadVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Ping-pong "trail" pass: stores how much of the design is revealed at every point.
// Each frame it fades a little and stamps a soft brush along the pointer's path,
// so the reveal grows while you hover and slowly heals when you leave.
export const trailFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uPrev;
  uniform vec2 uMouse;
  uniform vec2 uPrevMouse;
  uniform float uAspect;
  uniform float uRadius;
  uniform float uStrength;
  uniform float uDecay;

  float segDist(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    return length(pa - ba * h);
  }

  void main() {
    float prev = texture2D(uPrev, vUv).r;
    prev = max(prev - uDecay, 0.0);

    vec2 asp = vec2(uAspect, 1.0);
    float d = segDist(vUv * asp, uPrevMouse * asp, uMouse * asp);
    float stamp = (1.0 - smoothstep(0.0, uRadius, d));
    stamp *= stamp;

    float v = min(prev + stamp * uStrength, 1.0);
    gl_FragColor = vec4(v, 0.0, 0.0, 1.0);
  }
`;

// Main jacket pass: bulge distortion + lighting around the cursor,
// organic noisy reveal from plain denim to the Sagrada Família back piece.
export const jacketFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;

  uniform sampler2D uPlain;
  uniform sampler2D uDesign;
  uniform sampler2D uTrail;
  uniform vec2 uMouse;      // canvas uv
  uniform float uHover;     // 0..1 eased
  uniform float uTime;
  uniform float uAspect;    // canvas width / height
  uniform float uPad;       // transparent padding around the image (uv units)
  uniform float uBulge;     // bulge strength
  uniform float uRadius;    // bulge radius (in height units)

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 11.7; a *= 0.5; }
    return s;
  }

  vec4 sampleImg(sampler2D t, vec2 imgUv) {
    if (imgUv.x < 0.0 || imgUv.x > 1.0 || imgUv.y < 0.0 || imgUv.y > 1.0) return vec4(0.0);
    return texture2D(t, imgUv);
  }

  void main() {
    vec2 asp = vec2(uAspect, 1.0);
    vec2 d = (vUv - uMouse) * asp;
    float r = length(d);
    float R = uRadius;
    float s = clamp(r / R, 0.0, 1.0);
    float f = 1.0 - s * s * (3.0 - 2.0 * s);         // 1 at cursor -> 0 at radius
    float b = uBulge * uHover;

    // Magnify towards the cursor: sample closer to the centre => surface swells outwards
    vec2 p = uMouse + (vUv - uMouse) * (1.0 - b * f);

    // Height field h = b * f^2 -> analytic normal for soft lighting on the swell
    float dfdr = -6.0 * s * (1.0 - s) / R;
    float dhdr = 2.0 * f * dfdr * b;
    vec2 grad = r > 1e-5 ? dhdr * d / r : vec2(0.0);
    vec3 n = normalize(vec3(-grad * 0.22, 1.0));
    vec3 L = normalize(vec3(-0.45, 0.55, 0.75));
    float shade = dot(n, L) - L.z;                   // 0 on flat cloth
    vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
    float spec = pow(max(dot(n, H), 0.0), 40.0) - pow(H.z, 40.0);

    vec2 imgUv = (p - uPad) / (1.0 - 2.0 * uPad);
    vec4 plain = sampleImg(uPlain, imgUv);
    vec4 design = sampleImg(uDesign, imgUv);

    // Organic reveal edge
    float t = texture2D(uTrail, p).r;
    float nz = fbm(p * asp * 9.0 + vec2(uTime * 0.035, -uTime * 0.02));
    float v = t + (nz - 0.5) * 0.7;
    float m = smoothstep(0.4, 0.62, v);
    float rim = smoothstep(0.3, 0.4, v) * (1.0 - m);

    vec4 col = mix(plain, design, m);                 // premultiplied colours
    col.rgb *= 1.0 + clamp(shade, -0.2, 0.2) * 1.4;
    col.rgb += col.a * (max(spec, 0.0) * 0.22);
    col.rgb += col.a * rim * vec3(0.95, 0.62, 0.28) * 0.14;   // warm thread of light at the edge

    gl_FragColor = col;
  }
`;
