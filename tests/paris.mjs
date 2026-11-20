// Clicks through the Paris build: shared trip link, two people editing at once,
// tourist tax, tipping and closed-venue warnings. Serve dist/paris first, e.g.
//   (cd dist/paris && python3 -m http.server 8811) & node tests/paris.mjs
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://localhost:8811/';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const errs = [];
const A = await ctx.newPage(); A.on('pageerror', (e) => errs.push(e.message));
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
// --- start a shared trip (test backend: two tabs sync through this browser) ---
await A.goto(base + '?mock');
await A.fill('#startForm [name=me]', 'Maya');
await A.fill('#startForm [name=code]', 'WRONG');
await A.click('#startForm button[type=submit]'); await A.waitForTimeout(500);
ok((await A.textContent('#startErr')).includes('access code'), 'wrong access code is refused');
await A.fill('#startForm [name=code]', ' paris '); // lowercase + stray spaces should still work
await A.click('#startForm button[type=submit]'); await A.waitForTimeout(1200);
const url = A.url(); ok(/trip=/.test(url), 'trip created: ' + url);
const B = await ctx.newPage(); B.on('pageerror', (e) => errs.push(e.message));
await B.goto(url); await B.waitForTimeout(1200);
await B.evaluate(() => askWhoAreYou()); await B.waitForTimeout(300);
await B.fill('#sheetPanel [data-d=name]', 'Jo'); await B.click('#sheetPanel button[type=submit]'); await B.waitForTimeout(1500);
await A.goto(url.split('#')[0] + '#guests'); await A.waitForTimeout(1500);
console.log('  A guests:', await A.evaluate(() => state.guests.map((g) => g.name).join(', ')), '| B guests:', await B.evaluate(() => state.guests.map((g) => g.name).join(', ')));
ok(await A.evaluate(() => state.guests.some((g) => g.name === 'Jo')), 'person B joining shows up for person A');
// simultaneous edits: A adds a guest while B adds a packing item
await A.fill('#newGuest', 'Sam'); 
await B.goto(url.split('#')[0] + '#packing'); await B.waitForTimeout(1000);
await Promise.all([
  A.click('form[data-form=addGuest] button[type=submit]'),
  (async () => { await B.fill('#add-paris', 'Beret'); await B.click('form[data-form=addPack][data-cat=paris] button[type=submit]'); })(),
]);
await A.waitForTimeout(3000); await B.waitForTimeout(500);
const stA = await A.evaluate(() => JSON.stringify(state)); const stB = await B.evaluate(() => JSON.stringify(state));
ok(stA.includes('"Sam"') && stA.includes('Beret'), 'A has both simultaneous edits');
ok(stB.includes('"Sam"') && stB.includes('Beret'), 'B has both simultaneous edits');
// --- tourist tax ---
const P = A;
await P.goto(url.split('#')[0] + '#budget'); await P.waitForTimeout(800);
await P.selectOption('[data-bind="tax::stay"]', 'hotel3'); await P.waitForTimeout(200);
await P.fill('[data-bind="tax::adults"]', '5'); await P.fill('[data-bind="tax::nights"]', '4'); await P.waitForTimeout(300);
ok((await P.textContent('.tax-sum')).includes('€110.60'), '3-star: 5.53 × 5 × 4 = €110.60 → ' + (await P.textContent('.tax-sum')).trim());
await P.selectOption('[data-bind="tax::stay"]', 'rental'); await P.waitForTimeout(300);
await P.fill('[data-bind="tax::nightly"]', '60'); await P.fill('[data-bind="tax::adults"]', '1'); await P.fill('[data-bind="tax::nights"]', '1'); await P.waitForTimeout(300);
ok((await P.textContent('.tax-sum')).includes('€9.75'), 'rental €60/night → €9.75 → ' + (await P.textContent('.tax-sum')).trim());
await P.fill('[data-bind="tax::nightly"]', '200'); await P.waitForTimeout(300);
ok((await P.textContent('.tax-sum')).includes('€15.93'), 'rental €200/night capped at €15.93 → ' + (await P.textContent('.tax-sum')).trim());
// --- tipping ---
await P.click('[data-action=addExpense]'); await P.waitForTimeout(300);
ok((await P.inputValue('#sheetPanel [data-d=tip]')) === '0', 'tip defaults to 0%');
await P.fill('#sheetPanel [data-d=amount]', '100'); await P.fill('#sheetPanel [data-d=tip]', '10'); await P.waitForTimeout(200);
ok((await P.textContent('#sheetPanel')).includes('€110'), 'bill €100 + 10% tip = €110');
await P.keyboard.press('Escape'); await P.waitForTimeout(400);
// --- closed venue warning: put the Louvre on a Tuesday ---
await P.evaluate(() => { state.trip.start = '2026-12-07'; state.trip.end = '2026-12-11'; AFTER.fixDates(); commit(); }); // Mon Dec 7
await P.goto(url.split('#')[0] + '#itinerary'); await P.waitForTimeout(500);
await P.click('[data-action=addItem] >> nth=0'); await P.waitForTimeout(300);
await P.fill('#sheetPanel [data-d=title]', 'Louvre morning');
await P.selectOption('#sheetPanel [data-d=day]', '1'); await P.waitForTimeout(300);
ok((await P.textContent('#sheetPanel')).includes('closed on Tuesdays'), 'form warns: Louvre on a Tuesday');
await P.click('#sheetPanel button[type=submit]'); await P.waitForTimeout(500);
ok((await P.textContent('#view')).includes('The Louvre is closed on Tuesdays'), 'itinerary shows the closed-day warning');
const bk = await P.evaluate(() => state.bookings.find((b) => b.id === 'pb1').bookBy);
ok(bk === '2026-10-08', 'Eiffel book-by follows trip dates (60 days before Dec 7): ' + bk);
await P.evaluate(() => { state.itinerary.push({ id: 'x1', day: 0, time: '', title: 'Versailles', note: '', activityId: '', bookingId: '', cost: 0 }); commit(); });
await P.waitForTimeout(300);
ok((await P.textContent('#view')).includes('Versailles is closed on Mondays'), 'Versailles on a Monday is flagged');
console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no page errors');
await b.close();
