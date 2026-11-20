// Clicks through the Anywhere build: setup, date poll, currencies, closed days, alerts,
// nightly fees, essentials, polls, trip types and two people syncing.
// Serve dist/anywhere first, e.g.  (cd dist/anywhere && python3 -m http.server 8813) & node tests/anywhere.mjs
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://localhost:8813/';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const errs = [];
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
const A = await ctx.newPage(); A.on('pageerror', (e) => errs.push(e.message));
const S = (p) => p.evaluate(() => JSON.parse(JSON.stringify(state)));
const tab = async (p, t) => { await p.goto(p.url().split('#')[0] + '#' + t); await p.waitForTimeout(700); };

// --- setup ---
await A.goto(base + '?mock&today=2026-11-20');
await A.waitForTimeout(500);
ok(await A.isVisible('#startForm [name=dest]'), 'setup asks where to');
await A.fill('#startForm [name=name]', 'Tulum Girls Trip');
await A.fill('#startForm [name=dest]', 'Tulum');
await A.check('#startForm input[name=type][value=beach]', { force: true });
await A.fill('#startForm [name=me]', 'Maya');
await A.fill('#startForm [name=code]', 'anywhere');
await A.click('#startForm button[type=submit]'); await A.waitForTimeout(400);
ok((await A.textContent('#startErr')).includes('currency'), 'setup requires the group currency');
await A.selectOption('#startForm [name=home]', 'USD');
await A.selectOption('#startForm [name=local]', 'MXN');
await A.click('#startForm button[type=submit]'); await A.waitForTimeout(1500);
let st = await S(A);
ok(st.trip.destination === 'Tulum' && st.trip.type === 'beach' && st.trip.home === 'USD' && st.trip.local === 'MXN' && st.trip.currency === '$', `trip saved: ${st.trip.destination}, ${st.trip.type}, ${st.trip.home}→${st.trip.local}`);
ok(st.activities.length === 0 && st.bookings.length === 0 && st.tips.length === 0 && st.prices.length === 0, 'blank trip starts empty (no ideas, bookings, tips or prices)');
ok(!st.packing.some((x) => x.cat === 'extras'), 'no trip-type packing items added automatically');
ok(!st.trip.start, 'no dates yet');
await A.evaluate(() => { localStorage.setItem(WELCOME_KEY + ':' + SYNC.tripId, '1'); });

// --- second person joins (sync) ---
const B = await ctx.newPage(); B.on('pageerror', (e) => errs.push(e.message));
await B.goto(A.url()); await B.waitForTimeout(1200);
await B.evaluate(() => askWhoAreYou()); await B.waitForTimeout(200);
await B.fill('#sheetPanel [data-d=name]', 'Jo'); await B.click('#sheetPanel button[type=submit]'); await B.waitForTimeout(1500);
st = await S(A);
ok(st.guests.length === 2, 'second person shows up for the first');

// --- date poll ---
await tab(A, 'dashboard');
ok(await A.isVisible('.date-poll'), 'date poll shows before dates are set');
await A.fill('.date-poll [name=start]', '2027-03-10'); await A.fill('.date-poll [name=end]', '2027-03-14');
await A.click('.date-poll [data-form=addDateOpt] button[type=submit]'); await A.waitForTimeout(400);
await A.fill('.date-poll [name=start]', '2027-04-07'); await A.fill('.date-poll [name=end]', '2027-04-11');
await A.click('.date-poll [data-form=addDateOpt] button[type=submit]'); await A.waitForTimeout(400);
await A.click('.date-poll [data-action=dateVote] >> nth=0'); await A.waitForTimeout(300);
await A.click('.date-poll [data-action=pickDates] >> nth=0'); await A.waitForTimeout(600);
st = await S(A);
ok(st.trip.start === '2027-03-10' && st.trip.end === '2027-03-14', `picked dates set the trip: ${st.trip.start} → ${st.trip.end}`);
// --- suggestions, one at a time ---
await tab(A, 'vote');
ok((await A.textContent('[data-key=sugg-ideas]')).includes('Suggestions for a beach trip'), 'Group Picks shows beach-trip suggestions');
await A.click('[data-key=sugg-ideas] [data-action=addSugg] >> nth=0'); await A.waitForTimeout(400);
st = await S(A);
ok(st.activities.length === 1 && st.activities[0].title === 'Boat or catamaran day', 'adding one suggestion adds just that idea');
ok((await A.textContent('[data-key="sg-ideas-0"]')).includes('Added'), 'the added suggestion is marked “Added”');
await tab(A, 'bookings');
await A.click('[data-key=sugg-bookings] [data-action=addSugg] >> nth=0'); await A.waitForTimeout(400);
st = await S(A);
const boat = st.bookings.find((x) => x.title === 'Boat or catamaran day');
ok(boat && boat.bookBy === '2027-02-17' && boat.sellsOut, `suggested booking follows its lead time (21 days before): ${boat && boat.bookBy}`);
await tab(A, 'packing');
await A.click('[data-key=sgc-pack] [data-action=addSugg] >> nth=0'); await A.waitForTimeout(400);
st = await S(A);
ok(st.packing.filter((x) => x.cat === 'extras').length === 1, 'packing suggestion chip adds one item');

// --- multi-currency expense ---
await tab(A, 'budget');
await A.click('[data-action=addExpense] >> visible=true'); await A.waitForTimeout(300);
ok((await A.textContent('#sheetPanel')).includes('MXN'), 'expense form offers the local currency');
await A.fill('#sheetPanel [data-d=desc]', 'Tacos');
await A.fill('#sheetPanel [data-d=amount]', '1000');
await A.fill('#sheetPanel [data-d=rate]', '0.055'); await A.waitForTimeout(300);
ok((await A.textContent('#sheetPanel .split-sum')).includes('≈ $27.50'), 'shows each share in dollars: ' + (await A.textContent('#sheetPanel .split-sum')).trim());
await A.click('#sheetPanel button[type=submit]'); await A.waitForTimeout(500);
st = await S(A);
let e = st.expenses.find((x) => x.desc === 'Tacos');
ok(e && e.amount === 5500 && e.orig === 100000 && e.origCcy === 'MXN' && st.trip.rate === '0.055', `MX$1,000 at 0.055 = $55.00 (stored ${e && e.amount}), rate saved for the group`);
await A.click('[data-action=addExpense] >> visible=true'); await A.waitForTimeout(300);
await A.fill('#sheetPanel [data-d=desc]', 'Boat deposit');
await A.fill('#sheetPanel [data-d=amount]', '1001');
await A.click('#sheetPanel [data-action=dSet][data-v=amount]'); await A.waitForTimeout(200);
const ids = st.guests.map((g) => g.id);
await A.fill(`#sheetPanel [data-d="custom.${ids[0]}"]`, '600.50');
await A.fill(`#sheetPanel [data-d="custom.${ids[1]}"]`, '400.50'); await A.waitForTimeout(200);
await A.click('#sheetPanel button[type=submit]'); await A.waitForTimeout(500);
st = await S(A);
e = st.expenses.find((x) => x.desc === 'Boat deposit');
const sum = Object.values(e.custom).reduce((a, c) => a + c, 0);
ok(e.amount === 5506 && sum === e.amount, `custom split converts and still adds up: $${e.amount / 100} = ${Object.values(e.custom).map((c) => c / 100).join(' + ')}`);

// --- nightly fees (% of room rate) ---
await A.click('[data-action=feeMode][data-v=pct]'); await A.waitForTimeout(300);
await A.fill('[data-bind="tax::nightly"]', '2000'); await A.fill('[data-bind="tax::pct"]', '5');
await A.fill('[data-bind="tax::adults"]', '2'); await A.fill('[data-bind="tax::nights"]', '3'); await A.waitForTimeout(300);
const fees = (await A.textContent('[data-key=fees-card] .tax-sum')).replace(/\s+/g, ' ');
ok(fees.includes('MX$100 × 2 adults × 3 nights') && fees.includes('MX$600') && fees.includes('≈ $33'), 'nightly fees: 5% of MX$2,000 × 2 × 3 = MX$600 ≈ $33 → ' + fees.trim());

// --- booking with closed day + sells out, plan on that day ---
await tab(A, 'bookings');
await A.click('[data-action=addBooking] >> visible=true'); await A.waitForTimeout(300);
await A.fill('#sheetPanel [data-d=title]', 'Cenote tour');
await A.fill('#sheetPanel [data-d=lead]', '60');
await A.check('#sheetPanel [data-d=sellsOut]', { force: true });
await A.click('#sheetPanel [data-action=dToggle][data-field=closed][data-v="3"]'); await A.waitForTimeout(200);
await A.click('#sheetPanel button[type=submit]'); await A.waitForTimeout(500);
st = await S(A);
const cen = st.bookings.find((x) => x.title === 'Cenote tour');
ok(cen && cen.bookBy === '2027-01-09' && cen.sellsOut && cen.closed.join() === '3', `new booking: book-by ${cen && cen.bookBy}, sells out, closed Wednesdays`);
await A.evaluate((id) => { state.itinerary.push({ id: 'zz', day: 0, time: '10:00', title: 'Cenotes!', note: '', activityId: '', bookingId: id, cost: 0 }); commit(); }, cen.id);
await tab(A, 'itinerary');
ok((await A.textContent('#view')).includes('Cenote tour is closed on Wednesdays'), 'plan on a closed day is flagged (Mar 10, 2027 is a Wednesday)');
// pretend it's early January: 64 days out, inside the 60-day lead + 2 weeks' warning
await A.goto(A.url().split('#')[0] + '&today=2027-01-05#dashboard'); await A.waitForTimeout(1500);
ok((await A.textContent('#view')).includes('Book these first') && (await A.textContent('.book-first')).includes('Cenote tour'), '“Book these first” lists sells-out bookings inside their window');

// --- essentials ---
await tab(A, 'essentials');
await A.fill('[data-bind="ess::address"]', 'Calle 7, Tulum'); await A.waitForTimeout(300);
await A.fill('[data-form=addPhrase] [name=say]', 'Gracias'); await A.fill('[data-form=addPhrase] [name=sound]', 'GRAH-see-ahs');
await A.click('[data-form=addPhrase] button[type=submit]'); await A.waitForTimeout(300);
await A.fill('[data-form=addTip] [name=head]', 'Bring cash for the cenotes'); await A.click('[data-form=addTip] button[type=submit]'); await A.waitForTimeout(300);
st = await S(A);
ok(st.essentials.address === 'Calle 7, Tulum' && st.phrases.some((x) => x.say === 'Gracias') && st.tips.some((x) => x.head.includes('cash')), 'essentials: address, phrase and tip saved');
ok((await A.innerHTML('#view')).includes('google.com/maps/search'), 'address gets an “Open in Maps” link');

// --- quick poll ---
await tab(A, 'vote');
await A.click('[data-action=voteAs] >> nth=1'); await A.waitForTimeout(200);
await A.click('[data-action=addPoll]'); await A.waitForTimeout(300);
await A.fill('#sheetPanel [data-d=q]', 'Saturday dinner?');
await A.fill('#sheetPanel [data-d=opts]', 'Tacos\nSeafood'); await A.waitForTimeout(200);
await A.click('#sheetPanel button[type=submit]'); await A.waitForTimeout(400);
await A.click('[data-action=pollVote] >> nth=1'); await A.waitForTimeout(400);
st = await S(A);
ok(st.polls.length === 1 && st.polls[0].options[1].votes.length === 1, 'quick poll created and voted');

// --- switch trip type: suggestions change, nothing is added or removed ---
await tab(A, 'home');
const before = (await S(A)).activities.map((a) => a.title).join('|');
await A.selectOption('[data-bind="trip::type"]', 'bachelorette'); await A.waitForTimeout(300);
st = await S(A);
ok(st.activities.map((a) => a.title).join('|') === before, 'switching trip type leaves the ideas alone');
await tab(A, 'vote');
if ((await A.getAttribute('[data-key=sugg-ideas] .sugg-head', 'aria-expanded')) !== 'true') { await A.click('[data-key=sugg-ideas] .sugg-head'); await A.waitForTimeout(300); }
const bt = (await A.textContent('[data-key=sugg-ideas]')).replace(/\s+/g, ' ');
ok(bt.includes('bachelorette') && bt.includes('Boat party'), 'suggestions switch to bachelorette ones: ' + bt.slice(0, 160));
await tab(A, 'home');
await A.selectOption('[data-bind="trip::type"]', 'other'); await A.waitForTimeout(300);
await tab(A, 'vote');
ok(!(await A.isVisible('[data-key=sugg-ideas]')), '“Other” trip type shows no suggestions');
await tab(A, 'home');
ok((await A.textContent('.stamp')).includes('Tulum'), 'countdown stamp shows the destination');

// --- everything reached person B ---
await B.waitForTimeout(2500);
const sb = await S(B);
ok(sb.trip.destination === 'Tulum' && sb.polls.length === 1 && sb.phrases.length === 1 && sb.expenses.length === 2, 'person B has all of it');

// --- sample trip ---
const C = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); C.on('pageerror', (e) => errs.push(e.message));
await C.goto(base + '?mock&today=2026-11-20');
await C.fill('#startForm [name=me]', 'Sam'); await C.fill('#startForm [name=code]', 'ANYWHERE');
await C.check('#startForm input[value=sample]', { force: true });
await C.click('#startForm button[type=submit]'); await C.waitForTimeout(1500);
for (const t of ['home', 'guests', 'dashboard', 'vote', 'itinerary', 'budget', 'bookings', 'packing', 'essentials', 'dream', 'memories']) await tab(C, t);
const sc = await S(C);
ok(sc.trip.destination === 'Lisbon' && sc.phrases.length === 6 && sc.itinerary.every((i) => !itemClosureCheck(sc, i)), 'sample Lisbon trip loads, no plan on a closed day');

console.log(errs.length ? 'PAGE ERRORS: ' + errs.join(' | ') : 'no page errors');
await b.close();
process.exit(fails || errs.length ? 1 : 0);

function itemClosureCheck(s, it) {
  const d = new Date(s.trip.start + 'T00:00'); d.setDate(d.getDate() + it.day);
  const linked = [s.activities.find((a) => a.id === it.activityId), s.bookings.find((x) => x.id === it.bookingId)];
  return linked.some((x) => x && (x.closed || []).includes(d.getDay()));
}
