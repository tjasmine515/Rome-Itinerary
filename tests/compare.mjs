// Renders two builds of the planner screen by screen and checks they match.
// Usage: node tests/compare.mjs <before.html> <after.html> [outDir]
// Needs playwright, pixelmatch and pngjs (NODE_PATH can point at them).
import { chromium } from 'playwright';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const [beforePath, afterPath, outDir = 'tests/out'] = process.argv.slice(2);
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// Same random numbers and clock in both runs, so seed data (ids, dates) match.
const DETERMINISM = `(() => {
  let s = 42; Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const fixed = new Date('2026-10-20T10:00:00').getTime(); const D = Date;
  globalThis.Date = class extends D { constructor(...a) { super(...(a.length ? a : [fixed])); } static now() { return fixed; } };
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => {} } });
})();`;

// Live config would try to reach Firebase; drop it so the page runs on its own.
const offline = (html) => html
  .replace(/const BB_FIREBASE = \{[\s\S]*?\};/, 'const BB_FIREBASE = null;')
  .replace(/"firebase":\{[^}]*\}/, '"firebase":null');

const TABS = ['home', 'guests', 'dashboard', 'vote', 'itinerary', 'budget', 'bookings', 'packing', 'pocket', 'dream', 'memories'];
const SCENES = [
  ...TABS.map((t) => ({ name: t, hash: t })),
  { name: 'budget-split', hash: 'budget', click: '[data-action=budgetView][data-v=split]' },
  { name: 'sheet-expense', hash: 'budget', click: '[data-action=addExpense]' },
  { name: 'sheet-item', hash: 'itinerary', click: '[data-action=addItem]' },
  { name: 'sheet-booking', hash: 'bookings', click: '[data-action=addBooking]' },
  { name: 'sheet-more', hash: 'home', click: '[data-action=more]', mobileOnly: true },
  { name: 'reset-menu', hash: 'home', click: '[data-action=resetMenu]' },
];

async function capture(browser, file, live, viewport, query) {
  const html = live ? readFileSync(file, 'utf8') : offline(readFileSync(file, 'utf8'));
  const out = {};
  for (const sc of SCENES) {
    if (sc.mobileOnly && viewport.width > 900) continue;
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    await ctx.addInitScript(DETERMINISM);
    await ctx.route('**/*', (r) => (r.request().url().startsWith('http://t.test/') ? r.fulfill({ body: html, contentType: 'text/html' }) : r.abort()));
    const page = await ctx.newPage();
    await page.goto(`http://t.test/${query}#${sc.hash}`);
    await page.waitForTimeout(250);
    if (sc.click) { await page.locator(sc.click).locator('visible=true').first().click(); await page.waitForTimeout(500); }
    await page.evaluate(() => document.getAnimations().forEach((a) => a.finish()));
    await page.waitForTimeout(50);
    const dom = await page.evaluate(() => document.body.innerHTML.replace(/<script>[\s\S]*?<\/script>/g, '').replace(/style="[^"]*--rot[^"]*"/g, ''));
    const png = await page.screenshot({ fullPage: true, animations: 'disabled' });
    out[sc.name] = { dom, png };
    await ctx.close();
  }
  return out;
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let failures = 0;
for (const [label, viewport, query, live] of [
  ['phone', { width: 390, height: 844 }, '?today=2026-11-12', false],
  ['desktop', { width: 1280, height: 900 }, '?today=2026-11-12', false],
  ['start-screen', { width: 390, height: 844 }, '', true],
]) {
  let a, b;
  if (live) {
    const grab = async (f) => {
      const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' });
      await ctx.addInitScript(DETERMINISM);
      const html = readFileSync(f, 'utf8');
      await ctx.route('**/*', (r) => (r.request().url().startsWith('http://t.test/') ? r.fulfill({ body: html, contentType: 'text/html' }) : r.abort()));
      const page = await ctx.newPage();
      await page.goto('http://t.test/');
      await page.waitForTimeout(400);
      const res = { start: { dom: await page.evaluate(() => document.body.innerHTML.replace(/<script>[\s\S]*?<\/script>/g, '')), png: await page.screenshot({ fullPage: true }) } };
      await ctx.close();
      return res;
    };
    a = await grab(beforePath); b = await grab(afterPath);
  } else {
    a = await capture(browser, beforePath, false, viewport, query);
    b = await capture(browser, afterPath, false, viewport, query);
  }
  for (const name of Object.keys(a)) {
    // whitespace-only differences don't change what's shown (the pixel check backs this up)
    const squash = (h) => h.replace(/\s+/g, ' ').replace(/> </g, '><');
    const domSame = squash(a[name].dom) === squash(b[name].dom);
    const ia = PNG.sync.read(a[name].png), ib = PNG.sync.read(b[name].png);
    let px = -1;
    if (ia.width === ib.width && ia.height === ib.height) {
      const diff = new PNG({ width: ia.width, height: ia.height });
      px = pixelmatch(ia.data, ib.data, diff.data, ia.width, ia.height, { threshold: 0 });
      if (px) writeFileSync(resolve(outDir, `${label}-${name}-diff.png`), PNG.sync.write(diff));
    }
    const ok = domSame && px >= 0 && px <= 10; // a few pixels = chart anti-aliasing noise
    if (!ok) {
      failures++;
      writeFileSync(resolve(outDir, `${label}-${name}-before.html`), a[name].dom);
      writeFileSync(resolve(outDir, `${label}-${name}-after.html`), b[name].dom);
    }
    console.log(`${ok ? 'SAME ' : 'DIFF '} ${label.padEnd(12)} ${name.padEnd(14)} dom:${domSame ? 'same' : 'DIFFERENT'} pixels-changed:${px === -1 ? 'size differs' : px}`);
  }
}
await browser.close();
console.log(failures ? `\n${failures} screen(s) differ` : '\nAll screens identical');
process.exit(failures ? 1 : 0);
