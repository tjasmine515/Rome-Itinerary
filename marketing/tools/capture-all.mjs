// Every page of a city's app, on laptop and phone, as screen-sized and full-length shots.
// Serve the city's site with Firebase switched off (so the ?mock test backend works), then:
//   node capture-all.mjs <outDir> [baseUrl] [accessCode]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const [out, base = 'http://localhost:8812/', code = 'PARIS', tripName = 'Bonjour, Paris'] = process.argv.slice(2);
const TODAY = '2026-11-20';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

async function session(viewport, scale) {
  const ctx = await b.newContext({ viewport, deviceScaleFactor: scale, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(`${base}?mock&today=${TODAY}`);
  await p.fill('#startForm [name=name]', tripName);
  await p.fill('#startForm [name=me]', 'Ava');
  await p.fill('#startForm [name=code]', code);
  await p.check('#startForm input[value=sample]', { force: true });
  await p.click('#startForm button[type=submit]');
  await p.waitForTimeout(1500);
  // sign in as the sample trip's first traveler instead of the extra guest the form adds
  await p.evaluate(() => {
    const extra = new Set(state.guests.filter((g) => !/^g\d$/.test(g.id)).map((g) => g.id));
    state.guests = state.guests.filter((g) => !extra.has(g.id));
    state.packing = state.packing.filter((x) => !extra.has(x.guestId));
    commit(); setMe('g1'); localStorage.setItem(WELCOME_KEY + ':' + SYNC.tripId, '1'); render();
  });
  await p.waitForTimeout(2000);
  const n = await p.evaluate(() => state.guests.length);
  if (n !== 5) throw new Error(`expected the 5 sample travelers, got ${n}`);
  return { ctx, p, url: p.url().split('#')[0] + `&today=${TODAY}` };
}
const clean = (p) => p.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove()));

async function shoot(s, dir, name, hash, prep, { full = true } = {}) {
  if (!(await s.p.evaluate((h) => !!VIEWS[h], hash))) return; // this edition doesn't have that tab
  await s.p.goto('about:blank');
  await s.p.goto(`${s.url}#${hash}`);
  await s.p.waitForTimeout(1100);
  await clean(s.p);
  if (prep) { await prep(s.p); await s.p.waitForTimeout(700); await clean(s.p); }
  await s.p.screenshot({ path: `${dir}/${name}.png` });
  if (full) await s.p.screenshot({ path: `${dir}/full-page/${name}.png`, fullPage: true });
}

const PAGES = [
  ['01-home', 'home'], ['02-guest-list', 'guests'], ['03-trip-dashboard', 'dashboard'], ['04-group-picks', 'vote'],
  ['05-itinerary', 'itinerary'], ['06-budget-overview', 'budget'],
  ['07-budget-split', 'budget', (p) => p.click('[data-action=budgetView][data-v=split] >> visible=true')],
  ['08-booking-tracker', 'bookings'], ['09-packing-list', 'packing'], ['10-good-to-know', 'pocket'], ['10-trip-essentials', 'essentials'],
  ['11-dream-board', 'dream'], ['12-memories', 'memories'],
];
const SHEETS = [
  ['13-who-are-you', 'home', (p) => p.evaluate(() => askWhoAreYou())],
  ['14-log-an-expense', 'budget', (p) => p.click('[data-action=addExpense] >> visible=true')],
  ['15-suggest-an-idea', 'vote', (p) => p.click('[data-action=addActivity] >> visible=true')],
  ['16-closed-day-warning', 'itinerary', async (p) => {
    await p.evaluate(() => { const d = tripDays().find((x) => x.date.getDay() === 2); itemSheet(null, d.i); });
    await p.waitForTimeout(300);
    await p.fill('#sheetPanel [data-d=title]', 'Louvre');
  }],
  ['17-tourist-tax', 'budget', (p) => p.evaluate(() => { const el = document.querySelector('.tax-card'); scrollTo(0, el.getBoundingClientRect().top + scrollY - 80); })],
];

for (const [label, vp, sc] of [['laptop', { width: 1440, height: 900 }, 2], ['phone', { width: 390, height: 844 }, 3]]) {
  const dir = `${out}/${label}`;
  mkdirSync(`${dir}/full-page`, { recursive: true });
  const s = await session(vp, sc);
  for (const [name, hash, prep] of PAGES) await shoot(s, dir, name, hash, prep);
  for (const [name, hash, prep] of SHEETS) await shoot(s, dir, name, hash, prep, { full: false });
  if (label === 'phone') await shoot(s, dir, '18-more-menu', 'home', (p) => p.click('[data-action=more]'), { full: false });
  // the start screen, before any trip exists
  const c = await b.newContext({ viewport: vp, deviceScaleFactor: sc, reducedMotion: 'reduce' });
  const p = await c.newPage();
  await p.goto(`${base}?mock&today=${TODAY}`); await p.waitForTimeout(700);
  await p.fill('#startForm [name=name]', tripName); await p.fill('#startForm [name=me]', 'Ava');
  await p.screenshot({ path: `${dir}/00-start-screen.png` });
  await c.close(); await s.ctx.close();
  console.log('done', label);
}
await b.close();
