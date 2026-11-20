// Real screenshots of the Paris app in shared-trip mode (test backend), sample trip, signed in as Ava.
import { chromium } from 'playwright';
const out = process.argv[2];
const base = 'http://localhost:8812/';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
async function session(viewport, scale) {
  const ctx = await b.newContext({ viewport, deviceScaleFactor: scale, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto(base + '?mock&today=2026-11-20');
  await p.fill('#startForm [name=name]', 'Bonjour, Paris');
  await p.fill('#startForm [name=me]', 'Ava');
  await p.fill('#startForm [name=code]', 'PARIS');
  await p.check('#startForm input[value=sample]', { force: true });
  await p.click('#startForm button[type=submit]');
  await p.waitForTimeout(1500);
  // use the sample's Ava instead of the extra guest the form adds
  await p.evaluate(() => { const extra = state.guests[state.guests.length - 1]; state.guests.pop(); state.packing = state.packing.filter((x) => x.guestId !== extra.id); commit(); setMe('g1'); localStorage.setItem(WELCOME_KEY + ':' + SYNC.tripId, '1'); render(); });
  await p.waitForTimeout(800);
  const url = p.url().split('#')[0] + (p.url().includes('today=') ? '' : '&today=2026-11-20');
  return { ctx, p, url };
}
async function shot(s, name, hash, prep) {
  await s.p.goto(s.url + '#' + hash); await s.p.waitForTimeout(1200);
  await s.p.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove()));
  if (prep) { await prep(s.p); await s.p.waitForTimeout(700); }
  await s.p.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove()));
  await s.p.screenshot({ path: `${out}/${name}.png` });
}
const scrollTo = (sel, off = 70) => async (p) => p.evaluate(([sel, off]) => { const el = document.querySelector(sel); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - off); }, [sel, off]);
const clash = async (p) => p.evaluate(() => { const it = state.itinerary.find((i) => i.title === 'Louvre'); const d = tripDays().find((x) => x.date.getDay() === 2); if (it && d) it.day = d.i; commit(); });

for (const [label, vp, sc] of [['d', { width: 1440, height: 900 }, 2], ['m', { width: 390, height: 844 }, 3]]) {
  const s = await session(vp, sc);
  await shot(s, `${label}-home`, 'home');
  await shot(s, `${label}-vote`, 'vote');
  await shot(s, `${label}-itinerary`, 'itinerary');
  await shot(s, `${label}-bookings`, 'bookings');
  await shot(s, `${label}-dashboard`, 'dashboard', label === 'm' ? scrollTo('.book-first', 80) : null);
  await shot(s, `${label}-budget`, 'budget');
  await shot(s, `${label}-budget-tax`, 'budget', scrollTo('.tax-card', 90));
  await shot(s, `${label}-pocket`, 'pocket');
  await shot(s, `${label}-pocket-customs`, 'pocket', scrollTo('#pocket-customs', 80));
  await shot(s, `${label}-packing`, 'packing');
  await shot(s, `${label}-dream`, 'dream');
  await shot(s, `${label}-memories`, 'memories');
  await shot(s, `${label}-itinerary-clash`, 'itinerary', clash);
  if (label === 'm') {
    await shot(s, 'm-whoareyou', 'home', async (p) => p.evaluate(() => askWhoAreYou()));
    const c2 = await b.newContext({ viewport: vp, deviceScaleFactor: sc, reducedMotion: 'reduce' }); const p2 = await c2.newPage();
    await p2.goto(base + '?mock&today=2026-11-20'); await p2.waitForTimeout(600);
    await p2.fill('#startForm [name=name]', 'Bonjour, Paris'); await p2.fill('#startForm [name=me]', 'Ava'); await p2.fill('#startForm [name=code]', 'PARIS');
    await p2.screenshot({ path: `${out}/m-start.png` });
  }
}
await b.close();
console.log('done');
