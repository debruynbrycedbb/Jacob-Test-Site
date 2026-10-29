# Jackob Buczynski — hero

React + Vite hero for the Jackob Buczynski site: a grey denim jacket floats over the Barcelona skyline, and hovering it reveals the hand-painted Sagrada Família back piece with a WebGL bulge under the cursor.

![Preview](docs/preview.jpg)

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
```

## How the jacket works

- `src/components/JacketReveal.jsx` — three.js on a single canvas (no React Three Fiber needed).
  - A ping-pong render target stores a "reveal trail": the brush grows while you hover and slowly heals after you leave.
  - The main shader magnifies the cloth around the cursor (the bulge), lights it with an analytic normal, and blends plain denim → Sagrada design along a noisy, frayed edge.
  - Rendered at device pixel ratio (max 2) with mipmaps + anisotropic filtering, so it stays sharp on retina screens.
  - Hover only counts on the jacket itself (alpha-tested), not its bounding box.
  - Keyboard: tab to the jacket to reveal the whole back piece. Touch: tap/drag on it.
  - Stops rendering when idle or off-screen; falls back to plain images if WebGL is unavailable.
- `src/components/shaders.js` — the GLSL.
- `src/assets/jacket-plain.webp` / `jacket-sagrada.webp` — the two pixel-aligned layers. The plain one was made from the Sagrada image by removing the painting and refilling it with matching denim texture, so the two line up exactly.

## Menu

Content lives in `src/menuData.js` (links, “Design your product”, contact, studio address, hours, socials). Replace the `#` links and the Instagram / Threads URLs with the real ones.

## Tests

`tests/hero.test.mjs` builds nothing itself — run `npm run build` first. It opens the site in Chromium at desktop and mobile sizes and checks that the jacket renders, hover reveals the design and fades again, the menu opens with all 10 links and contact details, Escape closes it, there's no horizontal scroll and no console errors.

```bash
npm i -D playwright && npx playwright install chromium
npm run build && npm test
```
