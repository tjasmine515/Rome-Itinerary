'use strict';
/* ==========================================================================
   Booked & Busy — shared trip planner (city content comes from CITY)
   One central `state` object → localStorage. Every tab reads guests from
   state.guests, so a name is typed once and used everywhere.
   ========================================================================== */

const STORE_KEY = `bookedBusy:${CITY.id}:v1`;
const TAB_KEY = `bookedBusy:${CITY.id}:tab`;
const BACKUP_KEY = `bookedBusy:${CITY.id}:lastBackup`;
const WELCOME_KEY = `bookedBusy:${CITY.id}:welcomeDismissed`;
const SCHEMA = 1;

const TABS = CITY.tabs;
const BOTTOM_TABS = CITY.bottomTabs;

const CATS = CITY.categories;
const SETTLE_CAT = { id: 'settlement', label: 'Paid back', emoji: '💸', color: '#999' };

const PACK_CATS = CITY.packCats;
const PACK_TEMPLATE = CITY.packTemplate;

const DREAM_KINDS = CITY.dreamKinds;

const GUEST_COLORS = CITY.guestColors;
const S = CITY.strings;

/* ---------- small utils ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const pad = (n) => String(n).padStart(2, '0');
const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = (s) => {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const diffDays = (a, b) => Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 864e5);
const pl = (n, w, p) => `${n} ${n === 1 ? w : (p || w + 's')}`;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const pct = (a, b) => (b > 0 ? clamp(Math.round((a / b) * 100), 0, 100) : 0);

/** Today's date at local midnight. `?today=YYYY-MM-DD` previews another day. */
function today() {
  let o = null;
  try { o = parseISO(new URLSearchParams(location.search).get('today')); } catch (e) { /* ignore */ }
  if (o) return o;
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}
const fmtDay = (d) => (d ? d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '');
const fmtDate = (d) => (d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '');
const fmtLong = (d) => (d ? d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : '');
function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
const cur = () => state.trip.currency || '€';
function money(c) {
  c = Math.round(c || 0);
  const v = Math.abs(c) / 100;
  const s = v.toLocaleString(undefined, { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 });
  return (c < 0 ? '−' : '') + cur() + s;
}
/** "1,850" → 185000, "12,50" → 1250, "1.234,56" → 123456 (cents). */
function parseMoney(v) {
  let s = String(v ?? '').replace(/[^\d.,-]/g, '');
  if (!s) return 0;
  const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
  if (lc > -1 && ld > -1) s = lc > ld ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (lc > -1) s = /,\d{1,2}$/.test(s) ? s.replace(/,(?=\d{1,2}$)/, '.').replace(/,/g, '') : s.replace(/,/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}
const moneyStr = (c) => (c ? (c % 100 ? (c / 100).toFixed(2) : String(c / 100)) : '');
const initials = (name) => (String(name || '?').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?');
const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || 'Someone';

/* ---------- optional art: PNG if present, emoji otherwise ---------- */
const ASSETS = new Set();
const NAMED_ICONS = [...new Set([...Object.values(CITY.tabIcons || {}), ...(CITY.extraIcons || [])])];
function probeAssets() {
  const list = ['images/hero.jpg', ...TABS.map((t) => `icons/${t.id}.png`), 'icons/doodle-1.png', 'icons/doodle-2.png', 'icons/doodle-3.png',
    ...NAMED_ICONS.flatMap((n) => [`icons/${n}.png`, `icons/${n}.svg`])];
  return Promise.all(list.map((src) => new Promise((res) => {
    const i = new Image();
    i.onload = () => { ASSETS.add(src); res(); };
    i.onerror = () => res();
    i.src = src;
  })));
}
/** A named icon file (icons/<name>.png, else .svg) if it loaded. */
const artSrc = (name) => (ASSETS.has(`icons/${name}.png`) ? `icons/${name}.png` : ASSETS.has(`icons/${name}.svg`) ? `icons/${name}.svg` : '');
const art = (name, emoji = '', cls = '') => (artSrc(name)
  ? `<span class="ico ${cls}"><img src="${artSrc(name)}" alt=""></span>`
  : `<span class="ico ${cls}" aria-hidden="true">${emoji}</span>`);
function icon(tabId, cls = '') {
  const t = TABS.find((x) => x.id === tabId);
  const named = (CITY.tabIcons || {})[tabId];
  const src = named ? artSrc(named) : `icons/${tabId}.png`;
  return ASSETS.has(src)
    ? `<span class="ico ${cls}"><img src="${src}" alt=""></span>`
    : `<span class="ico ${cls}" aria-hidden="true">${t ? t.emoji : ''}</span>`;
}
const doodle = (n, style = '') => (ASSETS.has(`icons/doodle-${n}.png`) ? `<img src="icons/doodle-${n}.png" alt="" style="position:absolute;pointer-events:none;${style}">` : '');

/* ==========================================================================
   Seed data — a realistic sample trip (from the city file) so the app looks alive on day one
   ========================================================================== */
function makeSeed() {
  const t = today();
  const sm = CITY.sample;
  let start = addDays(t, sm.startInDays);
  // Nudge the sample forward so none of its plans land on a day that venue is closed.
  for (let k = 0; k < 7 && sm.itinerary.some((x) => closureFor(x.title, addDays(start, x.day))); k++) start = addDays(start, 1);
  const end = addDays(start, sm.nights);
  const D = (n) => isoOf(addDays(start, n));
  const gid = (i) => 'g' + (i + 1);
  const g = sm.guests.map((x, i) => ({ id: gid(i), name: x.name, color: GUEST_COLORS[i], diet: x.diet || '', arrive: x.arriveDay != null ? D(x.arriveDay) : '', depart: x.departDay != null ? D(x.departDay) : '', confirmed: x.confirmed !== false }));
  const V = (ix) => ix.map(gid);

  const activities = sm.activities.map((a) => ({ ...a, votes: V(a.votes), custom: false }));

  const bookings = sm.bookings.map(({ bookByDay, ...b }) => ({
    ...b,
    bookBy: b.lead != null ? D(-b.lead) : D(bookByDay),
    assignee: b.assignee == null ? '' : gid(b.assignee),
  }));

  let n = 0;
  const itinerary = sm.itinerary.map((x) => ({ id: 'i' + (++n), day: x.day, time: x.time, title: x.title, note: x.note || '', activityId: x.activityId || '', bookingId: x.bookingId || '', cost: x.cost || 0 }));

  const expenses = sm.expenses.map(({ daysAgo, ...e }) => ({
    ...e,
    date: isoOf(addDays(t, -daysAgo)),
    paidBy: gid(e.paidBy),
    participants: V(e.participants),
    custom: Object.fromEntries(Object.entries(e.custom || {}).map(([k, v]) => [gid(+k), v])),
  }));

  const packing = [];
  g.forEach((guest, gi) => {
    let k = 0;
    PACK_CATS.forEach((c) => PACK_TEMPLATE[c.id].forEach((text) => {
      packing.push({ id: uid(), guestId: guest.id, cat: c.id, text, done: ((k++ * 7) % 10) / 10 < sm.packedRate[gi] });
    }));
  });

  const dream = sm.dream.map((d) => ({ ...d, link: d.link || '', promoted: '' }));
  const journal = sm.journal.map((j) => ({ ...j, quote: j.quote || '' }));

  return {
    schema: SCHEMA,
    trip: { name: sm.tripName, start: isoOf(start), end: isoOf(end), budget: sm.budget, currency: '€' },
    guests: g, activities, itinerary, expenses, bookings, packing, dream, journal,
    ...cityExtras(),
  };
}

/** Extra trip data only some cities use (price guide, tourist-tax calculator). */
function cityExtras() {
  const out = {};
  const bud = CITY.budget || {};
  if (bud.prices) out.prices = bud.prices.map((x) => ({ ...x }));
  if (bud.touristTax) out.tax = { stay: bud.touristTax.default, adults: '', nights: '', nightly: '' };
  return out;
}

/** Blank trip that keeps the city know-how (ideas, booking tips) but none of the sample people or money. */
function makeBlank() {
  const s = makeSeed();
  return {
    ...s,
    trip: { ...s.trip, name: S.blankTripName, budget: 0 },
    guests: [], itinerary: [], expenses: [], packing: [], journal: [],
    activities: s.activities.map((a) => ({ ...a, votes: [] })),
    bookings: s.bookings.map((b) => ({ ...b, assignee: '', booked: false, cost: 0, ref: '' })),
    dream: s.dream.map((d) => ({ ...d, promoted: '' })),
  };
}

/** Fill in anything missing without touching well-formed data (keeps backups round-tripping exactly). */
function normalize(d) {
  const blank = { schema: SCHEMA, trip: { name: S.blankTripName, start: '', end: '', budget: 0, currency: '€' },
    guests: [], activities: [], itinerary: [], expenses: [], bookings: [], packing: [], dream: [], journal: [] };
  const out = { ...blank, ...d, trip: { ...blank.trip, ...(d.trip || {}) } };
  for (const k of ['guests', 'activities', 'itinerary', 'expenses', 'bookings', 'packing', 'dream', 'journal']) if (!Array.isArray(out[k])) out[k] = [];
  const extras = cityExtras();
  if (extras.prices && !Array.isArray(out.prices)) out.prices = extras.prices;
  if (extras.tax) out.tax = { ...extras.tax, ...(isObj(out.tax) ? out.tax : {}) };
  // photos were removed; drop any leftovers so trips stay small enough to sync
  delete out.trip.heroImg;
  out.dream.forEach((d) => { if ('img' in d) delete d.img; if (d.link == null) d.link = ''; });
  out.journal.forEach((j) => { if ('img' in j) delete j.img; if (j.quote == null) j.quote = ''; });
  return out;
}

/* ==========================================================================
   Store
   ========================================================================== */
let state;
let saveTimer = null;
let lastSaved = 0;
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch (e) { /* fall through to seed */ }
  return makeSeed();
}
function save() { if (SYNC.on) { schedulePush(); return; } clearTimeout(saveTimer); saveTimer = setTimeout(flush, 250); }
function flush() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (SYNC.on) { push(); return; }
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    lastSaved = Date.now();
    const s = $('#saveState');
    if (s) { s.textContent = 'Saved ✓'; s.classList.remove('flash'); void s.offsetWidth; s.classList.add('flash'); }
  } catch (e) {
    toast("This browser's storage is full. Download a copy of your trip, then clear some space.");
  }
}
function commit() { save(); render(); }
/** Run a change with a one-tap Undo toast. */
function undoable(message, fn) {
  const snap = JSON.stringify(state);
  fn();
  commit();
  toast(message, { action: 'Undo', onAction: () => { state = JSON.parse(snap); commit(); } });
}

/* ---------- selectors ---------- */
const guest = (id) => state.guests.find((g) => g.id === id);
function tripDays() {
  const s = parseISO(state.trip.start), e = parseISO(state.trip.end);
  if (!s) return [];
  const n = e ? clamp(diffDays(s, e), 0, 59) : 0;
  return Array.from({ length: n + 1 }, (_, i) => ({ i, date: addDays(s, i) }));
}
function tripPhase() {
  const days = tripDays();
  if (!days.length) return { phase: 'nodates' };
  const t = today();
  if (t < days[0].date) return { phase: 'before', until: diffDays(t, days[0].date) };
  if (t > days[days.length - 1].date) return { phase: 'after' };
  return { phase: 'during', index: diffDays(days[0].date, t) };
}
function shares(e) {
  const out = {};
  const ps = (e.participants || []).filter(Boolean);
  if (!ps.length || !e.amount) return out;
  if (e.mode === 'amount') { ps.forEach((g) => { out[g] = Math.round(+(e.custom || {})[g] || 0); }); return out; }
  if (e.mode === 'percent') {
    const raw = ps.map((g) => { const x = (e.amount * (+(e.custom || {})[g] || 0)) / 100; return { g, f: Math.floor(x), r: x - Math.floor(x) }; });
    let left = e.amount - raw.reduce((s, x) => s + x.f, 0);
    [...raw].sort((a, b) => b.r - a.r).forEach((x) => { if (left > 0 && left < raw.length + 1) { x.f += 1; left -= 1; } });
    raw.forEach((x) => { out[x.g] = x.f; });
    return out;
  }
  const base = Math.floor(e.amount / ps.length);
  let rem = e.amount - base * ps.length;
  ps.forEach((g) => { out[g] = base + (rem-- > 0 ? 1 : 0); });
  return out;
}
function balances() {
  const b = {};
  state.guests.forEach((g) => { b[g.id] = 0; });
  for (const e of state.expenses) {
    b[e.paidBy] = (b[e.paidBy] || 0) + e.amount;
    for (const [g, c] of Object.entries(shares(e))) b[g] = (b[g] || 0) - c;
  }
  return b;
}
/** Greedy settle-up: biggest debtor pays biggest creditor until everyone nets to zero. */
function settleUp() {
  const b = balances();
  const cred = [], debt = [];
  for (const [g, v] of Object.entries(b)) { if (v > 0) cred.push({ g, v }); else if (v < 0) debt.push({ g, v: -v }); }
  cred.sort((x, y) => y.v - x.v);
  debt.sort((x, y) => y.v - x.v);
  const out = [];
  let i = 0, j = 0;
  while (i < debt.length && j < cred.length) {
    const amt = Math.min(debt[i].v, cred[j].v);
    if (amt > 0) out.push({ from: debt[i].g, to: cred[j].g, amount: amt });
    debt[i].v -= amt; cred[j].v -= amt;
    if (debt[i].v === 0) i++;
    if (cred[j].v === 0) j++;
  }
  return out;
}
const spentTotal = () => state.expenses.filter((e) => e.category !== 'settlement').reduce((s, e) => s + e.amount, 0);
function urgency(b) {
  if (b.booked) return { level: 'done', word: 'Booked', label: 'Booked ✓' };
  const d = parseISO(b.bookBy);
  if (!d) return { level: 'green', word: 'No deadline', label: 'No book-by date yet', days: Infinity };
  const n = diffDays(today(), d);
  if (n < 0) return { level: 'red', word: 'Overdue', label: `${pl(-n, 'day')} overdue`, days: n };
  if (n === 0) return { level: 'red', word: 'Urgent', label: 'Due today', days: 0 };
  if (n <= 3) return { level: 'red', word: 'Urgent', label: `${pl(n, 'day')} left`, days: n };
  if (n <= 14) return { level: 'amber', word: 'Coming up', label: `${pl(n, 'day')} left`, days: n };
  return { level: 'green', word: 'Plenty of time', label: `${pl(n, 'day')} to go`, days: n };
}
function sortedBookings() {
  return [...state.bookings].sort((a, b) => (a.booked - b.booked) || ((a.bookBy || '9999') < (b.bookBy || '9999') ? -1 : (a.bookBy || '9999') > (b.bookBy || '9999') ? 1 : 0));
}
function packStats(gid) {
  const ids = new Set(state.guests.map((g) => g.id));
  const items = state.packing.filter((p) => (gid ? p.guestId === gid : ids.has(p.guestId)));
  const done = items.filter((p) => p.done).length;
  return { total: items.length, done, pct: pct(done, items.length) };
}
const validVotes = (a) => a.votes.filter((id) => guest(id));
const isScheduled = (actId) => state.itinerary.some((i) => i.activityId === actId);
function rankedActivities() {
  return state.activities.map((a, idx) => ({ a, idx, n: validVotes(a).length })).sort((x, y) => (y.n - x.n) || (x.idx - y.idx));
}
/** Venue closures from the city file: { venue, match: [words], days: [0 = Sunday … 6], label }. */
const fold = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function closureFor(text, date) {
  if (!date || !CITY.closures) return null;
  const t = fold(text);
  return CITY.closures.find((c) => c.days.includes(date.getDay()) && c.match.some((m) => t.includes(fold(m)))) || null;
}
const dayDate = (i) => { const d = tripDays()[i]; return d ? d.date : null; };
/** Is this plan on a day its venue is closed? Checks the plan, its linked idea and its linked booking. */
function itemClosure(it) {
  if (!CITY.closures) return null;
  const a = state.activities.find((x) => x.id === it.activityId);
  const b = state.bookings.find((x) => x.id === it.bookingId);
  return closureFor([it.title, a && a.title, b && b.title].join(' '), dayDate(+it.day));
}
const closedPlans = () => (CITY.closures ? state.itinerary.filter((i) => itemClosure(i)) : []);
const closedMsg = (cl) => `${cl.venue} is closed ${cl.label}.`;
function dietNotes() { return state.guests.filter((g) => g.diet && g.diet.trim()); }

/* ==========================================================================
   Tiny DOM morph — keeps focus, scroll & CSS transitions across re-renders
   ========================================================================== */
const keyOf = (n) => (n.nodeType === 1 ? n.getAttribute('data-key') : null);
function morph(from, to) {
  if (from.nodeType !== to.nodeType || from.nodeName !== to.nodeName) return to;
  if (from.nodeType !== 1) { if (from.nodeValue !== to.nodeValue) from.nodeValue = to.nodeValue; return from; }
  for (const a of [...from.attributes]) if (!to.hasAttribute(a.name)) from.removeAttribute(a.name);
  for (const a of [...to.attributes]) if (from.getAttribute(a.name) !== a.value) from.setAttribute(a.name, a.value);
  const tag = from.nodeName;
  const focused = document.activeElement === from;
  if (tag === 'TEXTAREA') { if (!focused && from.value !== to.textContent) from.value = to.textContent; return from; }
  morphChildren(from, to);
  if (tag === 'INPUT') {
    if (from.type === 'checkbox' || from.type === 'radio') from.checked = to.hasAttribute('checked');
    else if (!focused && from.value !== (to.getAttribute('value') ?? '')) from.value = to.getAttribute('value') ?? '';
  } else if (tag === 'SELECT') {
    const sel = to.querySelector('option[selected]') || to.querySelector('option');
    const v = sel ? (sel.getAttribute('value') ?? sel.textContent) : '';
    if (from.value !== v) from.value = v;
  }
  return from;
}
function morphChildren(from, to) {
  const olds = [...from.childNodes];
  const keyed = new Map(), free = [];
  for (const n of olds) { const k = keyOf(n); if (k != null) keyed.set(k, n); else free.push(n); }
  const used = new Set();
  let fi = 0, cursor = from.firstChild;
  for (const nn of [...to.childNodes]) {
    const k = keyOf(nn);
    let m = null;
    if (k != null) { m = keyed.get(k) || null; if (m) keyed.delete(k); }
    else if (fi < free.length) { const c = free[fi++]; if (c.nodeName === nn.nodeName) m = c; }
    const node = m ? morph(m, nn) : nn;
    if (node === m) used.add(m);
    if (node !== cursor) from.insertBefore(node, cursor && cursor.parentNode === from ? cursor : null);
    cursor = node.nextSibling;
  }
  for (const n of olds) if (!used.has(n) && n.parentNode === from) n.remove();
}
function patch(el, html) {
  const t = document.createElement('template');
  t.innerHTML = html;
  morphChildren(el, t.content);
}

/* ==========================================================================
   Shell
   ========================================================================== */
const ui = { tab: 'home', packGuest: '', packScope: 'one', budgetView: 'overview', voteAs: '', bookFilter: 'all' };

const LOGO_SVG = `<svg class="logo" viewBox="0 0 259.6 206.9" role="img" aria-label="Booked and Busy"><path d="M37.12 116.56Q36.50 116.12 36.31 116.06Q36.12 116.00 35.12 116.06Q34.12 116.12 33.44 116.56Q32.75 117.00 32.44 117.44Q32.12 117.88 31.69 118.25Q31.25 118.62 31.06 118.50Q30.88 118.38 30.81 117.56Q30.75 116.75 30.38 116.50Q30.00 116.25 28.38 116.25Q26.75 116.25 26.50 116.31Q26.25 116.38 26.00 116.69Q25.75 117.00 25.75 117.38Q25.75 117.75 25.94 118.44Q26.12 119.12 26.12 120.44Q26.12 121.75 26.19 121.81Q26.25 121.88 26.25 127.69Q26.25 133.50 26.19 133.56Q26.12 133.62 26.12 134.94Q26.12 136.25 25.88 137.06Q25.62 137.88 25.62 138.12Q25.62 138.38 25.81 138.56Q26.00 138.75 26.19 138.81Q26.38 138.88 28.44 138.88Q30.50 138.88 30.75 138.69Q31.00 138.50 30.94 137.00Q30.88 135.50 30.69 134.50Q30.50 133.50 30.50 132.25Q30.50 131.00 30.38 130.50Q30.25 130.00 30.25 128.06Q30.25 126.12 30.62 124.25Q31.00 122.38 31.50 121.75Q32.00 121.12 32.50 120.88Q33.00 120.62 33.44 120.62Q33.88 120.62 34.44 120.94Q35.00 121.25 35.44 122.25Q35.88 123.25 35.94 123.62Q36.00 124.00 36.00 124.81Q36.00 125.62 36.06 125.69Q36.12 125.75 36.06 129.44Q36.00 133.12 35.81 133.88Q35.62 134.62 35.62 135.12Q35.62 135.62 35.44 136.25Q35.25 136.88 35.19 137.38Q35.12 137.88 35.19 138.19Q35.25 138.50 35.50 138.69Q35.75 138.88 37.88 138.88Q40.00 138.88 40.31 138.75Q40.62 138.62 40.69 138.50Q40.75 138.38 40.75 138.00Q40.75 137.62 40.56 137.25Q40.38 136.88 40.19 135.75Q40.00 134.62 40.00 129.38Q40.00 124.12 39.94 124.06Q39.88 124.00 39.81 122.44Q39.75 120.88 39.19 119.38Q38.62 117.88 38.19 117.44Q37.75 117.00 37.12 116.56ZM13.31 116.12Q12.88 116.25 12.25 116.62Q11.62 117.00 11.38 117.31Q11.12 117.62 11.12 118.94Q11.12 120.25 11.31 120.50Q11.50 120.75 11.88 120.75Q12.25 120.75 12.94 120.31Q13.62 119.88 14.69 119.94Q15.75 120.00 16.69 120.88Q17.62 121.75 17.81 122.06Q18.00 122.38 18.06 123.69Q18.12 125.00 18.06 125.25Q18.00 125.50 17.81 125.69Q17.62 125.88 17.50 125.88Q17.38 125.88 16.94 125.31Q16.50 124.75 15.62 123.94Q14.75 123.12 13.81 123.06Q12.88 123.00 12.50 123.19Q12.12 123.38 11.69 123.75Q11.25 124.12 10.75 124.75Q10.25 125.38 10.12 125.94Q10.00 126.50 9.69 127.12Q9.38 127.75 9.25 128.81Q9.12 129.88 9.19 131.88Q9.25 133.88 9.75 135.44Q10.25 137.00 10.88 137.75Q11.50 138.50 12.19 138.75Q12.88 139.00 13.38 139.38Q13.88 139.75 14.31 139.75Q14.75 139.75 15.00 139.62Q15.25 139.50 15.88 138.88Q16.50 138.25 16.81 138.25Q17.12 138.25 17.69 138.56Q18.25 138.88 20.19 138.88Q22.12 138.88 22.31 138.81Q22.50 138.75 22.69 138.50Q22.88 138.25 22.88 138.00Q22.88 137.75 22.56 136.81Q22.25 135.88 22.12 135.12Q22.00 134.38 22.00 128.19Q22.00 122.00 21.88 121.31Q21.75 120.62 21.25 119.56Q20.75 118.50 20.06 117.81Q19.38 117.12 19.00 117.06Q18.62 117.00 18.19 116.69Q17.75 116.38 17.25 116.19Q16.75 116.00 15.25 116.00Q13.75 116.00 13.31 116.12ZM14.06 127.38Q14.62 126.88 15.56 126.88Q16.50 126.88 16.75 127.06Q17.00 127.25 17.50 128.81Q18.00 130.38 17.94 131.31Q17.88 132.25 17.56 133.12Q17.25 134.00 16.94 134.44Q16.62 134.88 16.31 135.00Q16.00 135.12 15.50 135.12Q15.00 135.12 14.69 135.00Q14.38 134.88 14.00 134.50Q13.62 134.12 13.31 133.50Q13.00 132.88 13.00 130.94Q13.00 129.00 13.25 128.44Q13.50 127.88 14.06 127.38ZM204.50 111.00Q197.25 111.00 196.88 111.25Q196.50 111.50 196.50 111.75Q196.50 112.00 196.75 112.50Q197.00 113.00 197.12 114.44Q197.25 115.88 197.62 117.25Q198.00 118.62 198.19 122.19Q198.38 125.75 198.69 127.69Q199.00 129.62 199.06 143.12Q199.12 156.62 199.25 157.62Q199.38 158.62 199.75 159.94Q200.12 161.25 200.19 162.12Q200.25 163.00 200.62 163.81Q201.00 164.62 201.19 165.44Q201.38 166.25 201.62 166.56Q201.88 166.88 202.06 167.38Q202.25 167.88 202.69 168.56Q203.12 169.25 203.50 169.69Q203.88 170.12 204.75 170.94Q205.62 171.75 206.50 172.25Q207.38 172.75 208.38 172.88Q209.38 173.00 210.25 173.31Q211.12 173.62 211.75 173.62Q212.38 173.62 213.19 173.31Q214.00 173.00 214.69 172.94Q215.38 172.88 216.50 172.25Q217.62 171.62 218.69 170.56Q219.75 169.50 220.81 167.69Q221.88 165.88 222.00 165.31Q222.12 164.75 222.50 164.06Q222.88 163.38 222.94 162.69Q223.00 162.00 223.19 161.44Q223.38 160.88 223.69 160.31Q224.00 159.75 224.25 159.62Q224.50 159.50 224.75 159.75Q225.00 160.00 225.06 160.25Q225.12 160.50 225.19 161.75Q225.25 163.00 225.62 164.38Q226.00 165.75 226.19 168.62Q226.38 171.50 226.50 171.88Q226.62 172.25 226.62 172.75Q226.62 173.25 226.81 174.12Q227.00 175.00 227.00 176.62Q227.00 178.25 226.50 180.19Q226.00 182.12 225.44 183.06Q224.88 184.00 224.38 184.62Q223.88 185.25 223.06 186.00Q222.25 186.75 221.88 186.94Q221.50 187.12 221.00 187.56Q220.50 188.00 220.00 188.06Q219.50 188.12 218.62 188.56Q217.75 189.00 213.62 189.00Q209.50 189.00 208.69 188.56Q207.88 188.12 206.88 188.00Q205.88 187.88 205.31 187.50Q204.75 187.12 204.25 187.06Q203.75 187.00 203.00 186.50Q202.25 186.00 201.69 185.88Q201.12 185.75 200.88 185.81Q200.62 185.88 200.50 186.12Q200.38 186.38 200.31 191.31Q200.25 196.25 200.44 196.50Q200.62 196.75 201.06 196.88Q201.50 197.00 202.00 197.38Q202.50 197.75 203.38 197.88Q204.25 198.00 204.75 198.31Q205.25 198.62 205.69 198.75Q206.12 198.88 207.06 198.88Q208.00 198.88 209.00 199.25Q210.00 199.62 210.62 199.75Q211.25 199.88 215.50 199.88Q219.75 199.88 220.12 199.81Q220.50 199.75 221.62 199.31Q222.75 198.88 223.69 198.81Q224.62 198.75 225.25 198.38Q225.88 198.00 226.50 197.88Q227.12 197.75 227.56 197.44Q228.00 197.12 228.62 196.88Q229.25 196.62 230.44 195.75Q231.62 194.88 232.69 193.81Q233.75 192.75 234.31 192.06Q234.88 191.38 235.38 190.56Q235.88 189.75 236.00 189.31Q236.12 188.88 236.50 188.25Q236.88 187.62 237.00 186.94Q237.12 186.25 237.50 185.25Q237.88 184.25 237.94 182.69Q238.00 181.12 238.06 181.06Q238.12 181.00 238.06 180.75Q238.00 180.50 238.06 179.81Q238.12 179.12 238.06 179.06Q238.00 179.00 237.94 174.94Q237.88 170.88 237.50 169.25Q237.12 167.62 237.00 166.06Q236.88 164.50 236.50 163.31Q236.12 162.12 236.00 161.19Q235.88 160.25 235.88 145.25Q235.88 130.25 235.94 130.19Q236.00 130.12 236.00 128.00Q236.00 125.88 236.06 125.81Q236.12 125.75 236.19 124.44Q236.25 123.12 236.38 122.81Q236.50 122.50 236.69 121.25Q236.88 120.00 237.00 118.00Q237.12 116.00 237.50 114.88Q237.88 113.75 238.00 112.81Q238.12 111.88 238.06 111.62Q238.00 111.38 237.75 111.19Q237.50 111.00 230.12 111.00Q222.75 111.00 222.50 111.19Q222.25 111.38 222.19 111.75Q222.12 112.12 222.56 113.50Q223.00 114.88 223.12 116.69Q223.25 118.50 223.69 120.81Q224.12 123.12 224.12 124.94Q224.12 126.75 224.19 126.81Q224.25 126.88 224.25 128.38Q224.25 129.88 224.31 129.94Q224.38 130.00 224.38 139.00Q224.38 148.00 224.31 148.06Q224.25 148.12 224.19 149.69Q224.12 151.25 223.94 151.94Q223.75 152.62 223.50 153.12Q223.25 153.62 223.12 154.31Q223.00 155.00 222.38 156.25Q221.75 157.50 221.00 158.44Q220.25 159.38 219.12 160.12Q218.00 160.88 216.75 160.94Q215.50 161.00 215.19 160.88Q214.88 160.75 214.00 160.12Q213.12 159.50 212.69 158.88Q212.25 158.25 212.06 157.69Q211.88 157.12 211.50 156.44Q211.12 155.75 211.00 154.62Q210.88 153.50 210.56 152.19Q210.25 150.88 210.19 149.50Q210.12 148.12 210.06 148.06Q210.00 148.00 210.00 140.38Q210.00 132.75 210.12 132.06Q210.25 131.38 210.25 129.75Q210.25 128.12 210.38 127.81Q210.50 127.50 210.50 126.50Q210.50 125.50 210.62 125.12Q210.75 124.75 210.75 124.12Q210.75 123.50 210.81 123.44Q210.88 123.38 211.00 120.94Q211.12 118.50 211.50 116.94Q211.88 115.38 211.94 114.38Q212.00 113.38 212.25 112.69Q212.50 112.00 212.50 111.75Q212.50 111.50 212.44 111.38Q212.38 111.25 212.06 111.12Q211.75 111.00 204.50 111.00ZM121.75 111.12Q121.50 111.25 121.44 111.81Q121.38 112.38 121.69 113.06Q122.00 113.75 122.12 115.31Q122.25 116.88 122.62 118.50Q123.00 120.12 123.19 124.12Q123.38 128.12 123.50 128.56Q123.62 129.00 123.62 130.50Q123.62 132.00 123.81 132.88Q124.00 133.75 124.00 144.19Q124.00 154.62 124.06 154.69Q124.12 154.75 124.19 156.81Q124.25 158.88 124.38 159.50Q124.50 160.12 124.75 160.75Q125.00 161.38 125.19 162.62Q125.38 163.88 125.69 164.44Q126.00 165.00 126.25 165.81Q126.50 166.62 126.69 166.81Q126.88 167.00 127.50 168.12Q128.12 169.25 128.88 170.00Q129.62 170.75 130.25 171.19Q130.88 171.62 131.44 171.81Q132.00 172.00 132.62 172.38Q133.25 172.75 133.50 172.81Q133.75 172.88 136.62 172.88Q139.50 172.88 140.94 172.19Q142.38 171.50 143.62 170.38Q144.88 169.25 145.88 167.62Q146.88 166.00 147.00 165.44Q147.12 164.88 147.50 164.19Q147.88 163.50 147.88 163.25Q147.88 163.00 148.12 162.25Q148.38 161.50 148.62 161.25Q148.88 161.00 149.06 161.00Q149.25 161.00 149.31 161.06Q149.38 161.12 149.38 162.88Q149.38 164.62 149.25 165.88Q149.12 167.12 148.69 168.25Q148.25 169.38 148.19 169.81Q148.12 170.25 147.94 170.56Q147.75 170.88 147.75 171.19Q147.75 171.50 147.88 171.62Q148.00 171.75 148.19 171.81Q148.38 171.88 155.44 171.88Q162.50 171.88 162.81 171.62Q163.12 171.38 162.94 169.88Q162.75 168.38 162.44 167.38Q162.12 166.38 161.94 163.88Q161.75 161.38 161.56 160.62Q161.38 159.88 161.19 158.12Q161.00 156.38 160.94 143.69Q160.88 131.00 160.94 130.94Q161.00 130.88 161.06 127.81Q161.12 124.75 161.44 123.12Q161.75 121.50 161.94 118.94Q162.12 116.38 162.50 115.12Q162.88 113.88 162.88 113.44Q162.88 113.00 163.00 112.50Q163.12 112.00 163.06 111.69Q163.00 111.38 162.75 111.19Q162.50 111.00 155.12 111.00Q147.75 111.00 147.50 111.25Q147.25 111.50 147.25 111.94Q147.25 112.38 147.56 113.12Q147.88 113.88 148.00 114.44Q148.12 115.00 148.19 116.44Q148.25 117.88 148.69 120.00Q149.12 122.12 149.25 126.81Q149.38 131.50 149.50 131.88Q149.62 132.25 149.62 139.50Q149.62 146.75 149.50 147.19Q149.38 147.62 149.25 149.75Q149.12 151.88 149.00 152.31Q148.88 152.75 148.62 153.19Q148.38 153.62 148.19 154.44Q148.00 155.25 147.62 155.81Q147.25 156.38 147.06 156.88Q146.88 157.38 146.50 157.88Q146.12 158.38 145.31 159.12Q144.50 159.88 144.06 160.00Q143.62 160.12 143.00 160.50Q142.38 160.88 141.81 160.94Q141.25 161.00 139.88 160.31Q138.50 159.62 137.75 158.69Q137.00 157.75 136.50 156.62Q136.00 155.50 135.94 154.81Q135.88 154.12 135.56 153.06Q135.25 152.00 135.12 151.06Q135.00 150.12 135.00 141.69Q135.00 133.25 135.06 133.19Q135.12 133.12 135.12 131.75Q135.12 130.38 135.06 130.25Q135.00 130.12 135.12 129.19Q135.25 128.25 135.25 127.38Q135.25 126.50 135.38 126.06Q135.50 125.62 135.50 125.06Q135.50 124.50 135.69 123.44Q135.88 122.38 135.94 120.56Q136.00 118.75 136.12 118.00Q136.25 117.25 136.50 116.50Q136.75 115.75 136.88 114.38Q137.00 113.00 137.19 112.56Q137.38 112.12 137.38 111.75Q137.38 111.38 137.00 111.19Q136.62 111.00 129.31 111.00Q122.00 111.00 121.75 111.12ZM187.12 110.12Q186.62 110.00 182.62 110.00Q178.62 110.00 178.12 110.12Q177.62 110.25 177.06 110.56Q176.50 110.88 175.69 111.00Q174.88 111.12 174.38 111.50Q173.88 111.88 173.38 112.06Q172.88 112.25 172.25 112.69Q171.62 113.12 170.75 114.00Q169.88 114.88 169.12 115.94Q168.38 117.00 167.81 118.25Q167.25 119.50 167.12 120.44Q167.00 121.38 166.69 122.44Q166.38 123.50 166.38 125.44Q166.38 127.38 166.69 128.38Q167.00 129.38 167.12 130.31Q167.25 131.25 167.62 131.94Q168.00 132.62 168.19 133.19Q168.38 133.75 168.56 133.94Q168.75 134.12 169.00 134.69Q169.25 135.25 169.62 135.69Q170.00 136.12 170.19 136.50Q170.38 136.88 171.69 138.50Q173.00 140.12 175.94 143.06Q178.88 146.00 179.94 147.19Q181.00 148.38 181.88 149.88Q182.75 151.38 183.00 152.06Q183.25 152.75 183.38 154.44Q183.50 156.12 183.38 156.50Q183.25 156.88 183.19 157.56Q183.12 158.25 182.75 158.81Q182.38 159.38 181.62 160.12Q180.88 160.88 179.81 161.44Q178.75 162.00 176.69 161.94Q174.62 161.88 173.94 161.50Q173.25 161.12 172.38 160.94Q171.50 160.75 171.12 160.44Q170.75 160.12 170.12 159.88Q169.50 159.62 168.31 158.75Q167.12 157.88 166.88 157.88Q166.62 157.88 166.44 158.12Q166.25 158.38 166.25 163.81Q166.25 169.25 166.38 169.50Q166.50 169.75 166.94 170.19Q167.38 170.62 168.19 170.81Q169.00 171.00 169.56 171.38Q170.12 171.75 171.31 171.88Q172.50 172.00 173.12 172.31Q173.75 172.62 174.25 172.75Q174.75 172.88 178.25 172.88Q181.75 172.88 182.19 172.75Q182.62 172.62 183.06 172.38Q183.50 172.12 184.31 171.94Q185.12 171.75 185.69 171.38Q186.25 171.00 186.75 170.81Q187.25 170.62 187.94 170.12Q188.62 169.62 189.75 168.44Q190.88 167.25 191.88 165.50Q192.88 163.75 193.00 163.00Q193.12 162.25 193.38 161.75Q193.62 161.25 193.81 160.19Q194.00 159.12 193.94 155.94Q193.88 152.75 193.50 151.81Q193.12 150.88 192.94 150.00Q192.75 149.12 192.25 148.12Q191.75 147.12 191.50 146.81Q191.25 146.50 191.06 146.06Q190.88 145.62 189.38 143.62Q187.88 141.62 183.94 137.50Q180.00 133.38 179.19 132.19Q178.38 131.00 177.88 129.81Q177.38 128.62 177.25 128.12Q177.12 127.62 177.12 126.88Q177.12 126.12 177.62 124.81Q178.12 123.50 178.88 122.69Q179.62 121.88 180.56 121.38Q181.50 120.88 183.69 120.88Q185.88 120.88 186.69 121.31Q187.50 121.75 188.19 121.94Q188.88 122.12 189.19 122.44Q189.50 122.75 190.25 123.19Q191.00 123.62 191.38 123.56Q191.75 123.50 191.81 123.38Q191.88 123.25 191.88 119.56Q191.88 115.88 191.81 115.81Q191.75 115.75 191.75 114.00Q191.75 112.25 191.69 112.06Q191.62 111.88 191.25 111.50Q190.88 111.12 189.88 111.00Q188.88 110.88 188.25 110.56Q187.62 110.25 187.12 110.12ZM57.31 107.06Q57.12 107.00 54.94 107.00Q52.75 107.00 52.50 107.19Q52.25 107.38 52.19 107.75Q52.12 108.12 52.25 109.25Q52.38 110.38 52.56 111.12Q52.75 111.88 52.75 112.31Q52.75 112.75 52.88 113.12Q53.00 113.50 53.00 114.50Q53.00 115.50 53.06 115.56Q53.12 115.62 53.12 117.25Q53.12 118.88 53.00 119.25Q52.88 119.62 52.69 119.75Q52.50 119.88 52.25 119.62Q52.00 119.38 51.50 118.50Q51.00 117.62 50.38 117.06Q49.75 116.50 49.25 116.25Q48.75 116.00 48.25 116.00Q47.75 116.00 47.44 116.12Q47.12 116.25 46.31 116.94Q45.50 117.62 44.88 118.81Q44.25 120.00 44.19 120.62Q44.12 121.25 43.88 122.06Q43.62 122.88 43.44 124.00Q43.25 125.12 43.31 128.56Q43.38 132.00 43.69 133.12Q44.00 134.25 44.12 135.19Q44.25 136.12 44.75 137.12Q45.25 138.12 45.75 138.62Q46.25 139.12 46.88 139.50Q47.50 139.88 48.19 139.88Q48.88 139.88 49.31 139.69Q49.75 139.50 50.25 139.06Q50.75 138.62 51.62 137.38Q52.50 136.12 52.69 136.25Q52.88 136.38 52.94 136.62Q53.00 136.88 52.88 137.38Q52.75 137.88 52.75 138.50Q52.75 139.12 52.88 139.25Q53.00 139.38 53.38 139.50Q53.75 139.62 55.19 139.62Q56.62 139.62 57.00 139.50Q57.38 139.38 57.56 139.12Q57.75 138.88 57.75 138.19Q57.75 137.50 57.50 136.69Q57.25 135.88 57.12 134.81Q57.00 133.75 57.00 123.44Q57.00 113.12 57.44 110.38Q57.88 107.62 57.69 107.38Q57.50 107.12 57.31 107.06ZM48.81 121.12Q49.38 120.75 50.12 120.81Q50.88 120.88 51.38 121.25Q51.88 121.62 52.06 122.12Q52.25 122.62 52.25 122.94Q52.25 123.25 52.44 123.81Q52.62 124.38 52.81 125.50Q53.00 126.62 53.00 127.94Q53.00 129.25 52.56 131.56Q52.12 133.88 51.94 134.25Q51.75 134.62 51.06 135.00Q50.38 135.38 49.94 135.38Q49.50 135.38 48.88 134.88Q48.25 134.38 47.81 133.12Q47.38 131.88 47.19 130.62Q47.00 129.38 47.00 128.06Q47.00 126.75 47.19 125.50Q47.38 124.25 47.81 122.88Q48.25 121.50 48.81 121.12ZM194.06 28.00Q191.12 28.00 190.25 28.44Q189.38 28.88 188.94 28.94Q188.50 29.00 187.62 29.50Q186.75 30.00 185.25 31.38Q183.75 32.75 183.00 33.62Q182.25 34.50 181.62 35.62Q181.00 36.75 180.69 37.12Q180.38 37.50 180.25 37.94Q180.12 38.38 179.69 39.12Q179.25 39.88 179.12 40.44Q179.00 41.00 178.69 41.56Q178.38 42.12 178.25 42.94Q178.12 43.75 177.69 44.88Q177.25 46.00 177.12 47.44Q177.00 48.88 176.62 50.50Q176.25 52.12 176.19 57.44Q176.12 62.75 176.19 62.81Q176.25 62.88 176.31 64.62Q176.38 66.38 176.69 67.44Q177.00 68.50 177.19 70.25Q177.38 72.00 177.69 72.69Q178.00 73.38 178.12 74.19Q178.25 75.00 178.56 75.62Q178.88 76.25 179.12 77.19Q179.38 78.12 179.69 78.56Q180.00 79.00 180.06 79.31Q180.12 79.62 180.75 80.75Q181.38 81.88 182.25 83.12Q183.12 84.38 184.94 86.12Q186.75 87.88 188.38 88.81Q190.00 89.75 190.75 89.88Q191.50 90.00 192.06 90.31Q192.62 90.62 193.12 90.75Q193.62 90.88 196.75 90.88Q199.88 90.88 200.31 90.75Q200.75 90.62 201.31 90.31Q201.88 90.00 202.62 89.81Q203.38 89.62 204.56 88.75Q205.75 87.88 206.31 87.31Q206.88 86.75 207.19 86.12Q207.50 85.50 207.50 84.88Q207.50 84.25 207.31 83.19Q207.12 82.12 207.00 79.06Q206.88 76.00 206.75 75.81Q206.62 75.62 206.31 75.69Q206.00 75.75 204.44 77.25Q202.88 78.75 202.31 78.94Q201.75 79.12 201.00 79.56Q200.25 80.00 198.06 80.00Q195.88 80.00 195.12 79.56Q194.38 79.12 193.81 78.94Q193.25 78.75 192.06 77.56Q190.88 76.38 190.00 75.00Q189.12 73.62 188.94 72.94Q188.75 72.25 188.38 71.44Q188.00 70.62 187.88 69.56Q187.75 68.50 187.44 67.44Q187.12 66.38 187.12 65.69Q187.12 65.00 187.31 64.81Q187.50 64.62 187.75 64.62Q188.00 64.62 189.19 65.69Q190.38 66.75 190.94 67.12Q191.50 67.50 191.94 67.69Q192.38 67.88 192.81 67.94Q193.25 68.00 193.81 68.31Q194.38 68.62 194.81 68.75Q195.25 68.88 196.44 68.88Q197.62 68.88 198.12 68.75Q198.62 68.62 199.12 68.31Q199.62 68.00 200.25 67.81Q200.88 67.62 202.06 66.75Q203.25 65.88 204.00 65.00Q204.75 64.12 205.88 62.19Q207.00 60.25 207.12 59.69Q207.25 59.12 207.56 58.50Q207.88 57.88 208.00 57.06Q208.12 56.25 208.38 55.62Q208.62 55.00 208.81 53.75Q209.00 52.50 208.94 48.19Q208.88 43.88 208.50 42.56Q208.12 41.25 208.00 40.19Q207.88 39.12 207.50 38.31Q207.12 37.50 207.00 36.94Q206.88 36.38 205.81 34.56Q204.75 32.75 203.94 31.94Q203.12 31.12 201.88 30.25Q200.62 29.38 200.19 29.19Q199.75 29.00 199.31 28.94Q198.88 28.88 198.19 28.50Q197.50 28.12 197.25 28.06Q197.00 28.00 194.06 28.00ZM193.12 38.81Q194.38 38.75 195.00 38.94Q195.62 39.12 196.25 39.75Q196.88 40.38 197.44 41.44Q198.00 42.50 198.12 43.69Q198.25 44.88 198.44 45.56Q198.62 46.25 198.75 48.44Q198.88 50.62 198.75 51.06Q198.62 51.50 198.62 52.06Q198.62 52.62 198.44 53.25Q198.25 53.88 198.19 54.75Q198.12 55.62 197.75 56.38Q197.38 57.12 197.12 57.88Q196.88 58.62 195.94 59.69Q195.00 60.75 194.12 61.19Q193.25 61.62 192.75 61.69Q192.25 61.75 191.12 61.25Q190.00 60.75 189.19 59.94Q188.38 59.12 187.81 58.06Q187.25 57.00 187.06 56.19Q186.88 55.38 187.00 52.50Q187.12 49.62 187.50 48.38Q187.88 47.12 187.94 46.19Q188.00 45.25 188.38 44.44Q188.75 43.62 188.88 43.06Q189.00 42.50 189.50 41.62Q190.00 40.75 190.56 40.06Q191.12 39.38 191.50 39.12Q191.88 38.88 193.12 38.81ZM66.19 27.06Q65.12 27.12 64.19 27.50Q63.25 27.88 62.38 28.00Q61.50 28.12 61.06 28.44Q60.62 28.75 60.00 29.00Q59.38 29.25 59.00 29.62Q58.62 30.00 58.06 30.38Q57.50 30.75 56.75 31.50Q56.00 32.25 55.06 33.50Q54.12 34.75 53.19 36.50Q52.25 38.25 52.12 38.88Q52.00 39.50 51.62 40.25Q51.25 41.00 51.12 41.88Q51.00 42.75 50.62 43.62Q50.25 44.50 50.12 46.00Q50.00 47.50 49.69 48.38Q49.38 49.25 49.31 50.62Q49.25 52.00 49.19 52.06Q49.12 52.12 49.12 59.19Q49.12 66.25 49.25 67.50Q49.38 68.75 49.75 70.31Q50.12 71.88 50.19 72.88Q50.25 73.88 50.69 75.00Q51.12 76.12 51.19 76.75Q51.25 77.38 51.62 78.12Q52.00 78.88 52.12 79.44Q52.25 80.00 52.62 80.56Q53.00 81.12 53.12 81.62Q53.25 82.12 53.62 82.62Q54.00 83.12 54.19 83.56Q54.38 84.00 55.12 85.00Q55.88 86.00 56.75 86.88Q57.62 87.75 58.12 88.12Q58.62 88.50 59.19 88.75Q59.75 89.00 60.06 89.31Q60.38 89.62 61.19 89.81Q62.00 90.00 62.88 90.44Q63.75 90.88 66.62 90.88Q69.50 90.88 69.94 90.75Q70.38 90.62 70.81 90.31Q71.25 90.00 71.94 89.88Q72.62 89.75 74.12 88.75Q75.62 87.75 76.00 87.69Q76.38 87.62 76.56 87.75Q76.75 87.88 76.88 88.12Q77.00 88.38 77.12 89.81Q77.25 91.25 77.50 92.12Q77.75 93.00 77.94 94.12Q78.12 95.25 78.12 96.44Q78.12 97.62 78.19 97.69Q78.25 97.75 78.31 99.12Q78.38 100.50 78.50 100.88Q78.62 101.25 78.62 101.75Q78.62 102.25 78.81 103.00Q79.00 103.75 79.00 104.50Q79.00 105.25 79.06 105.31Q79.12 105.38 79.19 126.06Q79.25 146.75 79.19 146.81Q79.12 146.88 79.12 149.69Q79.12 152.50 79.06 152.56Q79.00 152.62 79.00 153.38Q79.00 154.12 78.81 154.88Q78.62 155.62 78.62 156.12Q78.62 156.62 78.50 157.00Q78.38 157.38 78.38 158.12Q78.38 158.88 78.25 159.56Q78.12 160.25 78.12 161.44Q78.12 162.62 77.75 164.19Q77.38 165.75 77.19 167.75Q77.00 169.75 76.75 170.31Q76.50 170.88 76.50 171.12Q76.50 171.38 76.88 171.62Q77.25 171.88 86.44 171.88Q95.62 171.88 96.25 171.75Q96.88 171.62 97.88 171.25Q98.88 170.88 99.81 170.88Q100.75 170.88 101.62 170.44Q102.50 170.00 103.31 169.88Q104.12 169.75 104.56 169.44Q105.00 169.12 105.81 168.81Q106.62 168.50 108.12 167.56Q109.62 166.62 110.56 165.81Q111.50 165.00 112.62 163.81Q113.75 162.62 114.31 161.88Q114.88 161.12 115.00 160.75Q115.12 160.38 115.50 159.88Q115.88 159.38 116.00 158.94Q116.12 158.50 116.50 157.88Q116.88 157.25 117.00 156.44Q117.12 155.62 117.50 154.69Q117.88 153.75 117.94 152.06Q118.00 150.38 118.06 150.31Q118.12 150.25 118.06 149.62Q118.00 149.00 118.06 147.88Q118.12 146.75 118.06 146.69Q118.00 146.62 117.94 144.88Q117.88 143.12 117.50 142.19Q117.12 141.25 117.00 140.44Q116.88 139.62 116.50 138.94Q116.12 138.25 115.88 137.56Q115.62 136.88 115.44 136.69Q115.25 136.50 115.00 135.94Q114.75 135.38 113.81 134.25Q112.88 133.12 111.69 132.06Q110.50 131.00 110.06 130.69Q109.62 130.38 109.06 130.19Q108.50 130.00 107.81 129.56Q107.12 129.12 106.25 129.06Q105.38 129.00 104.94 128.88Q104.50 128.75 104.12 128.44Q103.75 128.12 103.75 127.88Q103.75 127.62 104.19 127.31Q104.62 127.00 105.62 126.88Q106.62 126.75 107.06 126.44Q107.50 126.12 108.06 125.94Q108.62 125.75 109.12 125.31Q109.62 124.88 110.00 124.69Q110.38 124.50 111.50 123.38Q112.62 122.25 112.81 121.88Q113.00 121.50 113.50 120.88Q114.00 120.25 114.50 119.31Q115.00 118.38 115.06 118.06Q115.12 117.75 115.50 117.00Q115.88 116.25 116.06 115.19Q116.25 114.12 116.50 113.50Q116.75 112.88 116.88 111.88Q117.00 110.88 117.00 109.56Q117.00 108.25 117.06 108.19Q117.12 108.12 117.06 106.06Q117.00 104.00 116.88 103.06Q116.75 102.12 116.44 101.38Q116.12 100.62 116.06 100.12Q116.00 99.62 115.50 98.62Q115.00 97.62 114.88 97.19Q114.75 96.75 114.25 96.00Q113.75 95.25 112.94 94.25Q112.12 93.25 111.25 92.50Q110.38 91.75 110.31 91.56Q110.25 91.38 110.56 91.06Q110.88 90.75 111.69 90.38Q112.50 90.00 113.00 89.94Q113.50 89.88 114.50 89.31Q115.50 88.75 116.12 88.25Q116.75 87.75 117.88 86.56Q119.00 85.38 119.88 84.06Q120.75 82.75 121.38 81.50Q122.00 80.25 122.06 79.88Q122.12 79.50 122.50 78.81Q122.88 78.12 123.06 77.19Q123.25 76.25 123.56 75.56Q123.88 74.88 123.94 73.94Q124.00 73.00 124.44 71.31Q124.88 69.62 124.94 67.62Q125.00 65.62 125.12 64.69Q125.25 63.75 125.25 59.12Q125.25 54.50 125.12 53.75Q125.00 53.00 125.00 51.56Q125.00 50.12 124.88 49.12Q124.75 48.12 124.44 47.12Q124.12 46.12 124.00 44.88Q123.88 43.62 123.50 42.75Q123.12 41.88 122.94 40.94Q122.75 40.00 122.50 39.62Q122.25 39.25 122.06 38.56Q121.88 37.88 121.25 36.62Q120.62 35.38 119.25 33.50Q117.88 31.62 116.38 30.38Q114.88 29.12 113.75 28.56Q112.62 28.00 112.06 28.00Q111.50 28.00 110.38 27.56Q109.25 27.12 108.25 27.06Q107.25 27.00 106.50 27.12Q105.75 27.25 105.12 27.56Q104.50 27.88 103.56 28.00Q102.62 28.12 102.25 28.44Q101.88 28.75 101.31 28.94Q100.75 29.12 100.06 29.62Q99.38 30.12 97.75 31.81Q96.12 33.50 95.25 34.94Q94.38 36.38 94.19 36.94Q94.00 37.50 93.62 38.12Q93.25 38.75 93.12 39.38Q93.00 40.00 92.62 40.75Q92.25 41.50 92.12 42.44Q92.00 43.38 91.62 44.31Q91.25 45.25 91.19 46.50Q91.12 47.75 90.81 48.88Q90.50 50.00 90.38 51.00Q90.25 52.00 90.25 53.06Q90.25 54.12 90.19 54.19Q90.12 54.25 90.19 60.44Q90.25 66.62 90.62 68.25Q91.00 69.88 91.12 71.50Q91.25 73.12 91.62 74.06Q92.00 75.00 92.12 75.94Q92.25 76.88 92.62 77.62Q93.00 78.38 93.12 79.00Q93.25 79.62 93.69 80.38Q94.12 81.12 94.31 81.69Q94.50 82.25 95.00 83.06Q95.50 83.88 95.88 84.31Q96.25 84.75 96.38 85.06Q96.50 85.38 96.19 85.69Q95.88 86.00 87.25 86.00Q78.62 86.00 78.38 85.81Q78.12 85.62 78.06 85.38Q78.00 85.12 78.88 83.81Q79.75 82.50 79.94 81.94Q80.12 81.38 80.50 80.81Q80.88 80.25 81.06 79.50Q81.25 78.75 81.56 78.19Q81.88 77.62 82.00 76.81Q82.12 76.00 82.50 75.06Q82.88 74.12 82.94 73.12Q83.00 72.12 83.31 71.00Q83.62 69.88 83.75 69.06Q83.88 68.25 83.94 60.12Q84.00 52.00 83.94 51.94Q83.88 51.88 83.88 50.88Q83.88 49.88 83.50 48.44Q83.12 47.00 83.00 45.69Q82.88 44.38 82.50 43.44Q82.12 42.50 82.00 41.62Q81.88 40.75 81.50 40.06Q81.12 39.38 81.00 38.75Q80.88 38.12 80.56 37.69Q80.25 37.25 80.00 36.56Q79.75 35.88 78.81 34.50Q77.88 33.12 76.69 31.81Q75.50 30.50 75.00 30.19Q74.50 29.88 74.19 29.56Q73.88 29.25 72.69 28.62Q71.50 28.00 71.00 28.00Q70.50 28.00 69.56 27.62Q68.62 27.25 67.94 27.12Q67.25 27.00 66.19 27.06ZM92.44 133.31Q92.75 133.12 93.12 133.12Q93.50 133.12 94.44 133.44Q95.38 133.75 96.56 133.88Q97.75 134.00 98.06 134.25Q98.38 134.50 99.12 134.81Q99.88 135.12 100.50 135.62Q101.12 136.12 101.94 136.94Q102.75 137.75 103.44 138.81Q104.12 139.88 104.19 140.19Q104.25 140.50 104.62 141.19Q105.00 141.88 105.19 143.38Q105.38 144.88 105.38 146.50Q105.38 148.12 105.31 148.19Q105.25 148.25 105.19 149.50Q105.12 150.75 104.69 151.62Q104.25 152.50 104.12 153.00Q104.00 153.50 103.38 154.44Q102.75 155.38 101.56 156.44Q100.38 157.50 99.69 157.88Q99.00 158.25 98.81 158.44Q98.62 158.62 98.19 158.81Q97.75 159.00 97.00 159.12Q96.25 159.25 95.50 159.62Q94.75 160.00 93.69 160.00Q92.62 160.00 92.38 159.88Q92.12 159.75 91.94 159.50Q91.75 159.25 91.75 146.81Q91.75 134.38 91.94 133.94Q92.12 133.50 92.44 133.31ZM93.94 97.88Q95.25 97.88 95.56 97.94Q95.88 98.00 96.38 98.31Q96.88 98.62 97.62 98.75Q98.38 98.88 99.62 99.69Q100.88 100.50 101.75 101.44Q102.62 102.38 103.38 103.81Q104.12 105.25 104.19 106.12Q104.25 107.00 104.44 107.62Q104.62 108.25 104.62 109.75Q104.62 111.25 104.31 113.12Q104.00 115.00 103.44 116.12Q102.88 117.25 102.50 117.81Q102.12 118.38 101.50 119.06Q100.88 119.75 100.19 120.25Q99.50 120.75 98.88 121.00Q98.25 121.25 97.81 121.56Q97.38 121.88 96.19 122.00Q95.00 122.12 93.94 122.44Q92.88 122.75 92.50 122.56Q92.12 122.38 91.94 121.94Q91.75 121.50 91.75 110.06Q91.75 98.62 91.94 98.38Q92.12 98.12 92.38 98.00Q92.62 97.88 93.94 97.88ZM106.38 38.38Q107.25 37.88 107.88 37.88Q108.50 37.88 108.88 38.06Q109.25 38.25 110.12 39.06Q111.00 39.88 111.50 40.56Q112.00 41.25 112.19 41.94Q112.38 42.62 112.75 43.38Q113.12 44.12 113.19 45.06Q113.25 46.00 113.56 47.00Q113.88 48.00 114.00 48.81Q114.12 49.62 114.19 53.88Q114.25 58.12 114.31 58.19Q114.38 58.25 114.25 63.50Q114.12 68.75 113.69 70.50Q113.25 72.25 113.19 73.19Q113.12 74.12 112.69 75.00Q112.25 75.88 112.19 76.25Q112.12 76.62 111.62 77.50Q111.12 78.38 110.44 79.06Q109.75 79.75 109.44 79.88Q109.12 80.00 107.88 80.00Q106.62 80.00 106.31 79.88Q106.00 79.75 105.19 78.94Q104.38 78.12 103.69 76.88Q103.00 75.62 102.94 75.00Q102.88 74.38 102.44 73.06Q102.00 71.75 101.94 70.38Q101.88 69.00 101.56 67.00Q101.25 65.00 101.25 63.62Q101.25 62.25 101.12 61.31Q101.00 60.38 101.12 56.75Q101.25 53.12 101.50 51.81Q101.75 50.50 101.94 48.12Q102.12 45.75 102.50 44.81Q102.88 43.88 103.00 43.12Q103.12 42.38 103.62 41.38Q104.12 40.38 104.81 39.62Q105.50 38.88 106.38 38.38ZM65.69 38.00Q66.00 37.88 66.88 37.94Q67.75 38.00 68.75 38.88Q69.75 39.75 70.31 40.56Q70.88 41.38 71.12 42.25Q71.38 43.12 71.75 43.94Q72.12 44.75 72.19 45.81Q72.25 46.88 72.56 48.00Q72.88 49.12 73.00 50.06Q73.12 51.00 73.12 54.50Q73.12 58.00 73.19 58.06Q73.25 58.12 73.19 62.62Q73.12 67.12 73.00 68.06Q72.88 69.00 72.62 69.75Q72.38 70.50 72.19 72.25Q72.00 74.00 71.69 74.56Q71.38 75.12 71.19 75.88Q71.00 76.62 70.50 77.44Q70.00 78.25 69.25 79.00Q68.50 79.75 68.19 79.88Q67.88 80.00 66.69 80.00Q65.50 80.00 65.19 79.88Q64.88 79.75 64.19 79.12Q63.50 78.50 62.81 77.44Q62.12 76.38 62.00 75.69Q61.88 75.00 61.44 73.75Q61.00 72.50 60.94 71.38Q60.88 70.25 60.56 68.81Q60.25 67.38 60.19 65.88Q60.12 64.38 60.06 64.31Q60.00 64.25 60.00 59.00Q60.00 53.75 60.12 53.06Q60.25 52.38 60.25 51.69Q60.25 51.00 60.38 50.69Q60.50 50.38 60.69 49.19Q60.88 48.00 61.00 46.50Q61.12 45.00 61.50 44.12Q61.88 43.25 62.00 42.56Q62.12 41.88 62.69 40.94Q63.25 40.00 63.81 39.44Q64.38 38.88 64.88 38.50Q65.38 38.12 65.69 38.00ZM252.06 4.12Q251.75 4.00 244.50 4.00Q237.25 4.00 236.94 4.12Q236.62 4.25 236.50 4.44Q236.38 4.62 236.75 6.12Q237.12 7.62 237.19 9.25Q237.25 10.88 237.44 12.06Q237.62 13.25 237.81 13.88Q238.00 14.50 238.19 19.00Q238.38 23.50 238.50 23.88Q238.62 24.25 238.62 25.31Q238.62 26.38 238.81 27.38Q239.00 28.38 239.00 33.75Q239.00 39.12 238.94 39.19Q238.88 39.25 238.88 40.00Q238.88 40.75 238.75 40.94Q238.62 41.12 238.50 41.12Q238.38 41.12 238.19 40.88Q238.00 40.62 237.56 39.69Q237.12 38.75 237.00 37.94Q236.88 37.12 236.44 36.31Q236.00 35.50 235.94 35.06Q235.88 34.62 235.56 34.19Q235.25 33.75 235.00 33.12Q234.75 32.50 234.38 32.00Q234.00 31.50 232.88 30.31Q231.75 29.12 231.06 28.62Q230.38 28.12 229.94 28.06Q229.50 28.00 228.69 27.62Q227.88 27.25 227.31 27.12Q226.75 27.00 225.88 27.12Q225.00 27.25 224.50 27.56Q224.00 27.88 223.25 28.00Q222.50 28.12 221.62 28.75Q220.75 29.38 220.06 30.06Q219.38 30.75 218.38 32.12Q217.38 33.50 217.25 33.94Q217.12 34.38 216.75 34.94Q216.38 35.50 216.19 36.25Q216.00 37.00 215.62 37.75Q215.25 38.50 215.19 39.12Q215.12 39.75 214.69 40.94Q214.25 42.12 214.19 43.19Q214.12 44.25 213.75 45.69Q213.38 47.12 213.25 48.38Q213.12 49.62 213.06 57.31Q213.00 65.00 213.06 65.06Q213.12 65.12 213.12 66.94Q213.12 68.75 213.19 68.81Q213.25 68.88 213.31 70.25Q213.38 71.62 213.69 72.56Q214.00 73.50 214.12 74.94Q214.25 76.38 214.62 77.31Q215.00 78.25 215.12 79.06Q215.25 79.88 215.62 80.62Q216.00 81.38 216.19 82.12Q216.38 82.88 216.94 83.94Q217.50 85.00 218.31 86.19Q219.12 87.38 219.94 88.19Q220.75 89.00 221.25 89.38Q221.75 89.75 222.06 89.81Q222.38 89.88 223.25 90.38Q224.12 90.88 226.44 90.88Q228.75 90.88 230.06 90.19Q231.38 89.50 231.88 89.12Q232.38 88.75 233.12 87.88Q233.88 87.00 234.88 85.31Q235.88 83.62 236.00 83.06Q236.12 82.50 236.44 82.00Q236.75 81.50 237.00 80.38Q237.25 79.25 237.69 78.38Q238.12 77.50 238.31 77.31Q238.50 77.12 238.69 77.44Q238.88 77.75 238.94 79.31Q239.00 80.88 238.81 82.19Q238.62 83.50 238.44 84.19Q238.25 84.88 238.19 85.75Q238.12 86.62 237.69 87.62Q237.25 88.62 237.25 89.06Q237.25 89.50 237.50 89.69Q237.75 89.88 244.81 89.88Q251.88 89.88 252.25 89.62Q252.62 89.38 252.62 89.12Q252.62 88.88 252.44 88.50Q252.25 88.12 252.12 87.56Q252.00 87.00 251.94 85.62Q251.88 84.25 251.50 82.56Q251.12 80.88 250.94 76.94Q250.75 73.00 250.62 72.50Q250.50 72.00 250.50 71.19Q250.50 70.38 250.38 70.00Q250.25 69.62 250.25 68.19Q250.25 66.75 250.12 65.94Q250.00 65.12 250.00 64.00Q250.00 62.88 250.06 62.81Q250.12 62.75 250.06 45.81Q250.00 28.88 250.12 28.00Q250.25 27.12 250.25 25.69Q250.25 24.25 250.38 23.88Q250.50 23.50 250.50 22.69Q250.50 21.88 250.62 21.38Q250.75 20.88 250.94 17.00Q251.12 13.12 251.50 11.44Q251.88 9.75 252.00 7.88Q252.12 6.00 252.31 5.50Q252.50 5.00 252.44 4.62Q252.38 4.25 252.06 4.12ZM228.94 40.31Q229.62 39.88 231.25 39.88Q232.88 39.88 233.38 40.12Q233.88 40.38 234.44 40.88Q235.00 41.38 235.50 42.12Q236.00 42.88 236.12 43.31Q236.25 43.75 236.69 44.56Q237.12 45.38 237.25 46.50Q237.38 47.62 237.75 48.81Q238.12 50.00 238.19 54.19Q238.25 58.38 238.31 58.44Q238.38 58.50 238.31 61.75Q238.25 65.00 238.19 65.06Q238.12 65.12 238.06 66.88Q238.00 68.62 237.69 69.62Q237.38 70.62 237.25 71.69Q237.12 72.75 236.69 73.62Q236.25 74.50 236.06 75.12Q235.88 75.75 235.44 76.31Q235.00 76.88 234.56 77.31Q234.12 77.75 233.00 78.38Q231.88 79.00 231.00 78.94Q230.12 78.88 229.25 78.38Q228.38 77.88 227.75 77.25Q227.12 76.62 226.56 75.62Q226.00 74.62 225.88 74.06Q225.75 73.50 225.44 72.94Q225.12 72.38 224.94 70.88Q224.75 69.38 224.44 68.25Q224.12 67.12 224.12 66.38Q224.12 65.62 224.06 65.56Q224.00 65.50 224.00 62.69Q224.00 59.88 223.94 59.81Q223.88 59.75 223.94 56.25Q224.00 52.75 224.12 51.81Q224.25 50.88 224.56 49.62Q224.88 48.38 224.94 47.50Q225.00 46.62 225.12 46.19Q225.25 45.75 225.50 45.31Q225.75 44.88 225.88 44.31Q226.00 43.75 226.56 42.81Q227.12 41.88 227.69 41.31Q228.25 40.75 228.94 40.31ZM139.19 4.00Q131.88 4.00 131.62 4.12Q131.38 4.25 131.31 4.38Q131.25 4.50 131.25 4.94Q131.25 5.38 131.69 7.00Q132.12 8.62 132.25 11.00Q132.38 13.38 132.62 14.31Q132.88 15.25 132.88 15.75Q132.88 16.25 133.00 16.81Q133.12 17.38 133.25 22.44Q133.38 27.50 133.50 27.88Q133.62 28.25 133.62 47.00Q133.62 65.75 133.50 66.19Q133.38 66.62 133.19 72.31Q133.00 78.00 132.69 79.44Q132.38 80.88 132.25 82.06Q132.12 83.25 132.12 84.25Q132.12 85.25 131.69 86.88Q131.25 88.50 131.25 88.94Q131.25 89.38 131.31 89.50Q131.38 89.62 131.62 89.75Q131.88 89.88 139.19 89.88Q146.50 89.88 146.75 89.75Q147.00 89.62 147.06 89.50Q147.12 89.38 147.00 87.62Q146.88 85.88 146.50 84.44Q146.12 83.00 146.00 80.44Q145.88 77.88 145.69 76.75Q145.50 75.62 145.50 75.12Q145.50 74.62 145.38 74.25Q145.25 73.88 145.25 73.19Q145.25 72.50 145.12 71.81Q145.00 71.12 145.00 68.06Q145.00 65.00 144.94 64.94Q144.88 64.88 144.88 61.69Q144.88 58.50 145.25 58.00Q145.62 57.50 146.25 57.31Q146.88 57.12 147.75 57.44Q148.62 57.75 149.06 57.81Q149.50 57.88 150.06 58.25Q150.62 58.62 151.19 59.19Q151.75 59.75 152.38 60.94Q153.00 62.12 153.12 63.00Q153.25 63.88 153.69 65.25Q154.12 66.62 154.19 68.25Q154.25 69.88 154.38 70.88Q154.50 71.88 154.75 72.69Q155.00 73.50 155.19 76.00Q155.38 78.50 155.69 79.38Q156.00 80.25 156.19 81.44Q156.38 82.62 156.62 83.00Q156.88 83.38 157.06 84.12Q157.25 84.88 157.88 85.94Q158.50 87.00 159.19 87.81Q159.88 88.62 160.50 89.12Q161.12 89.62 162.06 90.19Q163.00 90.75 164.00 90.81Q165.00 90.88 165.50 91.00Q166.00 91.12 167.31 91.12Q168.62 91.12 169.12 91.00Q169.62 90.88 170.56 90.81Q171.50 90.75 172.00 90.38Q172.50 90.00 173.06 89.75Q173.62 89.50 174.19 88.94Q174.75 88.38 174.88 88.12Q175.00 87.88 175.06 85.50Q175.12 83.12 175.06 83.06Q175.00 83.00 175.00 79.50Q175.00 76.00 174.94 75.81Q174.88 75.62 174.62 75.50Q174.38 75.38 173.25 76.12Q172.12 76.88 171.44 76.94Q170.75 77.00 170.38 76.81Q170.00 76.62 169.25 75.88Q168.50 75.12 168.25 74.62Q168.00 74.12 167.94 73.44Q167.88 72.75 167.50 71.50Q167.12 70.25 166.94 68.25Q166.75 66.25 166.44 65.50Q166.12 64.75 165.94 63.75Q165.75 62.75 165.19 61.62Q164.62 60.50 163.94 59.62Q163.25 58.75 162.38 57.94Q161.50 57.12 160.50 56.56Q159.50 56.00 159.19 56.00Q158.88 56.00 158.44 55.81Q158.00 55.62 157.44 55.19Q156.88 54.75 156.38 54.62Q155.88 54.50 155.94 54.38Q156.00 54.25 157.25 54.19Q158.50 54.12 158.88 54.00Q159.25 53.88 160.75 53.81Q162.25 53.75 162.69 53.44Q163.12 53.12 163.88 52.94Q164.62 52.75 165.00 52.44Q165.38 52.12 165.94 51.88Q166.50 51.62 167.69 50.50Q168.88 49.38 169.81 47.69Q170.75 46.00 170.88 45.56Q171.00 45.12 171.00 44.62Q171.00 44.12 171.25 43.25Q171.50 42.38 171.50 40.69Q171.50 39.00 171.25 37.94Q171.00 36.88 170.94 36.19Q170.88 35.50 170.38 34.44Q169.88 33.38 169.31 32.56Q168.75 31.75 168.12 31.12Q167.50 30.50 166.44 29.75Q165.38 29.00 165.00 28.94Q164.62 28.88 163.81 28.44Q163.00 28.00 161.62 28.00Q160.25 28.00 160.19 27.94Q160.12 27.88 157.69 27.94Q155.25 28.00 155.00 28.06Q154.75 28.12 154.06 28.56Q153.38 29.00 153.12 29.00Q152.88 29.00 152.62 29.12Q152.38 29.25 150.88 30.50Q149.38 31.75 148.44 33.12Q147.50 34.50 146.94 35.88Q146.38 37.25 146.19 38.12Q146.00 39.00 145.69 39.31Q145.38 39.62 145.12 39.12Q144.88 38.62 144.94 31.75Q145.00 24.88 145.06 24.81Q145.12 24.75 145.19 23.00Q145.25 21.25 145.38 20.88Q145.50 20.50 145.50 19.88Q145.50 19.25 145.62 18.88Q145.75 18.50 145.75 17.81Q145.75 17.12 145.81 17.06Q145.88 17.00 145.94 14.81Q146.00 12.62 146.44 10.50Q146.88 8.38 147.00 6.44Q147.12 4.50 146.81 4.25Q146.50 4.00 139.19 4.00ZM152.62 54.56Q152.50 54.38 152.62 54.25Q152.75 54.12 153.12 54.12Q153.50 54.12 153.69 54.31Q153.88 54.50 153.69 54.62Q153.50 54.75 153.12 54.75Q152.75 54.75 152.62 54.56ZM156.00 38.81Q156.88 39.12 157.44 39.75Q158.00 40.38 158.44 41.31Q158.88 42.25 159.00 42.81Q159.12 43.38 159.06 44.25Q159.00 45.12 158.62 45.88Q158.25 46.62 158.19 47.00Q158.12 47.38 157.88 47.75Q157.62 48.12 156.69 49.00Q155.75 49.88 154.75 50.44Q153.75 51.00 153.31 51.00Q152.88 51.00 152.38 51.12Q151.88 51.25 149.19 51.25Q146.50 51.25 146.25 51.12Q146.00 51.00 145.75 50.62Q145.50 50.25 145.50 49.81Q145.50 49.38 145.62 49.06Q145.75 48.75 145.94 47.00Q146.12 45.25 146.44 44.62Q146.75 44.00 146.88 43.50Q147.00 43.00 147.69 41.88Q148.38 40.75 149.25 39.94Q150.12 39.12 151.44 38.50Q152.75 37.88 153.50 37.94Q154.25 38.00 154.69 38.25Q155.12 38.50 156.00 38.81ZM14.12 4.00Q4.62 4.00 4.38 4.19Q4.12 4.38 4.06 4.75Q4.00 5.12 4.19 6.50Q4.38 7.88 4.75 9.25Q5.12 10.62 5.25 13.00Q5.38 15.38 5.62 16.31Q5.88 17.25 5.88 17.75Q5.88 18.25 6.00 18.75Q6.12 19.25 6.25 24.31Q6.38 29.38 6.50 29.75Q6.62 30.12 6.62 47.19Q6.62 64.25 6.50 64.69Q6.38 65.12 6.19 70.44Q6.00 75.75 5.69 77.12Q5.38 78.50 5.25 80.75Q5.12 83.00 4.69 84.81Q4.25 86.62 4.12 87.94Q4.00 89.25 4.31 89.56Q4.62 89.88 13.75 89.88Q22.88 89.88 23.56 89.75Q24.25 89.62 24.94 89.31Q25.62 89.00 27.06 88.88Q28.50 88.75 29.19 88.38Q29.88 88.00 30.62 87.88Q31.38 87.75 31.88 87.38Q32.38 87.00 33.06 86.81Q33.75 86.62 34.19 86.25Q34.62 85.88 35.12 85.69Q35.62 85.50 36.19 85.12Q36.75 84.75 37.75 83.94Q38.75 83.12 39.69 82.19Q40.62 81.25 41.62 79.81Q42.62 78.38 42.88 77.75Q43.12 77.12 43.50 76.56Q43.88 76.00 43.94 75.56Q44.00 75.12 44.44 74.06Q44.88 73.00 44.94 72.19Q45.00 71.38 45.25 70.12Q45.50 68.88 45.50 66.50Q45.50 64.12 45.38 63.75Q45.25 63.38 45.06 61.56Q44.88 59.75 44.50 58.94Q44.12 58.12 44.00 57.44Q43.88 56.75 43.31 55.62Q42.75 54.50 41.50 52.81Q40.25 51.12 39.38 50.31Q38.50 49.50 37.38 48.75Q36.25 48.00 35.88 47.94Q35.50 47.88 35.19 47.62Q34.88 47.38 34.44 47.19Q34.00 47.00 33.44 47.00Q32.88 47.00 32.38 46.88Q31.88 46.75 31.44 46.38Q31.00 46.00 31.19 45.62Q31.38 45.25 31.88 45.06Q32.38 44.88 33.19 44.81Q34.00 44.75 35.81 43.69Q37.62 42.62 38.75 41.50Q39.88 40.38 40.88 38.88Q41.88 37.38 42.00 36.94Q42.12 36.50 42.50 35.88Q42.88 35.25 43.00 34.50Q43.12 33.75 43.50 32.88Q43.88 32.00 43.94 30.81Q44.00 29.62 44.25 28.19Q44.50 26.75 44.50 25.44Q44.50 24.12 44.38 23.69Q44.25 23.25 44.06 21.25Q43.88 19.25 43.50 18.44Q43.12 17.62 42.88 16.75Q42.62 15.88 42.19 15.06Q41.75 14.25 40.75 12.88Q39.75 11.50 39.12 10.88Q38.50 10.25 37.50 9.56Q36.50 8.88 36.19 8.56Q35.88 8.25 34.94 7.69Q34.00 7.12 33.69 7.06Q33.38 7.00 32.62 6.56Q31.88 6.12 31.06 6.00Q30.25 5.88 29.44 5.44Q28.62 5.00 27.62 5.00Q26.62 5.00 25.75 4.62Q24.88 4.25 24.25 4.12Q23.62 4.00 14.12 4.00ZM19.62 51.38Q20.00 51.12 20.44 51.12Q20.88 51.12 22.12 51.50Q23.38 51.88 24.19 51.94Q25.00 52.00 26.69 53.00Q28.38 54.00 29.19 54.81Q30.00 55.62 31.00 57.25Q32.00 58.88 32.19 60.06Q32.38 61.25 32.69 62.44Q33.00 63.62 32.94 64.94Q32.88 66.25 32.62 67.06Q32.38 67.88 32.25 68.75Q32.12 69.62 31.56 70.81Q31.00 72.00 30.50 72.75Q30.00 73.50 29.25 74.25Q28.50 75.00 27.88 75.44Q27.25 75.88 26.88 76.00Q26.50 76.12 26.06 76.50Q25.62 76.88 25.00 76.94Q24.38 77.00 23.19 77.50Q22.00 78.00 20.88 78.00Q19.75 78.00 19.38 77.69Q19.00 77.38 19.00 64.81Q19.00 52.25 19.12 51.94Q19.25 51.62 19.62 51.38ZM21.25 15.88Q22.75 15.88 23.62 16.31Q24.50 16.75 25.06 16.81Q25.62 16.88 26.62 17.44Q27.62 18.00 28.81 19.19Q30.00 20.38 30.56 21.38Q31.12 22.38 31.25 23.12Q31.38 23.88 31.69 24.69Q32.00 25.50 32.06 27.31Q32.12 29.12 31.56 31.50Q31.00 33.88 30.75 34.19Q30.50 34.50 30.12 35.25Q29.75 36.00 28.25 37.44Q26.75 38.88 26.31 39.00Q25.88 39.12 25.19 39.56Q24.50 40.00 23.44 40.06Q22.38 40.12 21.25 40.44Q20.12 40.75 19.81 40.62Q19.50 40.50 19.25 40.06Q19.00 39.62 19.00 28.06Q19.00 16.50 19.38 16.19Q19.75 15.88 21.25 15.88Z" fill="#39B8AC" fill-rule="evenodd"/></svg>`;
function renderShell() {
  const urgent = state.bookings.filter((b) => urgency(b).level === 'red').length;
  const navBtn = (t) => `<li><button type="button" data-action="go" data-tab="${t.id}" ${ui.tab === t.id ? 'aria-current="page"' : ''}>${icon(t.id)}<span>${t.label}</span>${t.id === 'bookings' && urgent ? `<span class="badge" title="${urgent} urgent">${urgent}</span>` : ''}</button></li>`;
  patch($('#sidebar'), `
    <div class="side-brand">
      <div class="wordmark">${LOGO_SVG}</div>
      <div class="tagline">Everyone on the same page.</div>
      <span class="edition-chip">${CITY.localName}</span>
    </div>
    <ul class="navlist">${TABS.map(navBtn).join('')}</ul>
    <div class="side-foot">${backupCard()}</div>`);

  const active = BOTTOM_TABS.includes(ui.tab) ? ui.tab : 'more';
  patch($('#bottomnav'), BOTTOM_TABS.map((id) => {
    const t = TABS.find((x) => x.id === id);
    return `<button type="button" data-action="go" data-tab="${id}" ${active === id ? 'aria-current="page"' : ''}>${icon(id)}<span>${t.short}</span></button>`;
  }).join('') + `<button type="button" data-action="more" ${active === 'more' ? 'aria-current="page"' : ''}><span class="ico" aria-hidden="true">☰</span><span>More${urgent ? ` <span class="badge" style="position:absolute;top:8px;right:calc(50% - 22px)">${urgent}</span>` : ''}</span></button>`);

  const t = TABS.find((x) => x.id === ui.tab);
  patch($('#topbar'), `
    <div class="brandmark">${LOGO_SVG}</div>
    <span class="edition-chip only-mobile">${CITY.localName}</span>
    <span class="title-sm only-desktop">${esc(state.trip.name)} · ${esc(t.label)}</span>
    <span class="spacer"></span>
    ${SYNC.on ? `${meButton()}<span class="sync-pill ${SYNC.status}" title="${esc(syncLabel())}"><i></i><span class="only-desktop">${esc(syncLabel())}</span></span>
    <button type="button" class="btn small primary" data-action="shareLink">${svgIcon('share')} <span>Share</span></button>`
    : `<span class="faint" id="saveState" style="font-size:12px;font-weight:600">${lastSaved ? 'Saved ✓' : ''}</span>
    <button type="button" class="icon-btn only-mobile" data-action="exportData" aria-label="Download a copy" title="Download a copy">${svgIcon('download')}</button>`}`);
}

function svgIcon(name) {
  const p = {
    download: '<path d="M12 3v12m0 0-4.5-4.5M12 15l4.5-4.5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
    upload: '<path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
    trash: '<path d="M4 7h16M10 11v6m4-6v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    share: '<path d="M8.5 13.5l7-4M8.5 10.5l7 4"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="7" r="2.5"/><circle cx="18" cy="17" r="2.5"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  }[name];
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}

function backupCard() {
  if (SYNC.on) {
    return `<div class="backup-card">
    <h4>Your trip link</h4>
    <p>Everything saves automatically and updates live for everyone who has this link.</p>
    <div class="btns">
      <button type="button" class="btn small primary" data-action="shareLink">${svgIcon('share')} Share the trip link</button>
      <button type="button" class="btn small" data-action="exportData">${svgIcon('download')} Download a copy</button>
    </div>
  </div>`;
  }
  let last = null;
  try { last = localStorage.getItem(BACKUP_KEY); } catch (e) { /* ignore */ }
  return `<div class="backup-card">
    <h4>Keep your trip safe</h4>
    <p>Everything saves to this browser automatically. Download a copy to keep it or move it to another device.</p>
    <div class="btns">
      <button type="button" class="btn small dark" data-action="exportData">${svgIcon('download')} Download a copy</button>
      <button type="button" class="btn small" data-action="importData">${svgIcon('upload')} Open a copy</button>
      <button type="button" class="linkish" style="font-size:12.5px;margin-top:4px;align-self:center" data-action="resetMenu">Start over…</button>
    </div>
    <div class="storage">${last ? `Last copy downloaded ${fmtDate(new Date(last))}` : 'No copy downloaded yet'}</div>
  </div>`;
}

function viewHead(tabId, title, lede, actions = '') {
  const t = TABS.find((x) => x.id === tabId);
  return `<div class="view-head">
    <div style="min-width:0;flex:1 1 280px">
      <div class="eyebrow">${icon(tabId)}${esc(t.label)}</div>
      <h1>${title}</h1>
      ${lede ? `<p class="lede">${lede}</p>` : ''}
    </div>
    ${actions ? `<div class="actions">${actions}</div>` : ''}
  </div>`;
}
const emptyState = (art, hand, title, text, btn = '') => `<div class="empty"><div class="art">${art}</div><span class="hand">${hand}</span><h3>${title}</h3><p>${text}</p>${btn}</div>`;
const avatar = (g, cls = '') => (g ? `<span class="avatar ${cls}" style="--c:${g.color}" title="${esc(g.name)}">${esc(initials(g.name))}</span>` : '');
const gchip = (g, on, attrs) => `<button type="button" class="gchip" style="--c:${g.color}" aria-pressed="${on}" ${attrs}><span class="avatar">${esc(initials(g.name))}</span>${esc(firstName(g.name))}</button>`;
const bar = (p, cls = '') => `<div class="bar ${cls}" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100"><i style="--p:${clamp(p, 0, 100)}%"></i></div>`;
const noGuests = (what) => emptyState('💌', 'first step', 'Add your group', `Once your travelers are on the Guest List, ${what}.`, '<button type="button" class="btn primary" data-action="go" data-tab="guests">Go to Guest List</button>');
const check = (attrs, on, label = '') => `<span class="check"><input type="checkbox" ${attrs} ${on ? 'checked' : ''} ${label ? `aria-label="${esc(label)}"` : ''}><span class="box"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg></span></span>`;

/* ==========================================================================
   HOME
   ========================================================================== */
const heroArt = () => CITY_HERO;

function countdownStamp() {
  const p = tripPhase();
  const days = tripDays();
  let big = '?', lbl = 'set your dates';
  if (p.phase === 'before') { big = p.until; lbl = p.until === 1 ? `day until ${CITY.name}` : `days until ${CITY.name}`; }
  else if (p.phase === 'during') { big = p.index + 1; lbl = `day ${p.index + 1} of ${days.length} · in ${CITY.name}`; }
  else if (p.phase === 'after') { big = '✓'; lbl = 'trip complete'; }
  const start = days[0] ? days[0].date : null;
  return `<div class="stamp-wrap" aria-label="${esc(`${big} ${lbl}`)}">
    <div class="stamp"><div class="stamp-inner"><div class="roma">${CITY.localName}</div><div class="big num">${big}</div><div class="lbl">${lbl}</div></div></div>
    <div class="postmark" aria-hidden="true"><span>${CITY.localName}<br>${start ? esc(start.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })) : '— —'}<br>B&amp;B</span>
      <svg class="wave" viewBox="0 0 70 30" fill="none" stroke="rgba(47,61,51,.5)" stroke-width="2"><path d="M0 5q9-6 17 0t17 0 17 0 19 0M0 15q9-6 17 0t17 0 17 0 19 0M0 25q9-6 17 0t17 0 17 0 19 0"/></svg>
    </div>
  </div>`;
}

function viewHome() {
  const tr = state.trip;
  const days = tripDays();
  const spent = spentTotal();
  const ps = packStats();
  const p = tripPhase();
  const confirmed = state.guests.filter((g) => g.confirmed).length;
  let welcome = true;
  try { welcome = !localStorage.getItem(WELCOME_KEY + (SYNC.on ? ':' + SYNC.tripId : '')); } catch (e) { /* ignore */ }
  const remaining = tr.budget - spent;
  const unscheduled = state.activities.filter((a) => !isScheduled(a.id)).length;
  const voters = state.guests.filter((g) => state.activities.some((a) => a.votes.includes(g.id))).length;
  const daysLabel = p.phase === 'before' ? p.until : p.phase === 'during' ? `Day ${p.index + 1}` : p.phase === 'after' ? '✓' : '—';

  return `
  <div class="hero">
    <div class="hero-photo">
      <div class="hero-art">${heroArt()}</div>
      ${countdownStamp()}
      <div class="hero-inner">
        <div class="hero-card">
          ${doodle(1, 'right:-18px;top:-30px;width:70px;transform:rotate(10deg)')}
          <div class="kicker">Booked &amp; Busy · ${CITY.name}</div>
          <label class="sr-only" for="tripName">Trip name</label>
          <textarea id="tripName" class="trip-name autosize" rows="1" data-bind="trip::name" maxlength="80" placeholder="Name your trip">${esc(tr.name)}</textarea>
          <div class="date-row">
            <label class="sr-only" for="tripStart">Start date</label>
            <input id="tripStart" type="date" data-bind="trip::start" data-after="fixDates" value="${esc(tr.start)}">
            <span class="arrow">→</span>
            <label class="sr-only" for="tripEnd">End date</label>
            <input id="tripEnd" type="date" data-bind="trip::end" data-after="fixDates" value="${esc(tr.end)}" min="${esc(tr.start)}">
            ${days.length ? `<span class="chip mint">${pl(days.length, 'day')} · ${pl(Math.max(0, days.length - 1), 'night')}</span>` : ''}
          </div>
        </div>
      </div>
    </div>
  </div>

  ${welcome ? `<div class="card mint washi" style="margin-bottom:18px" data-key="welcome">
    <div class="row" style="align-items:flex-start">
      <div style="flex:1;min-width:0">
        <span class="hand" style="font-size:21px;color:var(--ochre)">Start here</span>
        ${SYNC.on
          ? `<p style="margin-top:4px">Add everyone on the <button type="button" class="linkish" data-action="go" data-tab="guests">Guest List</button>, set your dates above, then send this link to your group. Anyone with the link can see and edit the trip, and changes show up for everyone right away.</p>
             <div class="share-box"><code>${esc(tripLink())}</code><button type="button" class="btn small primary" data-action="shareLink">Copy link</button></div>`
          : `<p style="margin-top:4px">This is a sample trip so you can see how everything works. Rename it above, set your dates, add your group on the Guest List, and edit or delete anything. Want a clean slate? <button type="button" class="linkish" data-action="resetMenu">Start with a blank trip</button>.</p>`}
      </div>
      <button type="button" class="icon-btn" data-action="dismissWelcome" aria-label="Dismiss">${svgIcon('x')}</button>
    </div>
  </div>` : ''}

  <div class="stats">
    <button type="button" class="card lift stat" data-action="go" data-tab="budget">
      <span class="kicker">Budget</span>${icon('budget')}
      <span class="v num">${money(spent)} <small>of ${money(tr.budget)}</small></span>
      ${bar(pct(spent, tr.budget), `ochre ${spent > tr.budget && tr.budget ? 'over' : ''}`)}
      <span class="s">${tr.budget ? (remaining >= 0 ? `${money(remaining)} left` : `${money(-remaining)} over budget`) : 'Set a total budget →'}</span>
    </button>
    <button type="button" class="card lift stat" data-action="go" data-tab="packing">
      <span class="kicker">Packing</span>${icon('packing')}
      <span class="v num">${ps.pct}<small>% packed</small></span>
      ${bar(ps.pct)}
      <span class="s">${ps.total ? `${ps.done} of ${ps.total} items across the group` : 'No packing lists yet'}</span>
    </button>
    <button type="button" class="card lift stat" data-action="go" data-tab="itinerary">
      <span class="kicker">${p.phase === 'during' ? `In ${CITY.name}` : p.phase === 'after' ? 'Trip' : 'Countdown'}</span>${icon('itinerary')}
      <span class="v num">${daysLabel} <small>${p.phase === 'before' ? (p.until === 1 ? 'day to go' : 'days to go') : p.phase === 'during' ? `of ${days.length}` : p.phase === 'after' ? 'complete' : 'no dates yet'}</small></span>
      <span class="s">${days.length ? `${fmtDay(days[0].date)} → ${fmtDay(days[days.length - 1].date)}` : 'Add dates in the card above'}</span>
    </button>
    <button type="button" class="card lift stat" data-action="go" data-tab="guests">
      <span class="kicker">Group</span>${icon('guests')}
      <span class="v num">${confirmed}<small> of ${state.guests.length} confirmed</small></span>
      <span class="avatars">${state.guests.slice(0, 8).map((g) => avatar(g, 'sm')).join('')}</span>
      <span class="s">${state.guests.length - confirmed ? `${pl(state.guests.length - confirmed, 'person')} still deciding` : state.guests.length ? 'Everyone’s confirmed' : 'Add your travelers'}</span>
    </button>
  </div>

  <div class="section">
    <h2 class="section-title">Quick links</h2>
    <div class="tiles">
      <button type="button" class="tile t1" data-action="go" data-tab="itinerary">${icon('itinerary')}<div><b>Itinerary</b><span>${pl(state.itinerary.length, 'plan')} across ${pl(days.length, 'day')}</span></div><span class="go">→</span></button>
      <button type="button" class="tile t2" data-action="go" data-tab="budget">${icon('budget')}<div><b>Budget</b><span>${money(spent)} logged · ${pl(settleUp().length, 'payback')}</span></div><span class="go">→</span></button>
      <button type="button" class="tile t3" data-action="go" data-tab="packing">${icon('packing')}<div><b>Packing</b><span>${ps.pct}% of the group packed</span></div><span class="go">→</span></button>
      <button type="button" class="tile t4" data-action="go" data-tab="vote">${icon('vote')}<div><b>Group Picks</b><span>${pl(unscheduled, 'idea')} to decide · ${pl(voters, 'voter')}</span></div><span class="go">→</span></button>
    </div>
  </div>`;
}

/* ==========================================================================
   DASHBOARD
   ========================================================================== */
function agendaList(items, highlightNext) {
  const now = new Date();
  const hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const nextId = highlightNext ? (items.find((i) => i.time && i.time >= hhmm) || {}).id : null;
  return `<ul class="agenda">${items.map((i) => `<li style="${i.id === nextId ? 'background:var(--ochre-soft);border-radius:10px;padding-left:8px;padding-right:8px;margin:0 -8px' : ''}">
    <span class="t">${i.time ? fmtTime(i.time) : 'Anytime'}</span>
    <div><div class="ti">${esc(i.title)} ${i.id === nextId ? '<span class="chip ochre" style="margin-left:4px">Up next</span>' : ''}</div>${i.note ? `<div class="no">${esc(i.note)}</div>` : ''}</div>
  </li>`).join('')}</ul>`;
}
const itemsForDay = (i) => state.itinerary.filter((x) => x.day === i).sort((a, b) => (a.time || '99') < (b.time || '99') ? -1 : 1);

function viewDashboard() {
  const p = tripPhase();
  const days = tripDays();
  let todayCard;
  if (p.phase === 'nodates') {
    todayCard = emptyState('🗓️', 'no dates yet', 'When are you going?', 'Add your trip dates on the Home page to see each day’s plan here.', '<button type="button" class="btn primary" data-action="go" data-tab="home">Set trip dates</button>');
  } else if (p.phase === 'before') {
    const first = itemsForDay(0);
    todayCard = `<div class="card washi today-card">
      <div class="kicker">Today · ${esc(fmtLong(today()))}</div>
      <h3 style="font-size:26px;margin:6px 0 4px">The trip hasn’t started yet</h3>
      <p class="muted">${p.until === 1 ? 'Tomorrow is the day.' : `${p.until} days until ${CITY.name}.`} Here’s how Day 1 looks so far:</p>
      <div style="margin-top:12px"><div class="dayname">Day 1 · ${esc(fmtDay(days[0].date))}</div>
      ${first.length ? agendaList(first) : '<p class="faint" style="padding:10px 0">Nothing planned for Day 1 yet.</p>'}</div>
      <button type="button" class="btn small" data-action="go" data-tab="itinerary" style="margin-top:8px">See the full itinerary →</button>
    </div>`;
  } else if (p.phase === 'during') {
    const its = itemsForDay(p.index);
    todayCard = `<div class="card washi ochre-tape today-card" style="border:2px solid var(--ochre)">
      <div class="kicker">Today · Day ${p.index + 1} of ${days.length}</div>
      <h3 style="font-size:26px;margin:6px 0 10px">${esc(fmtLong(days[p.index].date))}</h3>
      ${its.length ? agendaList(its, true) : '<p class="faint" style="padding:10px 0">Nothing planned today.</p>'}
      <div class="row wrap" style="margin-top:10px">
        <button type="button" class="btn small" data-action="go" data-tab="itinerary">Full itinerary</button>
        <button type="button" class="btn small" data-action="writeDay" data-day="${p.index}">Write today’s memory</button>
      </div>
    </div>`;
  } else {
    todayCard = `<div class="card espresso today-card">
      <div class="kicker">After the trip</div>
      <h3 style="font-size:28px;margin:8px 0 6px">That’s a wrap.</h3>
      <p style="opacity:.8;margin-bottom:14px">Write down the highlights while they’re fresh, and settle up anything that’s left.</p>
      <div class="row wrap"><button type="button" class="btn primary" data-action="go" data-tab="memories">Open Memories</button>
      <button type="button" class="btn small" style="background:transparent;color:var(--cream);border-color:rgba(251,246,236,.5)" data-action="go" data-tab="budget">Settle up</button></div>
    </div>`;
  }

  const unbooked = state.bookings.filter((b) => !b.booked);
  const urgentN = unbooked.filter((b) => urgency(b).level === 'red').length;
  const ps = packStats();
  const ranked = rankedActivities().filter((r) => !isScheduled(r.a.id) && r.n > 0);
  const half = Math.ceil(state.guests.length / 2);
  const favs = ranked.filter((r) => r.n >= half);
  const tie = ranked.length > 1 && ranked[0].n === ranked[1].n ? ranked.filter((r) => r.n === ranked[0].n) : [];
  const nonVoters = state.guests.filter((g) => !state.activities.some((a) => a.votes.includes(g.id)));
  const settle = settleUp();
  const pending = state.guests.filter((g) => !g.confirmed);
  const row = (n, label, sub, tab) => `<li><button type="button" data-action="go" data-tab="${tab}"><span class="n num ${n ? '' : 'zero'}">${n || '✓'}</span><span class="lbl">${label}<small>${sub}</small></span><span class="chev">→</span></button></li>`;

  const spent = spentTotal();
  const b = state.trip.budget;
  const next = sortedBookings().filter((x) => !x.booked).slice(0, 3);

  return viewHead('dashboard', `Today`, 'Today’s plan, what’s still open, and where the budget stands.') + `
  <div class="grid cols-2">
    <div class="span-2">${todayCard}</div>
    ${bookFirstCard(p)}
    <div class="card">
      <div class="card-head"><h3>What’s left to do</h3></div>
      <ul class="todo-list">
        ${row(unbooked.length, unbooked.length === 1 ? 'booking still to make' : 'bookings still to make', urgentN ? `${urgentN} urgent — book these first` : unbooked.length ? 'Nothing urgent yet' : 'All booked!', 'bookings')}
        ${row(ps.total - ps.done, 'items left to pack', `${ps.pct}% packed across the group`, 'packing')}
        ${row(favs.length, favs.length === 1 ? 'crowd favorite not scheduled' : 'crowd favorites not scheduled', tie.length ? `Tie: ${tie.slice(0, 3).map((r) => esc(r.a.title.split(/[—(+&]/)[0].trim())).join(' vs. ')} (${pl(tie[0].n, 'vote')} each)` : nonVoters.length ? `${pl(nonVoters.length, 'person hasn’t', 'people haven’t')} voted yet` : 'Everyone has voted', 'vote')}
        ${row(settle.length, settle.length === 1 ? 'payment to settle up' : 'payments to settle up', settle.length ? `Largest: ${money(Math.max(...settle.map((s) => s.amount)))}` : 'Everyone’s square', 'budget')}
        ${row(pending.length, pending.length === 1 ? 'guest still deciding' : 'guests still deciding', pending.length ? pending.map((g) => esc(firstName(g.name))).join(', ') : 'Everyone’s confirmed', 'guests')}
        ${CITY.closures ? (() => { const c = closedPlans(); return row(c.length, c.length === 1 ? 'plan on a closed day' : 'plans on a closed day', c.length ? c.map((i) => esc(itemClosure(i).venue)).join(', ') : 'No clashes with closing days', 'itinerary'); })() : ''}
      </ul>
    </div>
    <div class="stack">
      <div class="card">
        <div class="card-head"><h3>Budget</h3><button type="button" class="btn small ghost" data-action="go" data-tab="budget">Details →</button></div>
        <div class="row between" style="margin-bottom:8px"><span class="big-money num" style="font-size:30px">${money(spent)}</span><span class="muted" style="font-weight:600">of ${money(b)}</span></div>
        ${bar(pct(spent, b), `fat ochre ${spent > b && b ? 'over' : ''}`)}
        <p class="muted" style="margin-top:8px;font-size:13.5px">${b ? (b - spent >= 0 ? `${money(b - spent)} remaining` : `${money(spent - b)} over`) : 'No total budget set'}${state.guests.length && b ? ` · ${money(Math.round(b / state.guests.length))} per person planned` : ''}</p>
      </div>
      <div class="card">
        <div class="card-head"><h3>Next deadlines</h3></div>
        ${next.length ? next.map((x) => { const u = urgency(x); return `<button type="button" class="settle" style="width:100%;border:0;background:none;text-align:left;font:inherit;color:inherit" data-action="go" data-tab="bookings"><span class="dot ${u.level}"></span><span style="flex:1;min-width:0"><b style="display:block;font-weight:600">${esc(x.title)}</b><small class="muted">Book by ${esc(fmtDate(parseISO(x.bookBy))) || '—'} · ${esc(u.label)}</small></span></button>`; }).join('') : '<p class="muted">Nothing left to book.</p>'}
      </div>
    </div>
    ${gettingAroundCard()}
    <div class="span-2 only-mobile">${backupCard()}</div>
  </div>`;
}

/** "Book these first": big-ticket bookings whose booking window the trip is now inside. */
function bookFirstCard(p) {
  if (!CITY.bookFirst || p.phase !== 'before') return '';
  const list = CITY.bookFirst.map((r) => ({ r, b: state.bookings.find((x) => x.id === r.bookingId) })).filter(({ r, b }) => b && !b.booked && p.until <= r.windowDays);
  if (!list.length) return '';
  return `<div class="span-2"><div class="card book-first" data-key="book-first">
    <div class="card-head">${art('eiffel-tower', '🎟️')}<h3>Book these first</h3><span class="chip red">${pl(p.until, 'day')} to go</span></div>
    <p class="muted" style="font-size:13.5px;margin:-4px 0 4px">Your trip is inside the booking window for ${list.length === 1 ? 'this one' : 'these'}, and ${list.length === 1 ? 'it sells' : 'they sell'} out first.</p>
    ${list.map(({ r, b }) => `<button type="button" class="settle" style="width:100%;border:0;background:none;text-align:left;font:inherit;color:inherit" data-action="go" data-tab="bookings"><span class="dot ${urgency(b).level}"></span><span style="flex:1;min-width:0"><b style="display:block;font-weight:600">${esc(b.title)}</b><small class="muted">${esc(r.why)}</small></span><span class="chev">→</span></button>`).join('')}
  </div></div>`;
}
function gettingAroundCard() {
  const ga = CITY.gettingAround;
  if (!ga) return '';
  return `<div class="span-2"><div class="card" data-key="getting-around">
    <div class="card-head"><h3>${esc(ga.title)}</h3></div>
    <div class="tip-cards">${ga.tips.map((t) => `<div class="tip-card">${art(t.icon, t.emoji)}<div><b>${esc(t.head)}</b><p>${esc(t.text)}</p></div></div>`).join('')}</div>
  </div></div>`;
}

/* ==========================================================================
   GUEST LIST
   ========================================================================== */
function viewGuests() {
  const gs = state.guests;
  const confirmed = gs.filter((g) => g.confirmed).length;
  const diets = dietNotes().length;
  const tr = state.trip;
  return viewHead('guests', `Who’s going`, 'Add everyone once. Their names show up in voting, packing, bookings and the budget automatically.') + `
  <form class="card row" data-form="addGuest" style="margin-bottom:14px;gap:8px">
    <label class="sr-only" for="newGuest">Traveler name</label>
    <input class="input" id="newGuest" name="name" placeholder="Add a name" autocomplete="off" maxlength="60" style="flex:1">
    <button type="submit" class="btn primary">${svgIcon('plus')} Add</button>
  </form>
  ${gs.length ? `<div class="row wrap" style="margin-bottom:14px">
    <span class="chip">${pl(gs.length, 'traveler')}</span>
    <span class="chip mint">${confirmed} confirmed</span>
    ${gs.length - confirmed ? `<span class="chip amber">${gs.length - confirmed} still deciding</span>` : ''}
    ${diets ? `<span class="chip ochre">${pl(diets, 'dietary note')}</span>` : ''}
  </div>
  <div class="grid cols-2">${gs.map((g) => {
    const arr = parseISO(g.arrive), dep = parseISO(g.depart);
    return `<div class="card lift" data-key="g-${g.id}">
      <div class="row" style="align-items:flex-start">
        ${avatar(g, 'lg')}
        <div style="flex:1;min-width:0">
          <label class="sr-only" for="gn-${g.id}">Name</label>
          <input id="gn-${g.id}" class="input bare" style="font:600 20px/1.2 var(--f-display);min-height:36px;padding-top:2px;padding-bottom:2px" data-bind="guests:${g.id}:name" value="${esc(g.name)}" maxlength="60">
          <label class="switch" style="margin-top:2px"><input type="checkbox" data-bind="guests:${g.id}:confirmed" ${g.confirmed ? 'checked' : ''}><span class="track"></span>${g.confirmed ? 'Confirmed' : 'Still deciding'}</label>
        </div>
        <button type="button" class="icon-btn danger" data-action="removeGuest" data-id="${g.id}" aria-label="Remove ${esc(g.name)}">${svgIcon('trash')}</button>
      </div>
      <div class="stack" style="gap:10px;margin-top:12px">
        <label class="field"><span>Dietary needs / allergies</span>
          <input class="input" data-bind="guests:${g.id}:diet" value="${esc(g.diet)}" placeholder="e.g. vegetarian, coeliac, nut allergy" maxlength="120"></label>
        <div class="form-grid">
          <label class="field"><span>Arrives</span><input type="date" class="input" data-bind="guests:${g.id}:arrive" value="${esc(g.arrive)}" min="${esc(tr.start)}" max="${esc(tr.end)}"></label>
          <label class="field"><span>Departs</span><input type="date" class="input" data-bind="guests:${g.id}:depart" value="${esc(g.depart)}" min="${esc(tr.start)}" max="${esc(tr.end)}"></label>
          <small class="full faint" style="margin-top:-4px">${arr || dep ? `${arr ? `Joins ${esc(fmtDay(arr))}` : ''}${arr && dep ? ' · ' : ''}${dep ? `Leaves ${esc(fmtDay(dep))}` : ''}` : 'Leave blank if they’re on the group dates.'}</small>
        </div>
      </div>
    </div>`;
  }).join('')}</div>` : emptyState('💌', 'start here', `Who’s coming to ${CITY.name}?`, 'Add your first traveler above. Their name will show up everywhere in the planner.')}`;
}

/* ==========================================================================
   GROUP PICKS
   ========================================================================== */
function viewVote() {
  const gs = state.guests;
  if (!gs.length) return viewHead('vote', `Group Picks`, '') + noGuests('everyone can vote on what the group actually wants to do');
  const voter = guest(ui.voteAs);
  const ranked = rankedActivities();
  const top = ranked.length ? ranked[0].n : 0;
  return viewHead('vote', `Group Picks`, S.voteLede || 'Vote on what you want to do. The most popular ideas move to the top.',
    `<button type="button" class="btn" data-action="addActivity">${svgIcon('plus')} Suggest an idea</button>`) + `
  <div class="card" style="margin-bottom:16px">
    <div class="kicker" style="margin-bottom:10px">Who’s voting?</div>
    <div class="gchips">
      <button type="button" class="gchip" style="--c:var(--espresso)" aria-pressed="${!voter}" data-action="voteAs" data-g=""><span class="avatar">★</span>Whole group</button>
      ${gs.map((g) => gchip(g, voter && voter.id === g.id, `data-action="voteAs" data-g="${g.id}"`)).join('')}
    </div>
    <p class="faint" style="font-size:12.5px;margin-top:10px">${voter ? `Voting as <b>${esc(firstName(voter.name))}</b> — tap “I’m in” on the ones you want.` : 'Pick your name for one-tap voting, or tap anyone’s chip below.'}</p>
  </div>
  <div class="vote-list">${ranked.map((r, pos) => {
    const a = r.a;
    const votes = validVotes(a);
    const tied = r.n > 0 && r.n === top && ranked.filter((o) => o.n === top).length > 1;
    const sched = isScheduled(a.id);
    const mine = voter && a.votes.includes(voter.id);
    return `<div class="card vote-item ${r.n && r.n === top ? 'leader' : ''}" data-key="act-${a.id}" data-flip>
      <div class="vote-rank num">${pos + 1}</div>
      <div class="vote-body">
        <div class="vote-top">
          <div>
            <h3>${esc(a.emoji || '')} ${esc(a.title)}</h3>
            ${a.note ? `<p class="note">${esc(a.note)}</p>` : ''}
          </div>
          <button type="button" class="icon-btn danger" data-action="removeActivity" data-id="${a.id}" aria-label="Remove ${esc(a.title)}">${svgIcon('trash')}</button>
        </div>
        <div class="vote-meter">${bar(pct(r.n, gs.length), 'ochre')}<span class="lbl num">${r.n} of ${gs.length} want this</span></div>
        <div class="row wrap" style="gap:6px;margin-bottom:10px">
          ${r.n && r.n === top ? '<span class="crown">★ Top pick</span>' : ''}
          ${tied ? '<span class="chip amber">Tied for top</span>' : ''}
          ${sched ? '<span class="chip mint">✓ On the itinerary</span>' : ''}
          ${a.custom ? '<span class="chip outline">Suggested</span>' : ''}
          ${(a.tags || []).map((t) => `<span class="chip vibe">${esc(t)}</span>`).join('')}
          ${a.book && CITY.bookLabels && CITY.bookLabels[a.book] ? `<span class="chip ${a.book === 'no' ? 'outline' : 'ochre'}">${a.book === 'no' ? '' : '🎟 '}${esc(CITY.bookLabels[a.book])}</span>` : ''}
        </div>
        ${voter
          ? `<div class="row wrap"><button type="button" class="btn ${mine ? 'sage' : ''} small" aria-pressed="${!!mine}" data-action="vote" data-id="${a.id}" data-g="${voter.id}">${mine ? '✓ I’m in' : 'I’m in'}</button><span class="avatars">${votes.map((id) => avatar(guest(id), 'sm')).join('')}</span></div>`
          : `<div class="gchips">${gs.map((g) => gchip(g, votes.includes(g.id), `data-action="vote" data-id="${a.id}" data-g="${g.id}"`)).join('')}</div>`}
      </div>
    </div>`;
  }).join('') || emptyState('💘', 'no ideas yet', 'Nothing to vote on', `Suggest the first thing you want to do in ${CITY.name}.`, '<button type="button" class="btn primary" data-action="addActivity">Suggest an idea</button>')}</div>`;
}

/* ==========================================================================
   ITINERARY
   ========================================================================== */
function slotHTML(it) {
  const b = state.bookings.find((x) => x.id === it.bookingId);
  const a = state.activities.find((x) => x.id === it.activityId);
  const u = b ? urgency(b) : null;
  const cost = it.cost || (b && b.cost) || 0;
  const cl = itemClosure(it);
  return `<button type="button" class="slot" data-key="it-${it.id}" data-action="editItem" data-id="${it.id}">
    <span class="time ${it.time ? '' : 'none'}">${it.time ? fmtTime(it.time) : 'Anytime'}</span>
    <span style="min-width:0">
      <span class="ti">${esc(it.title)}</span>
      ${it.note ? `<span class="no" style="display:block">${esc(it.note)}</span>` : ''}
      ${b || a || cl ? `<span class="meta">
        ${cl ? `<span class="chip red">⚠ ${esc(cl.venue)} is closed ${esc(cl.label)}</span>` : ''}
        ${b ? `<span class="chip ${u.level === 'done' ? 'green' : u.level}"><span class="dot ${u.level}"></span>${u.level === 'done' ? 'Booked' : `Book by ${esc(fmtDate(parseISO(b.bookBy)))}`}</span>` : ''}
        ${a ? `<span class="chip">💘 ${validVotes(a).length} of ${state.guests.length}</span>` : ''}
      </span>` : ''}
    </span>
    <span class="cost">${cost ? money(cost) : ''}</span>
  </button>`;
}

function viewItinerary() {
  const days = tripDays();
  const actions = `<button type="button" class="btn primary" data-action="winners">Add from Group Picks</button><button type="button" class="btn" data-action="addItem" data-day="0">${svgIcon('plus')} Add plan</button>`;
  if (!days.length) return viewHead('itinerary', `Itinerary`, '') + emptyState('🗓️', 'first, the dates', 'No dates yet', 'Set your trip dates on the Home page and your day-by-day agenda appears here.', '<button type="button" class="btn primary" data-action="go" data-tab="home">Set trip dates</button>');
  const p = tripPhase();
  const out = state.itinerary.filter((i) => i.day >= days.length || i.day < 0);
  const clash = closedPlans();
  return viewHead('itinerary', `Itinerary`, 'Tap any plan to edit it. Linked bookings show their book-by date.', actions) + `
  ${clash.length ? `<div class="card closed-warn" data-key="closed-warn"><b>⚠ ${pl(clash.length, 'plan is', 'plans are')} on a closed day</b>
    <ul>${clash.map((i) => `<li><button type="button" class="linkish" data-action="editItem" data-id="${i.id}">${esc(i.title)}</button> (Day ${+i.day + 1}, ${esc(fmtDay(dayDate(+i.day)))}): ${esc(closedMsg(itemClosure(i)))}</li>`).join('')}</ul>
    <p class="faint">Tap a plan to move it to another day.</p></div>` : ''}
  <div class="daypills" role="navigation" aria-label="Jump to day">${days.map((d) => `<button type="button" class="daypill ${p.phase === 'during' && p.index === d.i ? 'today' : ''}" data-action="jumpDay" data-day="${d.i}">Day ${d.i + 1}<b>${d.date.getDate()}</b>${esc(d.date.toLocaleDateString(undefined, { weekday: 'short' }))}</button>`).join('')}</div>
  <div class="stack" style="gap:22px">
  ${days.map((d) => {
    const its = itemsForDay(d.i);
    const arrivals = state.guests.filter((g) => g.arrive && g.arrive === isoOf(d.date) && d.i > 0);
    const departs = state.guests.filter((g) => g.depart && g.depart === isoOf(d.date) && d.i < days.length - 1);
    const notes = [...arrivals.map((g) => `${esc(firstName(g.name))} joins today!`), ...departs.map((g) => `${esc(firstName(g.name))} heads home today`)];
    const isToday = p.phase === 'during' && p.index === d.i;
    return `<section class="card day-card washi ${d.i % 2 ? 'ochre-tape right' : ''} ${isToday ? 'is-today' : ''}" id="day-${d.i}" data-key="day-${d.i}">
      <div class="day-head">
        <span class="dnum">Day ${d.i + 1}${isToday ? ' · Today' : ''}</span>
        <h3>${esc(fmtLong(d.date))}</h3>
        ${notes.length ? `<span class="hand">${notes.join(' · ')}</span>` : ''}
      </div>
      ${its.length ? its.map(slotHTML).join('') : `<div class="day-empty"><span class="hand">open day</span> Nothing planned yet.</div>`}
      <button type="button" class="btn small ghost" style="margin-top:6px" data-action="addItem" data-day="${d.i}">${svgIcon('plus')} Add to Day ${d.i + 1}</button>
    </section>`;
  }).join('')}
  ${out.length ? `<section class="card day-card" data-key="day-out"><div class="day-head"><span class="dnum">Outside your trip dates</span><h3>Needs a new day</h3></div><p class="muted" style="margin-bottom:6px;font-size:13.5px">These plans were on days that no longer exist after the dates changed. Tap one to move it.</p>${out.map(slotHTML).join('')}</section>` : ''}
  </div>`;
}

/* ==========================================================================
   BUDGET & SPLIT
   ========================================================================== */
function donut(segs, total) {
  const R = 15.9155;
  let acc = 0;
  const gap = segs.length > 1 ? 0.8 : 0;
  const circles = segs.map((s) => {
    const p = (s.v / total) * 100;
    const c = `<circle class="seg" cx="21" cy="21" r="${R}" fill="none" stroke="${s.color}" stroke-width="5.2" stroke-dasharray="${Math.max(0, p - gap).toFixed(3)} ${(100 - Math.max(0, p - gap)).toFixed(3)}" stroke-dashoffset="${(25 - acc).toFixed(3)}"><title>${esc(s.label)}: ${money(s.v)}</title></circle>`;
    acc += p;
    return c;
  }).join('');
  return `<svg class="donut" viewBox="0 0 42 42" role="img" aria-label="Spending by category">
    <circle cx="21" cy="21" r="${R}" fill="none" stroke="var(--cream-2)" stroke-width="5.2"/>
    ${circles}
    <text x="21" y="20.2" text-anchor="middle" style="font:600 5.2px var(--f-display);fill:var(--espresso)">${money(total)}</text>
    <text x="21" y="25.5" text-anchor="middle" style="font:700 2.3px var(--f-body);letter-spacing:.2px;fill:var(--ink-3);text-transform:uppercase">SPENT SO FAR</text>
  </svg>`;
}

function viewBudget() {
  const tr = state.trip;
  const gs = state.guests;
  const seg = `<div class="seg" role="group" aria-label="Budget view" style="margin-bottom:16px">
    <button type="button" aria-pressed="${ui.budgetView === 'overview'}" data-action="budgetView" data-v="overview">Overview</button>
    <button type="button" aria-pressed="${ui.budgetView === 'split'}" data-action="budgetView" data-v="split">Split &amp; settle up</button>
  </div>`;
  const head = viewHead('budget', `Budget &amp; Split`, 'Track spending, see everyone’s share, and see exactly who owes who.',
    `<button type="button" class="btn primary" data-action="addExpense" ${gs.length ? '' : 'disabled'}>${svgIcon('plus')} Log an expense</button>`);
  if (!gs.length) return head + noGuests('you can log shared costs and split them fairly');
  return head + seg + (ui.budgetView === 'split' ? budgetSplit() : budgetOverview());
}

function budgetOverview() {
  const tr = state.trip;
  const gs = state.guests;
  const spent = spentTotal();
  const remaining = tr.budget - spent;
  const byCat = CATS.map((c) => ({ ...c, v: state.expenses.filter((e) => e.category === c.id).reduce((s, e) => s + e.amount, 0) })).filter((c) => c.v > 0);
  const bal = balances();
  const shareOf = {}, paidOf = {};
  gs.forEach((g) => { shareOf[g.id] = 0; paidOf[g.id] = 0; });
  state.expenses.filter((e) => e.category !== 'settlement').forEach((e) => {
    paidOf[e.paidBy] = (paidOf[e.paidBy] || 0) + e.amount;
    for (const [g, c] of Object.entries(shares(e))) shareOf[g] = (shareOf[g] || 0) + c;
  });
  const perHead = gs.length ? Math.round(tr.budget / gs.length) : 0;
  const evenSpent = gs.length ? Math.round(spent / gs.length) : 0;
  return `
  <div class="budget-hero">
    <div class="card washi">
      <div class="row between wrap">
        <span class="kicker">Total trip budget</span>
        <label class="row" style="gap:6px;font-size:12.5px;color:var(--ink-3);font-weight:600">Currency
          <select class="select inline" data-bind="trip::currency">${['€', '$', '£', 'CA$', 'A$', '¥', 'CHF '].map((c) => `<option value="${c}" ${tr.currency === c ? 'selected' : ''}>${c.trim()}</option>`).join('')}</select></label>
      </div>
      <div class="money-input" style="margin:10px 0 12px;max-width:280px">
        <span class="cur" style="font-size:20px">${esc(cur())}</span>
        <label class="sr-only" for="budgetTotal">Total budget</label>
        <input id="budgetTotal" class="input" inputmode="decimal" style="font:600 28px/1 var(--f-display);min-height:56px;padding-left:${14 + cur().length * 13}px" data-bind="trip::budget" data-type="money" value="${esc(moneyStr(tr.budget))}" placeholder="0">
      </div>
      ${bar(pct(spent, tr.budget), `fat ochre ${spent > tr.budget && tr.budget ? 'over' : ''}`)}
      <div class="money-trio">
        <div><span>Spent</span><b>${money(spent)}</b></div>
        <div><span>${remaining >= 0 ? 'Remaining' : 'Over by'}</span><b class="${remaining < 0 ? 'neg' : ''}">${money(Math.abs(remaining))}</b></div>
        <div><span>Per person</span><b>${money(perHead)}</b></div>
      </div>
    </div>
    <div class="card">
      <div class="card-head"><h3>Where it’s going</h3></div>
      ${byCat.length ? `<div class="donut-wrap">${donut(byCat, spent)}
        <ul class="legend">${byCat.map((c) => `<li><span class="sw" style="background:${c.color}"></span>${c.emoji} ${c.label}<span class="amt">${money(c.v)}</span></li>`).join('')}</ul></div>`
        : emptyState('💶', 'nothing yet', 'No spending logged', 'Log the first expense and this chart fills in by category.')}
    </div>
  </div>

  ${CITY.budget ? `<div class="grid cols-2 section">${taxCard()}${priceCard()}</div>` : ''}

  <div class="card section">
    <div class="card-head"><h3>Everyone’s fair share</h3></div>
    <p class="muted" style="font-size:13.5px;margin-bottom:10px">Split evenly, each of the ${pl(gs.length, 'traveler')} owes about <b>${money(evenSpent)}</b> of what’s been spent so far${tr.budget ? `, and <b>${money(perHead)}</b> of the full budget` : ''}. The table uses each expense’s actual split, so uneven splits are handled.</p>
    <div class="table-wrap"><table class="ledger">
      <thead><tr><th>Traveler</th><th class="r">Their share</th><th class="r">Paid</th><th class="r">Balance</th></tr></thead>
      <tbody>${gs.map((g) => { const b = bal[g.id] || 0; return `<tr data-key="pp-${g.id}"><td><span class="person-cell">${avatar(g, 'sm')}${esc(g.name)}</span></td><td class="r">${money(shareOf[g.id])}</td><td class="r">${money(paidOf[g.id])}</td><td class="r ${b > 0 ? 'pos' : b < 0 ? 'neg' : ''}">${b > 0 ? `gets ${money(b)}` : b < 0 ? `owes ${money(-b)}` : 'square'}</td></tr>`; }).join('')}</tbody>
    </table></div>
    <button type="button" class="btn small" style="margin-top:12px" data-action="budgetView" data-v="split">See who pays who →</button>
  </div>`;
}

/** Tourist tax: a flat rate per adult per night, or a % of the nightly rate (capped) for rentals. All in cents. */
function touristTax() {
  const tt = CITY.budget.touristTax;
  const x = state.tax;
  const stay = tt.rates.find((r) => r.id === x.stay) || tt.rates[0];
  const adultsAuto = state.guests.filter((g) => g.confirmed).length;
  const nightsAuto = Math.max(0, tripDays().length - 1);
  const adults = x.adults === '' || x.adults == null ? adultsAuto : clamp(parseInt(x.adults, 10) || 0, 0, 99);
  const nights = x.nights === '' || x.nights == null ? nightsAuto : clamp(parseInt(x.nights, 10) || 0, 0, 365);
  const per = stay.pct != null ? Math.min(Math.round(((+x.nightly || 0) * stay.pct * stay.multiplier) / 100), stay.cap) : stay.amount;
  return { stay, adults, nights, adultsAuto, nightsAuto, per, total: per * adults * nights };
}
function taxCard() {
  const tt = CITY.budget.touristTax;
  if (!tt || !state.tax) return '';
  const t = touristTax();
  const x = state.tax;
  const rental = t.stay.pct != null;
  return `<div class="card washi tax-card" data-key="tax-card">
    <div class="card-head">${art('key', '🔑')}<h3>${esc(tt.title)}</h3></div>
    <p class="muted" style="font-size:13.5px;margin:-4px 0 12px">${esc(tt.intro)}</p>
    <div class="form-grid">
      <label class="field full"><span>Where are you staying?</span><select class="select" data-bind="tax::stay">${tt.rates.map((r) => `<option value="${r.id}" ${t.stay.id === r.id ? 'selected' : ''}>${esc(r.label)}${r.amount != null ? ` · ${money(r.amount)}` : ''}</option>`).join('')}</select></label>
      ${rental ? `<label class="field full"><span>Nightly price per person</span><span class="money-input"><span class="cur">${esc(cur())}</span><input class="input" inputmode="decimal" data-bind="tax::nightly" data-type="money" value="${esc(moneyStr(x.nightly))}" placeholder="0"></span><small>The nightly price before taxes, divided by the number of guests.</small></label>` : ''}
      <label class="field"><span>Adults (18+)</span><input class="input" type="number" inputmode="numeric" min="0" max="99" data-bind="tax::adults" value="${esc(x.adults)}" placeholder="${t.adultsAuto}"></label>
      <label class="field"><span>Nights</span><input class="input" type="number" inputmode="numeric" min="0" max="365" data-bind="tax::nights" value="${esc(x.nights)}" placeholder="${t.nightsAuto}"></label>
    </div>
    <div class="tax-sum"><span>${money(t.per)} × ${pl(t.adults, 'adult')} × ${pl(t.nights, 'night')}</span><b class="num">${money(t.total)}</b></div>
    ${rental ? `<p class="faint" style="font-size:12.5px;margin-bottom:10px">${esc(tt.rentalNote)}</p>` : ''}
    <button type="button" class="btn small" data-action="logTax" ${t.total && state.guests.length ? '' : 'disabled'}>${svgIcon('plus')} Log it as an expense</button>
  </div>`;
}
function priceCard() {
  const pg = CITY.budget.priceGuide;
  if (!pg || !state.prices) return '';
  const n = state.guests.length;
  return `<div class="card price-card" data-key="price-card">
    <div class="card-head">${art('croissant', '🥐')}<h3>${esc(pg.title)}</h3></div>
    <p class="muted" style="font-size:13.5px;margin:-4px 0 8px">${esc(pg.intro)}</p>
    <div class="price-list">${state.prices.map((x) => `<div class="price-row" data-key="pr-${x.id}">
      <span class="pl"><b>${esc(x.label)}</b>${x.note ? `<small>${esc(x.note)}</small>` : ''}</span>
      <span class="money-input"><span class="cur">${esc(cur())}</span><input class="input" inputmode="decimal" data-bind="prices:${x.id}:amount" data-type="money" value="${esc(moneyStr(x.amount))}" aria-label="${esc(x.label)} price"></span>
      <span class="pg num">${n > 1 ? `${money(x.amount * n)}<small>for ${n}</small>` : ''}</span>
    </div>`).join('')}</div>
    <p class="price-note"><span class="hand">${esc(pg.warning)}</span></p>
  </div>`;
}

function budgetSplit() {
  const settle = settleUp();
  const exps = [...state.expenses].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const catOf = (id) => CATS.find((c) => c.id === id) || (id === 'settlement' ? SETTLE_CAT : CATS[4]);
  const splitLabel = (e) => {
    if (e.category === 'settlement') return `${esc(firstName((guest(e.paidBy) || {}).name))} → ${esc(firstName((guest(e.participants[0]) || {}).name))}`;
    const n = e.participants.length;
    const who = n === state.guests.length ? 'everyone' : e.participants.map((id) => esc(firstName((guest(id) || {}).name))).join(', ');
    return `${esc(firstName((guest(e.paidBy) || { name: '?' }).name))} paid · ${e.mode === 'even' ? `split evenly with ${who}` : e.mode === 'percent' ? `split by % with ${who}` : `custom amounts with ${who}`}`;
  };
  return `<div class="grid cols-2">
    <div class="card washi ochre-tape" style="align-self:start">
      <div class="card-head"><h3>Settle up</h3><span class="chip">${pl(settle.length, 'payment')}</span></div>
      ${settle.length ? `<p class="muted" style="font-size:13px;margin-bottom:4px">The fewest simple payments that square everyone up. Tap “Paid” once the money’s moved.</p>
        ${settle.map((s) => `<div class="settle" data-key="st-${s.from}-${s.to}">
          ${avatar(guest(s.from), 'sm')}<span style="font-weight:600">${esc(firstName(guest(s.from).name))}</span><span class="arrow">→</span>${avatar(guest(s.to), 'sm')}<span style="font-weight:600">${esc(firstName(guest(s.to).name))}</span>
          <span class="amt num">${money(s.amount)}</span>
          <button type="button" class="btn small" data-action="markPaid" data-from="${s.from}" data-to="${s.to}" data-amount="${s.amount}">Paid</button>
        </div>`).join('')}`
        : `<div style="text-align:center;padding:18px 0"><div style="font-size:30px;color:var(--sage-deep)">✓</div><h3 style="margin:6px 0 4px">Everyone’s square</h3><p class="muted" style="font-size:13.5px">No one owes anyone.</p></div>`}
    </div>
    <div class="card">
      <div class="card-head"><h3>Expenses</h3><button type="button" class="btn small" data-action="addExpense">${svgIcon('plus')} Log one</button></div>
      ${exps.length ? exps.map((e) => { const c = catOf(e.category); return `<button type="button" class="expense" data-key="ex-${e.id}" data-action="editExpense" data-id="${e.id}">
        <span class="cat-ico" style="background:${c.color}22">${c.emoji}</span>
        <span style="min-width:0"><span class="ti" style="display:block">${esc(e.desc || c.label)}</span><span class="sub">${splitLabel(e)}</span></span>
        <span class="amt">${money(e.amount)}<small>${esc(fmtDate(parseISO(e.date)))}</small></span>
      </button>`; }).join('') : emptyState('🧾', 'nothing yet', 'No expenses yet', 'Log shared costs like the apartment or train tickets, and Settle Up works out who owes who.')}
    </div>
  </div>`;
}

/* ==========================================================================
   BOOKINGS
   ========================================================================== */
function viewBookings() {
  const all = sortedBookings();
  const counts = { red: 0, amber: 0, green: 0, done: 0 };
  all.forEach((b) => { counts[urgency(b).level]++; });
  const list = all.filter((b) => (ui.bookFilter === 'todo' ? !b.booked : ui.bookFilter === 'done' ? b.booked : true));
  const diets = dietNotes();
  return viewHead('bookings', `Bookings`, 'Popular spots sell out. Red means due within 3 days or overdue, amber means within two weeks, and green means there’s time.',
    `<button type="button" class="btn primary" data-action="addBooking">${svgIcon('plus')} Add a booking</button>`) + `
  <div class="urgency-summary">
    <span class="chip red"><span class="dot red"></span>${counts.red} urgent</span>
    <span class="chip amber"><span class="dot amber"></span>${counts.amber} coming up</span>
    <span class="chip green"><span class="dot green"></span>${counts.green} plenty of time</span>
    <span class="chip"><span class="dot done"></span>${counts.done} booked</span>
  </div>
  <div class="seg" role="group" aria-label="Filter bookings" style="margin-bottom:16px">
    ${[['all', 'All'], ['todo', 'To book'], ['done', 'Booked']].map(([v, l]) => `<button type="button" aria-pressed="${ui.bookFilter === v}" data-action="bookFilter" data-v="${v}">${l}</button>`).join('')}
  </div>
  ${list.length ? `<div class="grid cols-2">${list.map((b) => {
    const u = urgency(b);
    return `<article class="ticket ${u.level}" data-key="bk-${b.id}">
      <div class="tk-main">
        <div class="row" style="align-items:flex-start">
          <div style="flex:1;min-width:0">
            <span class="chip ${u.level === 'done' ? '' : u.level}" style="margin-bottom:8px"><span class="dot ${u.level}"></span>${u.word}</span>
            <h3>${esc(b.title)}</h3>
          </div>
          <button type="button" class="icon-btn" data-action="editBooking" data-id="${b.id}" aria-label="Edit ${esc(b.title)}">${svgIcon('edit')}</button>
        </div>
        ${b.cost || b.ref ? `<div class="row wrap" style="gap:6px;margin-top:8px">${b.cost ? `<span class="chip">${money(b.cost)}</span>` : ''}${b.ref ? `<span class="chip outline">Ref: ${esc(b.ref)}</span>` : ''}</div>` : ''}
        ${b.tip ? `<div class="tip"><b>good to know</b>${esc(b.tip)}</div>` : ''}
        ${b.food && diets.length ? `<div class="diet-note">🍽 Mention when booking: ${diets.map((g) => `${esc(firstName(g.name))} — ${esc(g.diet)}`).join(' · ')}</div>` : ''}
      </div>
      <div class="tk-stub">
        <div class="tk-when"><b>${b.bookBy ? `Book by ${esc(fmtDay(parseISO(b.bookBy)))}` : 'No deadline set'}</b><span class="${u.level}">${esc(u.label)}</span></div>
        <label class="row" style="gap:6px;margin-left:auto"><span class="sr-only">Who’s booking it</span>
          ${avatar(guest(b.assignee), 'sm')}
          <select class="select inline" data-bind="bookings:${b.id}:assignee"><option value="" ${!guest(b.assignee) ? 'selected' : ''}>Unassigned</option>${state.guests.map((g) => `<option value="${g.id}" ${b.assignee === g.id ? 'selected' : ''}>${esc(firstName(g.name))}</option>`).join('')}</select>
        </label>
        <label class="switch"><input type="checkbox" data-bind="bookings:${b.id}:booked" data-after="celebrateBooked" ${b.booked ? 'checked' : ''}><span class="track"></span>Booked</label>
      </div>
    </article>`;
  }).join('')}</div>` : emptyState('🎟️', ui.bookFilter === 'done' ? 'soon!' : 'all clear', ui.bookFilter === 'done' ? 'Nothing booked yet' : 'Nothing to book', ui.bookFilter === 'done' ? 'Flip the “Booked” switch on a reservation once it’s confirmed.' : 'Add the reservations that need locking in — tours, tables, trains.')}`;
}

/* ==========================================================================
   PACKING
   ========================================================================== */
function viewPacking() {
  const gs = state.guests;
  if (!gs.length) return viewHead('packing', `Packing`, '') + noGuests('everyone gets their own packing checklist');
  if (!guest(ui.packGuest)) ui.packGuest = gs[0].id;
  const me = guest(ui.packGuest);
  const all = packStats();
  const mine = packStats(me.id);
  return viewHead('packing', `Packing`, 'Everyone has their own checklist. Pick your name and check things off.') + `
  <div class="card mint" style="margin-bottom:14px">
    <div class="row between" style="margin-bottom:8px"><b style="font:600 19px var(--f-display)">The group is ${all.pct}% packed</b><span class="muted num" style="font-weight:600;font-size:13px">${all.done}/${all.total}</span></div>
    ${bar(all.pct, 'fat')}
  </div>
  <div class="pack-people" role="group" aria-label="Choose traveler">${gs.map((g) => { const s = packStats(g.id); return `<button type="button" class="pack-person" aria-pressed="${g.id === me.id}" data-action="packGuest" data-g="${g.id}" data-key="pp-${g.id}">
    ${avatar(g, 'sm')}<span class="nm">${esc(firstName(g.name))}</span>${bar(s.pct, 'thin')}<span class="pc">${s.pct === 100 && s.total ? 'All packed' : `${s.done}/${s.total} packed`}</span></button>`; }).join('')}</div>
  <div class="row between wrap" style="margin:6px 0 14px">
    <h2 class="section-title" style="margin:0">${esc(firstName(me.name))}’s list <span class="count">${mine.pct}%</span></h2>
    <div class="seg" role="group" aria-label="New items go to">
      <button type="button" aria-pressed="${ui.packScope === 'one'}" data-action="packScope" data-v="one">Add for ${esc(firstName(me.name))}</button>
      <button type="button" aria-pressed="${ui.packScope === 'all'}" data-action="packScope" data-v="all">Add for everyone</button>
    </div>
  </div>
  <div class="grid cols-2">${PACK_CATS.map((c) => {
    const items = state.packing.filter((p) => p.guestId === me.id && p.cat === c.id);
    const done = items.filter((p) => p.done).length;
    return `<section class="card pack-cat ${c.id === CITY.packCityCat ? `${c.id} washi` : ''}" data-key="pc-${c.id}">
      <div class="card-head"><span class="ico" aria-hidden="true">${c.emoji}</span><h3>${c.label}</h3><span class="chip ${done === items.length && items.length ? 'mint' : ''}">${done}/${items.length}</span></div>
      ${c.id === CITY.packCityCat && S.packNote ? `<p class="hand" style="color:var(--ochre);font-size:18px;margin:-6px 0 6px">${S.packNote}</p>` : ''}
      ${items.map((p) => `<div class="pack-item ${p.done ? 'is-done' : ''}" data-key="pk-${p.id}">
        ${check(`id="pk-${p.id}" data-bind="packing:${p.id}:done" data-after="celebratePacked"`, p.done)}
        <label class="txt" for="pk-${p.id}">${esc(p.text)}</label>
        <button type="button" class="icon-btn danger" data-action="removePack" data-id="${p.id}" aria-label="Remove ${esc(p.text)}">${svgIcon('x')}</button>
      </div>`).join('')}
      <form class="add-inline" data-form="addPack" data-cat="${c.id}">
        <label class="sr-only" for="add-${c.id}">Add to ${c.label}</label>
        <input class="input" id="add-${c.id}" name="text" placeholder="Add an item…" autocomplete="off" maxlength="100">
        <button type="submit" class="icon-btn" aria-label="Add item" style="border:1.5px solid var(--line-2)">${svgIcon('plus')}</button>
      </form>
    </section>`;
  }).join('')}</div>`;
}

/* ==========================================================================
   DREAM BOARD
   ========================================================================== */
function viewDream() {
  return viewHead('dream', `Dream Board`, 'Save places and ideas the group hasn’t decided on yet. Move the keepers to the itinerary or put them to a vote.',
    `<button type="button" class="btn primary" data-action="addDream">${svgIcon('plus')} Pin an idea</button>`) +
  (state.dream.length ? `<div class="board" style="position:relative">${doodle(2, 'right:0;top:-40px;width:80px')}${state.dream.map((d) => {
    const k = DREAM_KINDS.find((x) => x.id === d.kind) || DREAM_KINDS[0];
    return `<article class="polaroid" style="--rot:${d.rot || 0}deg" data-key="dr-${d.id}">
      <div class="pic" style="background:${k.bg}"><span aria-hidden="true">${k.emoji}</span>
        ${d.promoted ? `<span class="stamped">${d.promoted === 'plan' ? 'On the plan' : 'Up for a vote'}</span>` : ''}</div>
      <h3>${esc(d.title)}</h3>
      <div class="kind-tag">${k.label}</div>
      ${d.note ? `<p style="margin-top:4px">${esc(d.note)}</p>` : ''}
      ${safeUrl(d.link) ? `<a class="link" href="${esc(safeUrl(d.link))}" target="_blank" rel="noopener noreferrer">${svgIcon('link')} ${esc(linkLabel(d.link))}</a>` : ''}
      <div class="acts">
        <button type="button" class="btn small" data-action="dreamToPlan" data-id="${d.id}">→ Itinerary</button>
        <button type="button" class="btn small ghost" data-action="dreamToVote" data-id="${d.id}">→ Vote</button>
        <button type="button" class="icon-btn" style="width:34px;height:34px;margin-left:auto" data-action="editDream" data-id="${d.id}" aria-label="Edit ${esc(d.title)}">${svgIcon('edit')}</button>
      </div>
    </article>`;
  }).join('')}</div>` : emptyState('✨', 'start saving', 'Your board is empty', 'Save ideas from TikTok, Instagram or Google Maps so they don’t get lost in the group chat.', '<button type="button" class="btn primary" data-action="addDream">Pin the first idea</button>'));
}

/* ==========================================================================
   MEMORIES
   ========================================================================== */
function entryHTML(e, whenLabel) {
  return `<article class="card entry washi mint-tape" data-key="je-${e.id}">
    <div style="min-width:0">
      <div class="row" style="align-items:flex-start">
        <div style="flex:1;min-width:0">
          <div class="when">${whenLabel}</div>
          <label class="sr-only" for="jt-${e.id}">Title</label>
          <input id="jt-${e.id}" class="input bare" style="font:600 23px/1.2 var(--f-display);min-height:40px" data-bind="journal:${e.id}:title" value="${esc(e.title)}" placeholder="Give this day a title" maxlength="90">
        </div>
        <button type="button" class="icon-btn danger" data-action="removeEntry" data-id="${e.id}" aria-label="Delete page">${svgIcon('trash')}</button>
      </div>
      <label class="sr-only" for="jx-${e.id}">What happened</label>
      <textarea id="jx-${e.id}" class="textarea lined" rows="5" data-bind="journal:${e.id}:text" placeholder="What happened today?">${esc(e.text)}</textarea>
      <div class="fav"><span class="lbl">♥ best part of the day</span>
        <label class="sr-only" for="jf-${e.id}">Best part of the day</label>
        <input id="jf-${e.id}" class="input" data-bind="journal:${e.id}:favorite" value="${esc(e.favorite)}" placeholder="The moment you want to remember" maxlength="200"></div>
      <div class="fav"><span class="lbl">“ quote of the day</span>
        <label class="sr-only" for="jq-${e.id}">Quote of the day</label>
        <input id="jq-${e.id}" class="input" data-bind="journal:${e.id}:quote" value="${esc(e.quote || '')}" placeholder="Something someone said" maxlength="200"></div>
    </div>
  </article>`;
}
function viewMemories() {
  const days = tripDays();
  const p = tripPhase();
  const loose = state.journal.filter((e) => e.day == null || e.day >= days.length || e.day < 0);
  return viewHead('memories', `Trip Journal`, 'Write a few lines each day so you remember the details. Everyone in the group can add to it.',
    `<button type="button" class="btn" data-action="addPage">${svgIcon('plus')} Add a loose page</button>`) + `
  <div class="journal">
    ${days.map((d) => {
      const e = state.journal.find((x) => x.day === d.i);
      const label = `Day ${d.i + 1} · ${esc(fmtDay(d.date))}`;
      if (e) return entryHTML(e, label);
      const future = p.phase === 'before' || (p.phase === 'during' && d.i > p.index);
      return `<button type="button" class="card lift" style="text-align:left;display:flex;align-items:center;gap:14px;font:inherit;color:inherit;${future ? 'opacity:.72' : ''}" data-key="jd-${d.i}" data-action="writeDay" data-day="${d.i}">
        <span class="vote-rank num" style="background:var(--mint);color:var(--sage-deep)">${d.i + 1}</span>
        <span style="flex:1"><b style="font:600 18px var(--f-display);display:block">${label}</b><span class="muted" style="font-size:13.5px">${future ? 'Coming up' : 'Nothing written yet. Tap to start this page.'}</span></span>
        <span class="chev" style="color:var(--ochre)">✎</span>
      </button>`;
    }).join('')}
    ${loose.length ? `<h2 class="section-title" style="margin-top:10px">Loose pages <span class="count">${loose.length}</span></h2>${loose.map((e) => entryHTML(e, e.day != null ? 'From an old trip day' : 'Loose page')).join('')}` : ''}
    ${!days.length && !loose.length ? emptyState('📓', 'blank pages', 'Your journal is empty', 'Set trip dates to get a page for each day, or add a loose page any time.') : ''}
  </div>`;
}

/* ==========================================================================
   POCKET GUIDE — phrases, customs, fun facts (from the city file)
   ========================================================================== */
const canSpeak = () => 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
function viewPocket() {
  const pk = CITY.pocket;
  const secs = [['phrases', pk.phrases], ['customs', pk.customs], ['facts', pk.facts]].filter(([, x]) => x && x.items.length);
  return viewHead('pocket', esc(pk.title), esc(pk.lede)) + `
  <div class="pocket-band" aria-hidden="true"></div>
  <nav class="pocket-jump" aria-label="Jump to section">${secs.map(([id, x]) => `<button type="button" class="daypill" data-action="jumpPocket" data-v="${id}">${art(x.icon, x.emoji)}${esc(x.short || x.title)}</button>`).join('')}</nav>
  ${pk.phrases && pk.phrases.items.length ? `<section class="section pocket-sec" id="pocket-phrases" data-key="pocket-phrases">
    <h2 class="section-title">${art(pk.phrases.icon, pk.phrases.emoji)}${esc(pk.phrases.title)}</h2>
    ${pk.phrases.intro ? `<p class="muted pocket-intro">${esc(pk.phrases.intro)}</p>` : ''}
    <div class="phrase-grid">${pk.phrases.items.map((x, i) => `<article class="phrase" data-key="ph-${i}">
      <div class="row between" style="align-items:flex-start"><h3 lang="${esc(pk.lang || '')}">${esc(x.say)}</h3>
        ${canSpeak() && pk.lang ? `<button type="button" class="icon-btn say-btn" data-action="sayPhrase" data-i="${i}" aria-label="Hear “${esc(x.say)}”">🔊</button>` : ''}</div>
      <div class="pron">${esc(x.sound)}</div>
      <p class="use">${esc(x.use)}</p>
    </article>`).join('')}</div>
  </section>` : ''}
  ${pk.customs && pk.customs.items.length ? `<section class="section pocket-sec" id="pocket-customs" data-key="pocket-customs">
    <h2 class="section-title">${art(pk.customs.icon, pk.customs.emoji)}${esc(pk.customs.title)}</h2>
    <ol class="custom-list">${pk.customs.items.map((x, i) => `<li class="card" data-key="cu-${i}"><span class="vote-rank num">${i + 1}</span><div><b>${esc(x.head)}</b>${x.text ? `<p>${esc(x.text)}</p>` : ''}</div></li>`).join('')}</ol>
  </section>` : ''}
  ${pk.facts && pk.facts.items.length ? `<section class="section pocket-sec" id="pocket-facts" data-key="pocket-facts">
    <h2 class="section-title">${art(pk.facts.icon, pk.facts.emoji)}${esc(pk.facts.title)}</h2>
    <div class="fact-grid">${pk.facts.items.map((x, i) => `<article class="card fact washi ${i % 2 ? 'right' : ''}" data-key="fa-${i}"><span class="hand">${esc(x.head)}</span><p>${esc(x.text)}</p></article>`).join('')}</div>
  </section>` : ''}`;
}

/* ==========================================================================
   Render
   ========================================================================== */
const VIEWS = { home: viewHome, guests: viewGuests, dashboard: viewDashboard, vote: viewVote, itinerary: viewItinerary, budget: viewBudget, bookings: viewBookings, packing: viewPacking, dream: viewDream, memories: viewMemories,
  ...(CITY.pocket ? { pocket: viewPocket } : {}) };

let rendering = false;
function render() {
  // A blur-triggered `change` can fire while morph removes a focused input; defer instead of nesting.
  if (rendering) { queueMicrotask(render); return; }
  rendering = true;
  try { renderNow(); } finally { rendering = false; }
}
function renderNow() {
  if (!state) return;
  renderShell();
  const view = $('#view');
  const key = `v-${ui.tab}`;
  const changed = !view.firstElementChild || view.firstElementChild.getAttribute('data-key') !== key;
  const rects = new Map();
  if (!changed) view.querySelectorAll('[data-flip]').forEach((el) => rects.set(el.dataset.key, el.getBoundingClientRect().top));
  patch(view, `<section class="view" data-key="${key}">${VIEWS[ui.tab]()}</section>`);
  if (changed) {
    const s = view.firstElementChild;
    s.classList.add('view-enter');
    window.scrollTo({ top: 0 });
  } else if (rects.size && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    view.querySelectorAll('[data-flip]').forEach((el) => {
      const before = rects.get(el.dataset.key);
      if (before == null) return;
      const dy = before - el.getBoundingClientRect().top;
      if (Math.abs(dy) > 1) el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 480, easing: 'cubic-bezier(.2,.8,.2,1)' });
    });
  }
  view.querySelectorAll('textarea.autosize').forEach(autosize);
  if (sheet) renderSheet();
}
function autosize(el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }

function go(tab) {
  if (!VIEWS[tab]) tab = 'home';
  ui.tab = tab;
  try { localStorage.setItem(TAB_KEY, tab); } catch (e) { /* ignore */ }
  if (location.hash !== '#' + tab) history.replaceState(null, '', '#' + tab);
  render();
}

/* ==========================================================================
   Sheets (bottom-sheet modals with a live draft)
   ========================================================================== */
let sheet = null;
let sheetReturnFocus = null;
function openSheet(cfg) {
  sheet = { submitLabel: 'Save', ...cfg, draft: cfg.draft || {} };
  sheetReturnFocus = document.activeElement;
  const el = $('#sheet');
  el.classList.remove('closing');
  el.hidden = false;
  document.body.style.overflow = 'hidden';
  $('#sheetPanel').innerHTML = '';
  renderSheet();
  $('#sheetPanel').scrollTop = 0;
  setTimeout(() => {
    const f = $('#sheetPanel [autofocus]') || $('#sheetPanel input:not([type=hidden]), #sheetPanel button');
    if (f && matchMedia('(min-width: 720px)').matches) f.focus(); else $('#sheetPanel').focus();
  }, 60);
}
function renderSheet() {
  if (!sheet) return;
  const s = sheet;
  $('#sheetPanel').setAttribute('tabindex', '-1');
  $('#sheetPanel').setAttribute('aria-label', s.title);
  patch($('#sheetPanel'), `
    <div class="sheet-head"><h2>${s.title}</h2><button type="button" class="icon-btn" data-action="closeSheet" aria-label="Close">${svgIcon('x')}</button></div>
    <form id="sheetForm" novalidate>
      ${s.body(s.draft)}
      ${s.onSubmit ? `<div class="sheet-foot">
        ${s.onDelete ? `<button type="button" class="btn ghost" style="color:var(--red)" data-action="sheetDelete">${svgIcon('trash')} Delete</button>` : ''}
        <button type="button" class="btn ghost" data-action="closeSheet">Cancel</button>
        <button type="submit" class="btn primary" ${s.valid && !s.valid(s.draft) ? 'disabled' : ''}>${s.submitLabel}</button>
      </div>` : ''}
    </form>`);
}
function closeSheet() {
  if (!sheet) return;
  sheet = null;
  const el = $('#sheet');
  el.classList.add('closing');
  setTimeout(() => { if (!sheet) { el.hidden = true; el.classList.remove('closing'); } }, 210);
  document.body.style.overflow = '';
  if (sheetReturnFocus && document.contains(sheetReturnFocus)) sheetReturnFocus.focus({ preventScroll: true });
}
function confirmSheet({ title, text, ok = 'Yes', danger = false, onOk }) {
  openSheet({ title, body: () => `<p class="muted">${text}</p>`, submitLabel: ok, onSubmit: () => { onOk(); } });
  if (danger) setTimeout(() => { const b = $('#sheetForm button[type=submit]'); if (b) b.style.background = 'var(--red)'; }, 0);
}
const dayOptions = (sel) => tripDays().map((d) => `<option value="${d.i}" ${+sel === d.i ? 'selected' : ''}>Day ${d.i + 1} · ${esc(fmtDay(d.date))}</option>`).join('');
const guestOptions = (sel, blank) => (blank ? `<option value="" ${!sel ? 'selected' : ''}>${blank}</option>` : '') + state.guests.map((g) => `<option value="${g.id}" ${sel === g.id ? 'selected' : ''}>${esc(g.name)}</option>`).join('');

/* ---- itinerary item ---- */
function itemSheet(it, day) {
  const isNew = !it;
  const days = tripDays();
  if (!days.length) { toast('Set your trip dates on the Home page first.'); return; }
  const d = it ? { ...it, cost: moneyStr(it.cost) } : { day: clamp(+day || 0, 0, days.length - 1), time: '', title: '', note: '', cost: '', bookingId: '', activityId: '' };
  openSheet({
    title: isNew ? `Add a plan` : 'Edit plan',
    draft: d,
    submitLabel: isNew ? 'Add to itinerary' : 'Save',
    valid: (x) => x.title.trim(),
    body: (x) => `<div class="form-grid">
      <label class="field full"><span>What’s the plan?</span><input class="input" data-d="title" value="${esc(x.title)}" placeholder="${esc(S.phPlan)}" maxlength="100" autofocus></label>
      ${(() => { const cl = itemClosure(x); return cl ? `<div class="full split-sum bad" aria-live="polite">⚠ ${esc(closedMsg(cl))} Try another day.</div>` : ''; })()}
      <label class="field"><span>Day</span><select class="select" data-d="day" data-type="int">${dayOptions(x.day)}${x.day >= days.length ? `<option value="${x.day}" selected>Outside trip dates</option>` : ''}</select></label>
      <label class="field"><span>Time <small class="faint">(optional)</small></span><input type="time" class="input" data-d="time" value="${esc(x.time)}"></label>
      <label class="field full"><span>Notes</span><textarea class="textarea" data-d="note" rows="3" placeholder="Meeting point, dress code, who has the tickets…">${esc(x.note)}</textarea></label>
      <label class="field"><span>Cost <small class="faint">(optional)</small></span><span class="money-input"><span class="cur">${esc(cur())}</span><input class="input" inputmode="decimal" data-d="cost" value="${esc(x.cost)}" placeholder="0"></span></label>
      <label class="field"><span>Linked booking</span><select class="select" data-d="bookingId"><option value="">None</option>${state.bookings.map((b) => `<option value="${b.id}" ${x.bookingId === b.id ? 'selected' : ''}>${esc(b.title)}</option>`).join('')}</select></label>
    </div>`,
    onSubmit: (x) => {
      const rec = { id: it ? it.id : uid(), day: +x.day, time: x.time, title: x.title.trim(), note: x.note.trim(), cost: parseMoney(x.cost), bookingId: x.bookingId, activityId: x.activityId || '' };
      if (it) Object.assign(it, rec); else state.itinerary.push(rec);
      commit();
      const cl = itemClosure(rec);
      toast(cl ? `Heads up: ${closedMsg(cl)}` : it ? 'Plan updated' : `Added to Day ${rec.day + 1}`);
    },
    onDelete: it ? () => undoable('Plan removed', () => { state.itinerary = state.itinerary.filter((x) => x.id !== it.id); }) : null,
  });
}

/* ---- group picks winners → itinerary ---- */
function winnersSheet() {
  const days = tripDays();
  if (!days.length) { toast('Set your trip dates on the Home page first.'); return; }
  openSheet({
    title: 'Add from Group Picks',
    draft: { picks: {} },
    body: (x) => {
      const list = rankedActivities().filter((r) => !isScheduled(r.a.id));
      if (!list.length) return emptyState('💘', 'all caught up', 'Every idea is on the itinerary', 'Suggest more on the Group Picks tab.');
      return `<p class="muted" style="margin-bottom:12px;font-size:13.5px">Top-voted ideas that aren’t scheduled yet. Pick a day and drop them in.</p>
      <div class="pick-list">${list.map((r) => {
        const pk = x.picks[r.a.id] || { day: 0, time: '' };
        return `<div class="pick" data-key="pick-${r.a.id}">
          <div class="row" style="align-items:flex-start;margin-bottom:8px"><b style="flex:1">${esc(r.a.emoji || '')} ${esc(r.a.title)}</b><span class="chip ochre num">${r.n}/${state.guests.length}</span></div>
          ${bar(pct(r.n, state.guests.length), 'thin ochre')}
          <div class="row" style="margin-top:10px">
            <select class="select" style="flex:1;min-width:0" data-d="picks.${r.a.id}.day" data-type="int" aria-label="Day">${dayOptions(pk.day)}</select>
            <input type="time" class="input" style="width:118px;flex:none" data-d="picks.${r.a.id}.time" value="${esc(pk.time)}" aria-label="Time">
            <button type="button" class="btn small primary" data-action="winnerAdd" data-id="${r.a.id}">Add</button>
          </div>
        </div>`;
      }).join('')}</div>`;
    },
  });
}

/* ---- activity (group picks idea) ---- */
function activitySheet() {
  openSheet({
    title: 'Suggest an idea',
    draft: { emoji: '📍', title: '', note: '' },
    submitLabel: 'Add to the vote',
    valid: (x) => x.title.trim(),
    body: (x) => `<div class="form-grid">
      <label class="field"><span>Emoji</span><input class="input" data-d="emoji" value="${esc(x.emoji)}" maxlength="4" style="font-size:22px;text-align:center"></label>
      <div></div>
      <label class="field full"><span>Idea</span><input class="input" data-d="title" value="${esc(x.title)}" placeholder="${esc(S.phIdea)}" maxlength="90" autofocus></label>
      <label class="field full"><span>Why we should</span><input class="input" data-d="note" value="${esc(x.note)}" placeholder="One line to convince the group" maxlength="140"></label>
    </div>`,
    onSubmit: (x) => { state.activities.push({ id: uid(), emoji: x.emoji.trim(), title: x.title.trim(), note: x.note.trim(), votes: [], custom: true }); commit(); toast('Idea added'); },
  });
}

/* ---- expense ---- */
const TIP = (CITY.budget || {}).tipping;
/** Bill plus tip, in cents (cities without tipping just use the bill). */
const billTotal = (x) => { const bill = parseMoney(x.amount); return TIP ? bill + Math.round((bill * (parseFloat(x.tip) || 0)) / 100) : bill; };
function expenseSheet(e, pre = {}) {
  const gs = state.guests;
  const d = e ? {
    ...(TIP ? { tip: String(e.tip ?? 0) } : {}),
    desc: e.desc, amount: moneyStr(TIP && e.bill != null ? e.bill : e.amount), category: e.category === 'settlement' ? 'settlement' : e.category, date: e.date, paidBy: e.paidBy, mode: e.mode,
    participants: [...e.participants], custom: Object.fromEntries(Object.entries(e.custom || {}).map(([k, v]) => [k, e.mode === 'amount' ? moneyStr(v) : String(v)])),
  } : { ...(TIP ? { tip: String(TIP.default) } : {}), desc: '', amount: '', category: 'food', date: isoOf(today()), paidBy: gs[0].id, mode: 'even', participants: gs.map((g) => g.id), custom: {}, ...pre };
  const check = (x) => {
    const amt = billTotal(x);
    const ps = x.participants.filter((id) => guest(id));
    if (!amt) return { ok: false, msg: 'Enter an amount' };
    if (!guest(x.paidBy)) return { ok: false, msg: 'Pick who paid' };
    if (!ps.length) return { ok: false, msg: 'Pick at least one person to split with' };
    if (x.mode === 'amount') {
      const sum = ps.reduce((s, id) => s + parseMoney(x.custom[id]), 0);
      return sum === amt ? { ok: true, msg: `Adds up to ${money(amt)} ✓` } : { ok: false, msg: `${money(sum)} of ${money(amt)} assigned — ${sum < amt ? `${money(amt - sum)} left` : `${money(sum - amt)} too much`}` };
    }
    if (x.mode === 'percent') {
      const sum = ps.reduce((s, id) => s + (parseFloat(x.custom[id]) || 0), 0);
      return Math.abs(sum - 100) < 0.01 ? { ok: true, msg: 'Adds up to 100% ✓' } : { ok: false, msg: `${+sum.toFixed(2)}% of 100% assigned` };
    }
    return { ok: true, msg: `${money(Math.floor(amt / ps.length))} each${amt % ps.length ? ' (give or take a cent)' : ''}` };
  };
  openSheet({
    title: e ? (e.category === 'settlement' ? 'Payback' : 'Edit expense') : 'Log an expense',
    draft: d,
    submitLabel: e ? 'Save' : 'Log it',
    valid: (x) => check(x).ok,
    body: (x) => {
      const c = check(x);
      const ps = x.participants;
      const splitRows = x.mode === 'even'
        ? `<div class="gchips">${gs.map((g) => gchip(g, ps.includes(g.id), `data-action="dToggle" data-field="participants" data-v="${g.id}"`)).join('')}</div>`
        : `<div class="split-rows">${gs.map((g) => `<div class="split-row" data-key="sr-${g.id}">${gchip(g, ps.includes(g.id), `data-action="dToggle" data-field="participants" data-v="${g.id}"`)}
            <span class="money-input">${x.mode === 'amount' ? `<span class="cur">${esc(cur())}</span>` : ''}<input class="input" inputmode="decimal" data-d="custom.${g.id}" value="${esc(x.custom[g.id] || '')}" placeholder="${x.mode === 'percent' ? '%' : '0'}" ${ps.includes(g.id) ? '' : 'disabled'} aria-label="${esc(g.name)} share" style="${x.mode === 'percent' ? 'padding-left:13px' : ''}"></span></div>`).join('')}</div>`;
      return `<div class="form-grid">
        <label class="field full"><span>What was it?</span><input class="input" data-d="desc" value="${esc(x.desc)}" placeholder="${esc(S.phExpense)}" maxlength="90" autofocus></label>
        <label class="field"><span>Amount</span><span class="money-input"><span class="cur">${esc(cur())}</span><input class="input" inputmode="decimal" data-d="amount" value="${esc(x.amount)}" placeholder="0.00"></span></label>
        ${TIP && x.category !== 'settlement' ? `<label class="field"><span>Tip %</span><input class="input" inputmode="decimal" data-d="tip" value="${esc(x.tip)}" placeholder="0" maxlength="5"></label>
        <p class="full faint tip-note">${esc(TIP.note)}${parseFloat(x.tip) ? ` With tip: <b>${money(billTotal(x))}</b>` : ''}</p>` : ''}
        <label class="field"><span>Paid by</span><select class="select" data-d="paidBy">${guestOptions(x.paidBy)}</select></label>
        <label class="field"><span>Category</span><select class="select" data-d="category">${[...CATS, ...(x.category === 'settlement' ? [SETTLE_CAT] : [])].map((c) => `<option value="${c.id}" ${x.category === c.id ? 'selected' : ''}>${c.emoji} ${c.label}</option>`).join('')}</select></label>
        <label class="field"><span>Date</span><input type="date" class="input" data-d="date" value="${esc(x.date)}"></label>
        <div class="field full"><span>Split</span>
          <div class="seg" role="group" aria-label="Split method">${[['even', 'Evenly'], ['amount', 'By amount'], ['percent', 'By %']].map(([v, l]) => `<button type="button" aria-pressed="${x.mode === v}" data-action="dSet" data-field="mode" data-v="${v}">${l}</button>`).join('')}</div>
        </div>
        <div class="field full"><span class="row between">Split between <span class="row" style="gap:10px"><button type="button" class="linkish" data-action="dAll" data-field="participants">All</button><button type="button" class="linkish" data-action="dNone" data-field="participants">None</button></span></span>
          ${splitRows}
          <div class="split-sum ${c.ok ? 'ok' : 'bad'}" aria-live="polite">${c.msg}</div>
        </div>
      </div>`;
    },
    onSubmit: (x) => {
      const ps = x.participants.filter((id) => guest(id));
      const custom = {};
      if (x.mode !== 'even') ps.forEach((id) => { custom[id] = x.mode === 'amount' ? parseMoney(x.custom[id]) : (parseFloat(x.custom[id]) || 0); });
      const rec = { id: e ? e.id : uid(), desc: x.desc.trim(), amount: billTotal(x), category: x.category, date: x.date, paidBy: x.paidBy, mode: x.mode, participants: ps, custom,
        ...(TIP && x.category !== 'settlement' ? { bill: parseMoney(x.amount), tip: parseFloat(x.tip) || 0 } : {}) };
      if (e) Object.assign(e, rec); else state.expenses.push(rec);
      commit();
      toast(e ? 'Expense updated' : `${money(rec.amount)} logged`);
    },
    onDelete: e ? () => undoable('Expense deleted', () => { state.expenses = state.expenses.filter((x) => x.id !== e.id); }) : null,
  });
}

/* ---- booking ---- */
function bookingSheet(b) {
  const d = b ? { ...b, cost: moneyStr(b.cost) } : { title: '', bookBy: '', assignee: '', booked: false, cost: '', ref: '', tip: '', food: false };
  openSheet({
    title: b ? 'Edit booking' : 'Add a booking',
    draft: d,
    submitLabel: b ? 'Save' : 'Add booking',
    valid: (x) => x.title.trim(),
    body: (x) => `<div class="form-grid">
      <label class="field full"><span>What needs booking?</span><input class="input" data-d="title" value="${esc(x.title)}" placeholder="${esc(S.phBooking)}" maxlength="100" autofocus></label>
      <label class="field"><span>Book by</span><input type="date" class="input" data-d="bookBy" value="${esc(x.bookBy)}"></label>
      <label class="field"><span>Who’s on it</span><select class="select" data-d="assignee">${guestOptions(x.assignee, 'Unassigned')}</select></label>
      <label class="field"><span>Cost</span><span class="money-input"><span class="cur">${esc(cur())}</span><input class="input" inputmode="decimal" data-d="cost" value="${esc(x.cost)}" placeholder="0"></span></label>
      <label class="field"><span>Confirmation #</span><input class="input" data-d="ref" value="${esc(x.ref)}" placeholder="optional" maxlength="60"></label>
      <label class="field full"><span>Good to know</span><textarea class="textarea" rows="3" data-d="tip" placeholder="Booking window, dress code, cancellation policy…">${esc(x.tip)}</textarea></label>
      <label class="switch full"><input type="checkbox" data-d="food" ${x.food ? 'checked' : ''}><span class="track"></span>Food booking — show the group’s dietary notes</label>
      <label class="switch full"><input type="checkbox" data-d="booked" ${x.booked ? 'checked' : ''}><span class="track"></span>Already booked</label>
    </div>`,
    onSubmit: (x) => {
      const rec = { id: b ? b.id : uid(), title: x.title.trim(), bookBy: x.bookBy, assignee: x.assignee, booked: !!x.booked, cost: parseMoney(x.cost), ref: x.ref.trim(), tip: x.tip.trim(), food: !!x.food,
        // a hand-picked date stops it following the trip dates
        ...(b && b.lead != null ? { lead: b.lead, auto: x.bookBy === b.bookBy ? b.auto : false } : {}) };
      if (b) Object.assign(b, rec); else state.bookings.push(rec);
      commit();
      toast(b ? 'Booking updated' : 'Booking added');
    },
    onDelete: b ? () => undoable('Booking deleted', () => {
      state.bookings = state.bookings.filter((x) => x.id !== b.id);
      state.itinerary.forEach((i) => { if (i.bookingId === b.id) i.bookingId = ''; });
    }) : null,
  });
}

/* ---- dream board ---- */
function dreamSheet(dr) {
  const d = dr ? { link: '', ...dr } : { title: '', note: '', kind: 'see', link: '' };
  openSheet({
    title: dr ? 'Edit idea' : 'Pin an idea',
    draft: d,
    submitLabel: dr ? 'Save' : 'Pin it',
    valid: (x) => x.title.trim(),
    body: (x) => `<div class="form-grid">
      <label class="field full"><span>Place or idea</span><input class="input" data-d="title" value="${esc(x.title)}" placeholder="${esc(S.phDream)}" maxlength="90" autofocus></label>
      <label class="field full"><span>Note</span><input class="input" data-d="note" value="${esc(x.note)}" placeholder="Why it’s on the board" maxlength="160"></label>
      <div class="field full"><span>Kind</span><div class="gchips">${DREAM_KINDS.map((k) => `<button type="button" class="gchip" style="--c:var(--sage-deep);padding-left:12px" aria-pressed="${x.kind === k.id}" data-action="dSet" data-field="kind" data-v="${k.id}">${k.emoji} ${k.label}</button>`).join('')}</div></div>
      <label class="field full"><span>Link <small class="faint">(optional)</small></span><input class="input" type="url" inputmode="url" data-d="link" value="${esc(x.link)}" placeholder="Paste a TikTok, Instagram or Google Maps link" maxlength="500"></label>
    </div>`,
    onSubmit: (x) => {
      const rec = { title: x.title.trim(), note: x.note.trim(), kind: x.kind, link: (x.link || '').trim() };
      if (dr) Object.assign(dr, rec); else state.dream.unshift({ id: uid(), ...rec, promoted: '', rot: +((Math.random() * 5) - 2.5).toFixed(1) });
      commit();
      toast(dr ? 'Idea updated' : 'Saved to the board');
    },
    onDelete: dr ? () => undoable('Idea removed', () => { state.dream = state.dream.filter((x) => x.id !== dr.id); }) : null,
  });
}
function dreamToPlanSheet(dr) {
  const days = tripDays();
  if (!days.length) { toast('Set your trip dates on the Home page first.'); return; }
  openSheet({
    title: 'Move to the itinerary',
    draft: { day: 0, time: '' },
    submitLabel: 'Add to itinerary',
    body: (x) => `<p class="muted" style="margin-bottom:14px">Add <b>${esc(dr.title)}</b> to the itinerary.</p>
      <div class="form-grid">
        <label class="field"><span>Day</span><select class="select" data-d="day" data-type="int">${dayOptions(x.day)}</select></label>
        <label class="field"><span>Time</span><input type="time" class="input" data-d="time" value="${esc(x.time)}"></label>
      </div>`,
    onSubmit: (x) => {
      state.itinerary.push({ id: uid(), day: +x.day, time: x.time, title: dr.title, note: dr.note, cost: 0, bookingId: '', activityId: '' });
      dr.promoted = 'plan';
      commit();
      toast(`On the plan for Day ${+x.day + 1}`, { action: 'View', onAction: () => go('itinerary') });
    },
  });
}

/* ==========================================================================
   Backup: save / load / start over
   ========================================================================== */
function exportData() {
  flush();
  const payload = { app: 'booked-and-busy', edition: CITY.id, schema: SCHEMA, exportedAt: new Date().toISOString(), data: state };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const slug = (state.trip.name || `${CITY.id}-trip`).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || `${CITY.id}-trip`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${slug}-${isoOf(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  try { localStorage.setItem(BACKUP_KEY, new Date().toISOString()); } catch (e) { /* ignore */ }
  toast('Copy saved to your downloads');
  render();
}
function importData() {
  const inp = $('#filePick');
  inp.value = '';
  inp.onchange = () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      let data;
      try {
        const parsed = JSON.parse(r.result);
        data = parsed && parsed.data && parsed.app === 'booked-and-busy' ? parsed.data : parsed;
        if (!data || typeof data !== 'object' || !data.trip || !Array.isArray(data.guests)) throw new Error('shape');
      } catch (e) {
        toast('That file isn’t a Booked & Busy trip copy. Look for the .json file you downloaded from this page.');
        return;
      }
      const when = (() => { try { return JSON.parse(r.result).exportedAt; } catch (e) { return null; } })();
      confirmSheet({
        title: 'Open this copy?',
        text: `“<b>${esc(data.trip.name || 'Untitled trip')}</b>”${when ? `, saved ${esc(fmtLong(new Date(when)))}` : ''} — ${pl((data.guests || []).length, 'traveler')}, ${pl((data.itinerary || []).length, 'plan')}. This replaces what’s on this device right now (you can undo straight after).`,
        ok: 'Open copy',
        onOk: () => undoable('Trip copy opened', () => { state = normalize(data); }),
      });
    };
    r.readAsText(f);
  };
  inp.click();
}
function resetMenu() {
  openSheet({
    title: 'Start over?',
    body: () => `<p class="muted" style="margin-bottom:14px">Tip: download a copy first if there’s anything you want to keep. Either way you can undo right after.</p>
      <div class="stack" style="gap:10px">
        <button type="button" class="card lift" style="text-align:left;font:inherit;color:inherit" data-action="doReset" data-v="blank"><b style="font:600 18px var(--f-display)">Blank trip</b><p class="muted" style="font-size:13.5px;margin-top:4px">Clears the sample travelers, plans, money and journal. Keeps the ${CITY.name} ideas and booking tips so you’re not starting from zero.</p></button>
        <button type="button" class="card lift" style="text-align:left;font:inherit;color:inherit" data-action="doReset" data-v="sample"><b style="font:600 18px var(--f-display)">Sample trip</b><p class="muted" style="font-size:13.5px;margin-top:4px">Bring back the example trip to see how everything works.</p></button>
      </div>`,
  });
}

/* ==========================================================================
   Toasts + confetti
   ========================================================================== */
function toast(msg, opts = {}) {
  const box = $('#toasts');
  const t = document.createElement('div');
  t.className = 'toast';
  t.setAttribute('role', 'status');
  t.innerHTML = `<span>${esc(msg)}</span>${opts.action ? `<button type="button">${esc(opts.action)}</button>` : ''}`;
  const kill = () => { t.classList.add('out'); setTimeout(() => t.remove(), 260); };
  if (opts.action) t.querySelector('button').onclick = () => { kill(); opts.onAction(); };
  box.appendChild(t);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(kill, opts.action ? 6000 : 2600);
}
function confetti(fromEl) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const r = fromEl ? fromEl.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
  const colors = CITY.confettiColors;
  for (let i = 0; i < 26; i++) {
    const c = document.createElement('i');
    c.className = 'confetti';
    c.style.background = colors[i % colors.length];
    c.style.left = r.left + r.width / 2 + 'px';
    c.style.top = r.top + r.height / 2 + 'px';
    document.body.appendChild(c);
    const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 110;
    c.animate([
      { transform: 'translate(0,0) rotate(0)', opacity: 1 },
      { transform: `translate(${Math.cos(a) * v}px, ${Math.sin(a) * v + 120}px) rotate(${Math.random() * 720}deg)`, opacity: 0 },
    ], { duration: 900 + Math.random() * 500, easing: 'cubic-bezier(.2,.8,.3,1)' }).onfinish = () => c.remove();
  }
}

/* ==========================================================================
   Actions (click → data-action)
   ========================================================================== */
const A = {
  go: (el) => { closeSheet(); go(el.dataset.tab); },
  more: () => openSheet({
    title: 'All sections',
    body: () => `<div class="more-grid">${TABS.map((t) => `<button type="button" data-action="go" data-tab="${t.id}" ${ui.tab === t.id ? 'aria-current="page"' : ''}>${icon(t.id)}${t.label}</button>`).join('')}</div><div style="margin-top:16px">${backupCard()}</div>`,
  }),
  closeSheet: () => closeSheet(),
  shareLink: () => shareLink(),
  whoAmI: () => askWhoAreYou(true),
  pickMe: (el) => setMe(el.dataset.g),
  sheetDelete: () => { const fn = sheet && sheet.onDelete; closeSheet(); if (fn) fn(); },
  exportData: () => exportData(),
  importData: () => { closeSheet(); importData(); },
  resetMenu: () => resetMenu(),
  doReset: (el) => { closeSheet(); undoable(el.dataset.v === 'blank' ? 'Started a blank trip' : 'Sample trip restored', () => { state = el.dataset.v === 'blank' ? makeBlank() : makeSeed(); }); try { localStorage.setItem(WELCOME_KEY, '1'); } catch (e) { /* ignore */ } render(); },
  dismissWelcome: () => { try { localStorage.setItem(WELCOME_KEY + (SYNC.on ? ':' + SYNC.tripId : ''), '1'); } catch (e) { /* ignore */ } render(); },


  removeGuest: (el) => {
    const g = guest(el.dataset.id);
    const n = state.expenses.filter((e) => e.paidBy === g.id || e.participants.includes(g.id)).length;
    if (n) { toast(`${firstName(g.name)} is part of ${pl(n, 'logged expense')}. Edit or delete those first so the money still adds up.`); return; }
    undoable(`${firstName(g.name)} removed`, () => {
      state.guests = state.guests.filter((x) => x.id !== g.id);
      state.activities.forEach((a) => { a.votes = a.votes.filter((v) => v !== g.id); });
      state.packing = state.packing.filter((p) => p.guestId !== g.id);
      state.bookings.forEach((b) => { if (b.assignee === g.id) b.assignee = ''; });
    });
  },

  voteAs: (el) => { ui.voteAs = el.dataset.g; render(); },
  vote: (el) => {
    const a = state.activities.find((x) => x.id === el.dataset.id);
    const g = el.dataset.g;
    a.votes = a.votes.includes(g) ? a.votes.filter((v) => v !== g) : [...a.votes, g];
    commit();
  },
  addActivity: () => activitySheet(),
  removeActivity: (el) => {
    const a = state.activities.find((x) => x.id === el.dataset.id);
    undoable(`“${a.title}” removed from the vote`, () => {
      state.activities = state.activities.filter((x) => x.id !== a.id);
      state.itinerary.forEach((i) => { if (i.activityId === a.id) i.activityId = ''; });
    });
  },

  jumpPocket: (el) => { const t = document.getElementById('pocket-' + el.dataset.v); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
  sayPhrase: (el) => {
    const x = CITY.pocket.phrases.items[+el.dataset.i];
    if (!x || !canSpeak()) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(x.say.replace(/[()]/g, '').replace(/\//g, ','));
    u.lang = CITY.pocket.lang;
    u.rate = 0.85;
    speechSynthesis.speak(u);
  },
  jumpDay: (el) => { const t = document.getElementById('day-' + el.dataset.day); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
  addItem: (el) => itemSheet(null, el.dataset.day),
  editItem: (el) => itemSheet(state.itinerary.find((x) => x.id === el.dataset.id)),
  winners: () => winnersSheet(),
  winnerAdd: (el) => {
    const a = state.activities.find((x) => x.id === el.dataset.id);
    const pk = sheet.draft.picks[a.id] || { day: 0, time: '' };
    state.itinerary.push({ id: uid(), day: +pk.day, time: pk.time, title: a.title, note: a.note, cost: 0, bookingId: '', activityId: a.id });
    commit();
    toast(`${a.emoji || ''} Added to Day ${+pk.day + 1}`.trim());
  },

  budgetView: (el) => { ui.budgetView = el.dataset.v; render(); },
  addExpense: () => { if (state.guests.length) expenseSheet(null); },
  logTax: () => {
    const t = touristTax();
    expenseSheet(null, { desc: `Tourist tax (${t.stay.label}, ${pl(t.adults, 'adult')} × ${pl(t.nights, 'night')})`.slice(0, 90), amount: moneyStr(t.total), category: 'stay', ...(TIP ? { tip: '0' } : {}) });
  },
  editExpense: (el) => expenseSheet(state.expenses.find((x) => x.id === el.dataset.id)),
  markPaid: (el) => {
    const from = el.dataset.from, to = el.dataset.to, amount = +el.dataset.amount;
    undoable(`${firstName(guest(from).name)} paid ${firstName(guest(to).name)} ${money(amount)} ✓`, () => {
      state.expenses.push({ id: uid(), desc: `${firstName(guest(from).name)} paid ${firstName(guest(to).name)} back`, amount, category: 'settlement', date: isoOf(today()), paidBy: from, mode: 'amount', participants: [to], custom: { [to]: amount } });
    });
    if (!settleUp().length) confetti(el);
  },

  bookFilter: (el) => { ui.bookFilter = el.dataset.v; render(); },
  addBooking: () => bookingSheet(null),
  editBooking: (el) => bookingSheet(state.bookings.find((x) => x.id === el.dataset.id)),

  packGuest: (el) => { ui.packGuest = el.dataset.g; render(); },
  packScope: (el) => { ui.packScope = el.dataset.v; render(); },
  removePack: (el) => { const p = state.packing.find((x) => x.id === el.dataset.id); undoable(`“${p.text}” removed`, () => { state.packing = state.packing.filter((x) => x.id !== p.id); }); },

  addDream: () => dreamSheet(null),
  editDream: (el) => dreamSheet(state.dream.find((x) => x.id === el.dataset.id)),
  dreamToPlan: (el) => dreamToPlanSheet(state.dream.find((x) => x.id === el.dataset.id)),
  dreamToVote: (el) => {
    const d = state.dream.find((x) => x.id === el.dataset.id);
    const k = DREAM_KINDS.find((x) => x.id === d.kind) || DREAM_KINDS[0];
    if (state.activities.some((a) => a.title === d.title)) { toast('That one’s already up for a vote'); return; }
    state.activities.push({ id: uid(), emoji: k.emoji, title: d.title, note: d.note, votes: [], custom: true });
    d.promoted = d.promoted || 'vote';
    commit();
    toast('Added to Group Picks', { action: 'View', onAction: () => go('vote') });
  },

  writeDay: (el) => {
    const day = +el.dataset.day;
    let e = state.journal.find((x) => x.day === day);
    if (!e) { e = { id: uid(), day, title: '', text: '', favorite: '', quote: '' }; state.journal.push(e); }
    if (ui.tab !== 'memories') go('memories'); else commit();
    save();
    setTimeout(() => { const t = document.getElementById('jx-' + e.id); if (t) { t.scrollIntoView({ behavior: 'smooth', block: 'center' }); t.focus({ preventScroll: true }); } }, 80);
  },
  addPage: () => {
    const e = { id: uid(), day: null, title: '', text: '', favorite: '', quote: '' };
    state.journal.push(e);
    commit();
    setTimeout(() => { const t = document.getElementById('jt-' + e.id); if (t) { t.scrollIntoView({ behavior: 'smooth', block: 'center' }); t.focus({ preventScroll: true }); } }, 80);
  },
  removeEntry: (el) => undoable('Page deleted', () => { state.journal = state.journal.filter((x) => x.id !== el.dataset.id); }),

  /* draft helpers inside sheets */
  dToggle: (el) => { const arr = sheet.draft[el.dataset.field]; const v = el.dataset.v; const i = arr.indexOf(v); if (i > -1) arr.splice(i, 1); else arr.push(v); renderSheet(); },
  dSet: (el) => { sheet.draft[el.dataset.field] = el.dataset.v; renderSheet(); },
  dAll: (el) => { sheet.draft[el.dataset.field] = state.guests.map((g) => g.id); renderSheet(); },
  dNone: (el) => { sheet.draft[el.dataset.field] = []; renderSheet(); },
};

/* after-hooks for data-bind fields */
const AFTER = {
  fixDates: () => {
    const s = parseISO(state.trip.start), e = parseISO(state.trip.end);
    if (s && (!e || e < s)) state.trip.end = state.trip.start;
    if (s && e && diffDays(s, e) > 59) state.trip.end = isoOf(addDays(s, 59));
    // bookings with a lead time ("book 60 days ahead") move with the trip unless someone set a date by hand
    if (s) state.bookings.forEach((b) => { if (b.lead != null && b.auto !== false) b.bookBy = isoOf(addDays(s, -b.lead)); });
  },
  celebrateBooked: (el) => { if (el.checked) { confetti(el); toast('Marked as booked'); } },
  celebratePacked: (el) => {
    if (!el.checked) return;
    const p = state.packing.find((x) => `packing:${x.id}:done` === el.dataset.bind);
    const s = p && packStats(p.guestId);
    if (s && s.pct === 100) { confetti(el); toast(`${firstName(guest(p.guestId).name)} is all packed`); }
  },
};

function applyBind(el) {
  const [col, id, field] = el.dataset.bind.split(':');
  const obj = col === 'trip' ? state.trip : col === 'tax' ? state.tax : (state[col] || []).find((x) => x.id === id);
  if (!obj) return;
  let v = el.type === 'checkbox' ? el.checked : el.value;
  if (el.dataset.type === 'money') v = parseMoney(v);
  obj[field] = v;
  if (el.dataset.after && AFTER[el.dataset.after]) AFTER[el.dataset.after](el);
  commit();
}
function applyDraft(el) {
  if (!sheet) return;
  let v = el.type === 'checkbox' ? el.checked : el.value;
  if (el.dataset.type === 'int') v = parseInt(v, 10) || 0;
  const path = el.dataset.d.split('.');
  let o = sheet.draft;
  for (let i = 0; i < path.length - 1; i++) { o[path[i]] = o[path[i]] || {}; o = o[path[i]]; }
  o[path[path.length - 1]] = v;
  renderSheet();
}
const isToggle = (el) => el.type === 'checkbox' || el.type === 'radio' || el.tagName === 'SELECT' || el.type === 'date' || el.type === 'time';

/* ==========================================================================
   Events + boot
   ========================================================================== */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = A[el.dataset.action];
  if (fn) { e.preventDefault(); fn(el, e); }
});
document.addEventListener('input', (e) => {
  const el = e.target;
  if (isToggle(el)) return;
  if (el.classList.contains('autosize') && /\n/.test(el.value)) el.value = el.value.replace(/\n+/g, ' ');
  if (el.dataset.bind) applyBind(el);
  else if (el.dataset.d) applyDraft(el);
});
document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.bind) { if (isToggle(el)) applyBind(el); else render(); }
  else if (el.dataset.d && isToggle(el)) applyDraft(el);
});
document.addEventListener('submit', (e) => {
  const f = e.target;
  e.preventDefault();
  if (f.id === 'sheetForm') {
    if (!sheet || !sheet.onSubmit) return;
    if (sheet.valid && !sheet.valid(sheet.draft)) return;
    const s = sheet;
    closeSheet();
    s.onSubmit(s.draft);
    return;
  }
  const data = Object.fromEntries(new FormData(f));
  if (f.dataset.form === 'addGuest') {
    const name = (data.name || '').trim();
    if (!name) return;
    addGuestTo(state, name);
    f.reset();
    commit();
    toast(`${firstName(name)} added`);
  } else if (f.dataset.form === 'addPack') {
    const text = (data.text || '').trim();
    if (!text) return;
    const targets = ui.packScope === 'all' ? state.guests.map((g) => g.id) : [ui.packGuest];
    targets.forEach((gid) => state.packing.push({ id: uid(), guestId: gid, cat: f.dataset.cat, text, done: false }));
    f.reset();
    commit();
    if (targets.length > 1) toast(`Added to everyone’s ${PACK_CATS.find((c) => c.id === f.dataset.cat).label} list`);
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && sheet) closeSheet();
  if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('autosize')) { e.preventDefault(); e.target.blur(); }
});
window.addEventListener('hashchange', () => { const t = location.hash.slice(1); if (VIEWS[t] && t !== ui.tab) { closeSheet(); go(t); } });
window.addEventListener('pagehide', () => { if (SYNC.on) { if (pushTimer) push(); } else if (saveTimer) flush(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { if (SYNC.on) { if (pushTimer) push(); } else if (saveTimer) flush(); } else if (document.visibilityState === 'visible' && state) render(); });
window.addEventListener('storage', (e) => {
  if (!SYNC.on && e.key === STORE_KEY && e.newValue) { try { state = normalize(JSON.parse(e.newValue)); render(); } catch (err) { /* ignore */ } }
});

/* ==========================================================================
   Live sync: one link per trip, shared by the whole group.
   Paste your Firebase web config into BB_FIREBASE to turn it on.
   Leave it as null and the planner works in a single browser (no sync).
   ========================================================================== */
const BB_FIREBASE = CITY.firebase;
const FIREBASE_VERSION = '12.19.0';
const USE_MOCK = !BB_FIREBASE && (() => { try { return new URLSearchParams(location.search).has('mock'); } catch (e) { return false; } })();
const SYNC_ENABLED = !!BB_FIREBASE || USE_MOCK;
const ME_KEY = 'bookedBusy:me:';
const SYNC = { on: false, tripId: '', api: null, base: null, rev: 0, pushing: false, pendingRemote: null, status: 'live', me: '' };
let pushTimer = null;

/* ---------- deep helpers ---------- */
const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
function deepEq(a, b) {
  if (a === b) return true;
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => deepEq(x, b[i]));
  if (isObj(a)) {
    if (!isObj(b)) return false;
    const ka = Object.keys(a).filter((k) => a[k] !== undefined);
    const kb = Object.keys(b).filter((k) => b[k] !== undefined);
    return ka.length === kb.length && ka.every((k) => deepEq(a[k], b[k]));
  }
  return false;
}
const isIdArr = (a) => Array.isArray(a) && a.every((x) => isObj(x) && typeof x.id === 'string');
const isPrimArr = (a) => Array.isArray(a) && a.every((x) => x === null || typeof x !== 'object');

/**
 * Three-way merge: `base` is the last version both sides agreed on, `local` is this
 * device, `remote` is what's in the cloud. Lists of items merge item by item (by id),
 * so two people adding expenses or votes at the same moment both land.
 */
function merge3(base, local, remote) {
  if (deepEq(local, base)) return clone(remote);
  if (deepEq(remote, base) || deepEq(local, remote)) return clone(local);
  if (Array.isArray(local) && Array.isArray(remote)) {
    const b = Array.isArray(base) ? base : [];
    if (isIdArr(local) && isIdArr(remote) && isIdArr(b)) return mergeById(b, local, remote);
    if (isPrimArr(local) && isPrimArr(remote) && isPrimArr(b)) {
      const added = local.filter((v) => !b.includes(v));
      const removed = b.filter((v) => !local.includes(v));
      const out = remote.filter((v) => !removed.includes(v));
      added.forEach((v) => { if (!out.includes(v)) out.push(v); });
      return out;
    }
    return clone(local);
  }
  if (isObj(local) && isObj(remote)) {
    const b = isObj(base) ? base : {};
    const out = {};
    new Set([...Object.keys(local), ...Object.keys(remote), ...Object.keys(b)]).forEach((k) => {
      const v = merge3(b[k], local[k], remote[k]);
      if (v !== undefined) out[k] = v;
    });
    return out;
  }
  return clone(local);
}
function mergeById(b, l, r) {
  const bm = new Map(b.map((x) => [x.id, x]));
  const lm = new Map(l.map((x) => [x.id, x]));
  const rm = new Map(r.map((x) => [x.id, x]));
  const out = [];
  for (const x of l) {
    const inB = bm.has(x.id), inR = rm.has(x.id);
    if (inB && !inR) { if (!deepEq(x, bm.get(x.id))) out.push(clone(x)); continue; } // someone else deleted it; keep only if we edited it
    if (!inB && !inR) { out.push(clone(x)); continue; } // new on this device
    out.push(merge3(bm.get(x.id), x, rm.get(x.id)));
  }
  r.forEach((x, i) => {
    if (lm.has(x.id) || bm.has(x.id)) return; // already merged, or deleted on this device
    out.splice(Math.min(i, out.length), 0, clone(x)); // new from someone else
  });
  return out;
}

/* ---------- backends ---------- */
async function firebaseBackend() {
  const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
  const [appMod, fs] = await Promise.all([import(`${base}/firebase-app.js`), import(`${base}/firebase-firestore.js`)]);
  const db = fs.getFirestore(appMod.initializeApp(BB_FIREBASE));
  const ref = (id) => fs.doc(db, 'trips', id);
  return {
    create: (id, p) => fs.setDoc(ref(id), { ...p, createdAt: fs.serverTimestamp(), updatedAt: fs.serverTimestamp() }),
    subscribe: (id, cb, onErr) => fs.onSnapshot(ref(id), (snap) => {
      if (snap.metadata.hasPendingWrites) return;
      cb(snap.exists() ? snap.data() : null);
    }, onErr),
    transact: (id, fn) => fs.runTransaction(db, async (tx) => {
      const snap = await tx.get(ref(id));
      if (!snap.exists()) throw new Error('missing');
      const cur = snap.data();
      const data = clone(fn(cur.data || {}));
      const rev = (+cur.rev || 0) + 1;
      tx.update(ref(id), { data, rev, updatedAt: fs.serverTimestamp() });
      return { data, rev };
    }),
  };
}
/** Test backend (add ?mock to the URL with no Firebase config): syncs tabs in one browser. Access code: CITY.mockCode. */
function mockBackend() {
  const key = (id) => 'bookedBusy:mock:' + id;
  const read = (id) => { try { return JSON.parse(localStorage.getItem(key(id)) || 'null'); } catch (e) { return null; } };
  const subs = new Map();
  const bc = 'BroadcastChannel' in window ? new BroadcastChannel('bookedBusy-mock') : null;
  const notify = (id) => { const cb = subs.get(id); if (cb) setTimeout(() => cb(read(id)), 60 + Math.random() * 120); };
  if (bc) bc.onmessage = (e) => notify(e.data);
  const wait = () => new Promise((r) => setTimeout(r, 80 + Math.random() * 160));
  return {
    async create(id, p) {
      await wait();
      if (p.code !== CITY.mockCode) { const e = new Error('permission-denied'); e.code = 'permission-denied'; throw e; }
      localStorage.setItem(key(id), JSON.stringify(p));
    },
    subscribe(id, cb) { subs.set(id, cb); notify(id); return () => subs.delete(id); },
    async transact(id, fn) {
      await wait();
      const cur = read(id);
      if (!cur) throw new Error('missing');
      const data = clone(fn(cur.data || {}));
      const rev = (+cur.rev || 0) + 1;
      localStorage.setItem(key(id), JSON.stringify({ ...cur, data, rev }));
      if (bc) bc.postMessage(id);
      notify(id);
      return { data, rev };
    },
  };
}
const getBackend = () => (USE_MOCK ? mockBackend() : firebaseBackend());

/* ---------- trip links ---------- */
function tripIdFromUrl() {
  const m = location.pathname.match(/\/t\/([A-Za-z0-9]{8,32})\/?$/);
  if (m) return m[1];
  try { const q = new URLSearchParams(location.search).get('trip') || ''; return /^[A-Za-z0-9]{8,32}$/.test(q) ? q : ''; } catch (e) { return ''; }
}
function tripLink(id = SYNC.tripId) {
  if (!USE_MOCK && /^https?:$/.test(location.protocol)) return `${location.origin}/t/${id}`;
  return `${location.origin}${location.pathname}?trip=${id}${USE_MOCK ? '&mock' : ''}`;
}
function newTripId() {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
  const r = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(r, (n) => abc[n % abc.length]).join('');
}
async function shareLink() {
  const url = tripLink();
  const title = (state && state.trip.name) || 'Our trip';
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try { await navigator.share({ title, text: `${title}: here’s where our trip lives`, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(url); toast('Trip link copied. Paste it in your group chat.'); }
  catch (e) { openSheet({ title: 'Your trip link', body: () => `<p class="muted">Copy this link and send it to your group.</p><div class="share-box"><code>${esc(url)}</code></div>` }); }
}
const safeUrl = (u) => {
  u = String(u || '').trim();
  if (!u) return '';
  try { const x = new URL(/^[a-z]+:\/\//i.test(u) ? u : 'https://' + u); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch (e) { return ''; }
};
function linkLabel(u) {
  try {
    const x = new URL(safeUrl(u));
    const h = x.hostname.replace(/^www\./, '');
    if (/tiktok\.com$/.test(h)) return 'Open on TikTok';
    if (/instagram\.com$/.test(h)) return 'Open on Instagram';
    if (/(^maps\.|goo\.gl$|maps\.app\.goo\.gl$)/.test(h) || (/google\./.test(h) && x.pathname.startsWith('/maps'))) return 'Open in Google Maps';
    return `Open ${h}`;
  } catch (e) { return 'Open link'; }
}

/* ---------- who's on this device ---------- */
function addGuestTo(st, name) {
  const used = new Set(st.guests.map((g) => g.color));
  const color = GUEST_COLORS.find((c) => !used.has(c)) || GUEST_COLORS[st.guests.length % GUEST_COLORS.length];
  const g = { id: uid(), name, color, diet: '', arrive: '', depart: '', confirmed: true };
  st.guests.push(g);
  PACK_CATS.forEach((c) => PACK_TEMPLATE[c.id].forEach((text) => st.packing.push({ id: uid(), guestId: g.id, cat: c.id, text, done: false })));
  return g;
}
function meButton() {
  const g = guest(SYNC.me);
  return g
    ? `<button type="button" class="me-btn" data-action="whoAmI" title="Not you? Tap to switch">${avatar(g)}<span>${esc(firstName(g.name))}</span></button>`
    : `<button type="button" class="btn small ghost" data-action="whoAmI">Who are you?</button>`;
}
function setMe(id) {
  const g = guest(id);
  if (!g) return;
  SYNC.me = id;
  try { localStorage.setItem(ME_KEY + SYNC.tripId, id); } catch (e) { /* ignore */ }
  ui.voteAs = id;
  ui.packGuest = id;
  closeSheet();
  render();
  toast(`You’re in as ${firstName(g.name)}`);
}
function askWhoAreYou() {
  openSheet({
    title: 'Who are you?',
    draft: { name: '' },
    submitLabel: 'Add me',
    valid: (x) => x.name.trim(),
    body: (x) => `<p class="muted" style="margin-bottom:12px;font-size:13.5px">Pick your name so your votes and packing list are yours. This is only saved on this device.</p>
      ${state.guests.length ? `<div class="gchips" style="margin-bottom:16px">${state.guests.map((g) => gchip(g, g.id === SYNC.me, `data-action="pickMe" data-g="${g.id}"`)).join('')}</div>` : ''}
      <label class="field"><span>Not on the list yet?</span><input class="input" data-d="name" value="${esc(x.name)}" placeholder="Your name" maxlength="60"></label>`,
    onSubmit: (x) => { const g = addGuestTo(state, x.name.trim()); commit(); setMe(g.id); },
  });
}

/* ---------- status ---------- */
function syncLabel() { return { live: 'Saved · live', saving: 'Saving…', offline: 'Offline · retrying' }[SYNC.status] || ''; }
function setStatus(st) {
  if (SYNC.status === st) return;
  SYNC.status = st;
  document.querySelectorAll('.sync-pill').forEach((el) => {
    el.className = `sync-pill ${st}`;
    el.title = syncLabel();
    const t = el.querySelector('span');
    if (t) t.textContent = syncLabel();
  });
}

/* ---------- open a trip + keep it in sync ---------- */
async function startSync(id) {
  SYNC.on = true;
  SYNC.tripId = id;
  showBoot('Opening your trip…');
  try { SYNC.api = SYNC.api || await getBackend(); } catch (e) { showBoot('We couldn’t connect. Check your internet connection and refresh the page.', true); return; }
  let first = true;
  SYNC.unsub = SYNC.api.subscribe(id, (doc) => {
    if (!doc) { if (first) showNotFound(); return; }
    const rev = +doc.rev || 0;
    const remote = normalize(clone(doc.data || {}));
    if (first) {
      first = false;
      state = remote;
      SYNC.base = clone(remote);
      SYNC.rev = rev;
      try { SYNC.me = localStorage.getItem(ME_KEY + id) || ''; } catch (e) { /* ignore */ }
      if (guest(SYNC.me)) { ui.voteAs = SYNC.me; ui.packGuest = SYNC.me; }
      hideOverlay();
      render();
      if (!guest(SYNC.me)) setTimeout(() => { if (!sheet) askWhoAreYou(); }, 500);
      return;
    }
    if (rev <= SYNC.rev) return;
    if (SYNC.pushing) { if (!SYNC.pendingRemote || rev > SYNC.pendingRemote.rev) SYNC.pendingRemote = { rev, data: remote }; return; }
    applyRemote(remote, rev);
  }, (err) => { console.warn('sync error', err); setStatus('offline'); if (first) showBoot('We couldn’t open this trip. Check the link and your internet connection.', true); });
}
function applyRemote(remote, rev) {
  if (rev <= SYNC.rev) return;
  const merged = merge3(SYNC.base, state, remote);
  SYNC.base = clone(remote);
  SYNC.rev = rev;
  if (!deepEq(merged, state)) { state = normalize(merged); render(); }
  if (!deepEq(state, SYNC.base)) schedulePush(); else setStatus('live');
}
function schedulePush() { clearTimeout(pushTimer); pushTimer = setTimeout(push, 500); setStatus('saving'); }
async function push() {
  clearTimeout(pushTimer);
  pushTimer = null;
  if (!SYNC.api || !state || !SYNC.base) return;
  if (SYNC.pushing) return; // the running push re-checks when it finishes
  const sent = clone(state);
  const base = clone(SYNC.base);
  if (deepEq(sent, base)) { setStatus('live'); return; }
  SYNC.pushing = true;
  setStatus('saving');
  let ok = false;
  try {
    const res = await SYNC.api.transact(SYNC.tripId, (remote) => merge3(base, sent, normalize(clone(remote || {}))));
    ok = true;
    if (res.rev > SYNC.rev) { SYNC.base = clone(res.data); SYNC.rev = res.rev; }
    const next = merge3(sent, state, res.data); // keeps anything typed while this save was in flight
    if (!deepEq(next, state)) { state = normalize(next); render(); }
  } catch (e) {
    console.warn('save failed', e);
    setStatus('offline');
  } finally {
    SYNC.pushing = false;
    const pr = SYNC.pendingRemote;
    SYNC.pendingRemote = null;
    if (pr && pr.rev > SYNC.rev) applyRemote(pr.data, pr.rev);
    if (!deepEq(state, SYNC.base)) { clearTimeout(pushTimer); pushTimer = setTimeout(push, ok ? 60 : 4000); }
    else setStatus('live');
  }
}

/* ---------- full-screen pages: loading, start a trip, not found ---------- */
function hideOverlay() { $('#overlay').innerHTML = ''; $('#app').hidden = false; }
function showBoot(msg, isErr = false) {
  $('#app').hidden = true;
  $('#overlay').innerHTML = `<div class="boot collage"><div class="card start-card">
    <div class="wordmark">${LOGO_SVG}</div>
    <p class="${isErr ? '' : 'muted'}" style="margin-top:14px;${isErr ? 'color:var(--red);font-weight:600' : ''}">${esc(msg)}</p>
  </div></div>`;
}
function homeHref() { return USE_MOCK ? `${location.pathname}?mock` : '/'; }
function showNotFound() {
  $('#app').hidden = true;
  $('#overlay').innerHTML = `<div class="boot collage"><div class="card start-card">
    <div class="wordmark">${LOGO_SVG}</div>
    <h3 style="margin-top:16px">We couldn’t find that trip</h3>
    <p class="muted" style="margin:6px 0 16px">Check that the link is complete, or start a new trip.</p>
    <a class="btn primary" href="${esc(homeHref())}">Start a new trip</a>
  </div></div>`;
}
function showStart() {
  $('#app').hidden = true;
  $('#overlay').innerHTML = `<div class="start collage"><div class="start-card">
    <div class="start-art">${heroArt()}</div>
    <div class="wordmark">${LOGO_SVG}</div>
    <div class="tag">everyone on the same page</div>
    <form id="startForm" novalidate>
      <label class="field"><span>Trip name</span><input class="input" name="name" value="${esc(S.blankTripName)}" maxlength="80"></label>
      <label class="field"><span>Your name</span><input class="input" name="me" placeholder="e.g. Maya" maxlength="60" autocomplete="given-name"></label>
      <label class="field"><span>Access code <small class="faint">(from your download)</small></span><input class="input" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false"></label>
      <div class="opt" role="radiogroup" aria-label="Start from">
        <label><input type="radio" name="from" value="blank" checked><b>Blank trip</b>Keeps the ${CITY.name} ideas and booking tips</label>
        <label><input type="radio" name="from" value="sample"><b>Sample trip</b>A filled-in example to explore</label>
      </div>
      <div class="err" id="startErr" role="alert"></div>
      <button type="submit" class="btn primary" style="width:100%;justify-content:center">Create my trip</button>
    </form>
    <p class="foot">Already have a trip? Open the link your group shared.</p>
  </div></div>`;
  $('#startForm').addEventListener('submit', onStartSubmit);
}
async function onStartSubmit(e) {
  e.preventDefault();
  e.stopPropagation();
  const f = e.target;
  const fd = Object.fromEntries(new FormData(f));
  const name = (fd.name || '').trim() || S.blankTripName;
  const me = (fd.me || '').trim();
  const code = (fd.code || '').trim();
  const err = $('#startErr');
  if (!me) { err.textContent = 'Add your name so the group knows who started the trip.'; return; }
  if (!code) { err.textContent = 'Enter the access code from your download.'; return; }
  const btn = f.querySelector('button[type=submit]');
  btn.disabled = true;
  btn.textContent = 'Creating your trip…';
  err.textContent = '';
  try {
    SYNC.api = SYNC.api || await getBackend();
    const st = fd.from === 'sample' ? makeSeed() : makeBlank();
    st.trip.name = name;
    const g = addGuestTo(st, me);
    const id = newTripId();
    await SYNC.api.create(id, { code, edition: CITY.id, rev: 1, data: clone(st) });
    try { localStorage.setItem(ME_KEY + id, g.id); } catch (x) { /* ignore */ }
    history.replaceState(null, '', tripLink(id));
    ui.tab = 'home';
    startSync(id);
  } catch (x) {
    console.warn(x);
    btn.disabled = false;
    btn.textContent = 'Create my trip';
    err.textContent = /permission|denied/i.test(String(x && (x.code || x.message)))
      ? 'That access code didn’t work. Double-check it in your download.'
      : 'We couldn’t create your trip. Check your internet connection and try again.';
  }
}

(function boot() {
  let tab = location.hash.slice(1);
  if (!VIEWS[tab]) { try { tab = localStorage.getItem(TAB_KEY) || 'home'; } catch (e) { tab = 'home'; } }
  ui.tab = VIEWS[tab] ? tab : 'home';
  if (SYNC_ENABLED) {
    probeAssets().then(() => { if (ASSETS.size) render(); });
    const id = tripIdFromUrl();
    if (id) startSync(id); else showStart();
    return;
  }
  state = load();
  try { if (!localStorage.getItem(STORE_KEY)) flush(); } catch (e) { /* storage unavailable: app still works for this visit */ }
  render();
  probeAssets().then(() => { if (ASSETS.size) render(); });
})();
