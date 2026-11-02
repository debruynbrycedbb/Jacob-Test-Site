// End-to-end check of the hero: WebGL renders, hover reveals + bulges the jacket,
// the menu opens with the right content. Run after `npm run build`:  npm test
import { preview } from 'vite';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { PNG } from 'pngjs';

// Uses a local `playwright` install if present, otherwise one found via NODE_PATH
const { chromium } = await import('playwright').catch(() => createRequire(import.meta.url)('playwright'));

const PORT = 4321;
const URL = `http://localhost:${PORT}/`;
const OUT = process.env.SHOTS || 'tests/screenshots';
mkdirSync(OUT, { recursive: true });

const server = await preview({ preview: { port: PORT, strictPort: true } });

let failures = 0;
const check = (ok, msg) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!ok) failures++;
};

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

// Average colourfulness of the jacket area (design = warm/saturated, plain = grey)
// Average colourfulness of the jacket's back panel (design = warm/saturated, plain = grey)
const saturationOf = async (page) => {
  const b = await page.locator('.jacket').boundingBox();
  const clip = { x: b.x + b.width * 0.36, y: b.y + b.height * 0.3, width: b.width * 0.28, height: b.height * 0.35 };
  const png = PNG.sync.read(await page.screenshot({ clip }));
  let sum = 0, n = 0;
  for (let i = 0; i < png.data.length; i += 16) {
    const r = png.data[i], g = png.data[i + 1], bl = png.data[i + 2];
    sum += Math.max(r, g, bl) - Math.min(r, g, bl); n++;
  }
  return { sat: sum / n, opaque: n };
};

for (const vp of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true },
]) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.isMobile ? 2 : 1,
    isMobile: !!vp.isMobile,
    hasTouch: !!vp.hasTouch,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('.jacket.is-ready', { timeout: 15000 });
  check(true, `[${vp.name}] WebGL jacket ready`);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${vp.name}-1-idle.png` });

  // No faint box: the canvas must be fully transparent away from the jacket.
  // Compare the corners of the image area with the canvas shown vs hidden.
  {
    const jb = await page.locator('.jacket').boundingBox();
    const corners = [
      { x: jb.x + jb.width * 0.03, y: jb.y + jb.height * 0.03 },
      { x: jb.x + jb.width * 0.88, y: jb.y + jb.height * 0.03 },
      { x: jb.x + jb.width * 0.03, y: jb.y + jb.height * 0.9 },
    ].map((c) => ({ ...c, width: jb.width * 0.09, height: jb.height * 0.07 }));
    const grab = async () => Promise.all(corners.map(async (clip) => PNG.sync.read(await page.screenshot({ clip })).data));
    const withCanvas = await grab();
    await page.addStyleTag({ content: '.jacket__canvas{visibility:hidden!important}' });
    const without = await grab();
    await page.addStyleTag({ content: '.jacket__canvas{visibility:visible!important}' });
    let maxDiff = 0;
    withCanvas.forEach((a, k) => { for (let i = 0; i < a.length; i++) maxDiff = Math.max(maxDiff, Math.abs(a[i] - without[k][i])); });
    check(maxDiff <= 3, `[${vp.name}] no visible box around the jacket (max pixel difference ${maxDiff})`);
  }

  const idle = await saturationOf(page);
  check(idle.sat < 25, `[${vp.name}] jacket starts as plain grey denim (colour ${idle.sat.toFixed(1)})`);

  // Hover / move across the back panel
  const box = await page.locator('.jacket').boundingBox();
  const cx = box.x + box.width * 0.5, cy = box.y + box.height * 0.45;
  if (vp.hasTouch) {
    await page.locator('.jacket').evaluate((el) => el.__jacket.pointAt(0.5, 0.55));
    await page.waitForTimeout(900);
  } else {
    await page.mouse.move(cx - 60, cy - 40);
    for (let i = 0; i < 30; i++) {
      await page.mouse.move(cx - 60 + i * 4, cy - 40 + Math.sin(i / 4) * 30);
      await page.waitForTimeout(30);
    }
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: `${OUT}/${vp.name}-2-hover.png` });
  const hovered = await saturationOf(page);
  check(hovered.sat > idle.sat * 1.25, `[${vp.name}] hover reveals the Sagrada design (colour ${idle.sat.toFixed(1)} -> ${hovered.sat.toFixed(1)})`);

  // Leave: the design stays unveiled (and finishes blooming across the whole back)
  if (!vp.hasTouch) await page.mouse.move(20, vp.height - 20);
  await page.waitForTimeout(3200);
  const after = await saturationOf(page);
  check(after.sat >= hovered.sat * 0.95, `[${vp.name}] design stays revealed after leaving (${after.sat.toFixed(1)})`);
  await page.screenshot({ path: `${OUT}/${vp.name}-2b-revealed.png` });

  // Menu
  await page.locator('.menu-toggle').click();
  await page.waitForTimeout(800);
  const expanded = await page.locator('.menu-toggle').getAttribute('aria-expanded');
  check(expanded === 'true', `[${vp.name}] menu toggle reports expanded`);
  const items = await page.locator('.menu__links a').allInnerTexts();
  check(items.length === 10 && items[8].toUpperCase() === 'REMADE BARCELONA', `[${vp.name}] menu shows the 10 links`);
  const contactText = (await page.locator('.menu__contact').innerText()).toUpperCase();
  check(contactText.includes('+48 728 835 557') && contactText.includes('HELLO@JACKOBBUCZYNSKI.COM') && contactText.includes('KOLEJOWA 11/13') && contactText.includes('10:00 - 15:00'), `[${vp.name}] contact details present`);
  await page.screenshot({ path: `${OUT}/${vp.name}-3-menu.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(700);
  check((await page.locator('.menu-toggle').getAttribute('aria-expanded')) === 'false', `[${vp.name}] Escape closes the menu`);

  // Scroll sections
  const scrollTo = async (sel, frac) => {
    await page.evaluate(([sel, frac]) => {
      const el = document.querySelector(sel);
      const top = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, top + (el.offsetHeight - window.innerHeight) * frac);
    }, [sel, frac]);
    await page.waitForTimeout(400);
  };

  await scrollTo('.earth', 0.05);
  await page.waitForSelector('.globe.is-ready', { timeout: 15000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${vp.name}-4-earth-a.png` });
  await scrollTo('.earth', 0.9);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${vp.name}-4-earth-b.png` });
  const kg = await page.locator('.earth__kg').innerText();
  check(kg.replace(/\s/g, '') === '+5,475KG', `[${vp.name}] earth counter reaches +5,475KG (${kg})`);

  await scrollTo('.water', 0.35);
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${OUT}/${vp.name}-5-pools-mid.png` });
  const midPools = await page.locator('.pool.is-on').count();
  check(midPools > 3 && midPools < 22, `[${vp.name}] pools appear progressively (${midPools} at 35%)`);
  await scrollTo('.water', 0.98);
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${OUT}/${vp.name}-5-pools-full.png` });
  check((await page.locator('.pool.is-on').count()) === 22, `[${vp.name}] all 22 pools filled at the end`);
  const bar = await page.locator('.water .impact-bar__fill').innerText();
  check(bar.includes('75%'), `[${vp.name}] water savings bar reaches 75%`);

  await scrollTo('.co2', 0.4);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/${vp.name}-6-road-mid.png` });
  await scrollTo('.co2', 0.98);
  await page.waitForTimeout(9000);
  await page.screenshot({ path: `${OUT}/${vp.name}-6-road-full.png` });
  const road = await page.locator('.road').evaluate((el) => ({ cars: el.__road.cars(), wanted: el.__road.wanted() }));
  check(road.wanted === 32, `[${vp.name}] road wants 32 cars at the end (${road.wanted})`);
  check(road.cars >= 28, `[${vp.name}] cars are on the road (${road.cars} driving)`);
  const co2bar = await page.locator('.co2 .impact-bar__fill').innerText();
  check(co2bar.includes('80%'), `[${vp.name}] CO2 savings bar reaches 80%`);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  check(!overflow, `[${vp.name}] no horizontal scroll`);
  check(errors.length === 0, `[${vp.name}] no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}

await browser.close();
await server.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
