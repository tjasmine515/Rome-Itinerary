'use strict';
/* ==========================================================================
   Booked & Busy — Rome edition
   One central `state` object → localStorage. Every tab reads guests from
   state.guests, so a name is typed once and used everywhere.
   ========================================================================== */

const STORE_KEY = 'bookedBusy:rome:v1';
const TAB_KEY = 'bookedBusy:rome:tab';
const BACKUP_KEY = 'bookedBusy:rome:lastBackup';
const WELCOME_KEY = 'bookedBusy:rome:welcomeDismissed';
const SCHEMA = 1;

const TABS = [
  { id: 'home', label: 'Home', short: 'Home', emoji: '🏛️' },
  { id: 'guests', label: 'Guest List', short: 'Guests', emoji: '💌' },
  { id: 'dashboard', label: 'Trip Dashboard', short: 'Today', emoji: '☀️' },
  { id: 'vote', label: 'Group Picks', short: 'Picks', emoji: '💘' },
  { id: 'itinerary', label: 'Itinerary', short: 'Plan', emoji: '🗓️' },
  { id: 'budget', label: 'Budget & Split', short: 'Budget', emoji: '💶' },
  { id: 'bookings', label: 'Booking Tracker', short: 'Bookings', emoji: '🎟️' },
  { id: 'packing', label: 'Packing List', short: 'Packing', emoji: '🧳' },
  { id: 'dream', label: 'Dream Board', short: 'Dream', emoji: '✨' },
  { id: 'memories', label: 'Memories', short: 'Memories', emoji: '📸' },
];
const BOTTOM_TABS = ['home', 'itinerary', 'vote', 'budget'];

const CATS = [
  { id: 'stay', label: 'Accommodation', emoji: '🛏️', color: '#4F2F26' },
  { id: 'food', label: 'Food & drink', emoji: '🍝', color: '#91602A' },
  { id: 'activities', label: 'Activities', emoji: '🎟️', color: '#82AC9D' },
  { id: 'transport', label: 'Transport', emoji: '🚆', color: '#C0785A' },
  { id: 'other', label: 'Other', emoji: '🛍️', color: '#D2B48C' },
];
const SETTLE_CAT = { id: 'settlement', label: 'Paid back', emoji: '💸', color: '#999' };

const PACK_CATS = [
  { id: 'clothing', label: 'Clothing', emoji: '👗' },
  { id: 'toiletries', label: 'Toiletries', emoji: '🧴' },
  { id: 'documents', label: 'Documents', emoji: '🛂' },
  { id: 'misc', label: 'Misc', emoji: '🔌' },
  { id: 'rome', label: 'Rome-specific', emoji: '🍋' },
];
const PACK_TEMPLATE = {
  clothing: ['Outfits for every day (+1 spare)', 'Rooftop dinner outfit', 'Light layer for evenings', 'Sunglasses'],
  toiletries: ['Travel-size SPF', 'Blister plasters', 'Meds + prescriptions', 'Hair tools (dual voltage!)'],
  documents: ['Passport (valid 3+ months after the trip)', 'Check entry rules for your passport (ETIAS/EES)', 'Travel insurance details', 'Offline copies of every booking'],
  misc: ['EU plug adapter (Type C / F / L)', 'Portable charger', 'Small cross-body bag that zips'],
  rome: ['Shoulders & knees coverage for the Vatican + churches', 'Comfortable shoes for cobblestones', 'Light scarf to cover up in churches', 'Refillable bottle for the nasoni fountains', 'Coins for the Trevi Fountain', 'A little cash (€) for cafés & tips'],
};

const DREAM_KINDS = [
  { id: 'see', label: 'Go see', emoji: '👀', bg: '#E5EFDF' },
  { id: 'eat', label: 'Eat & drink', emoji: '🍨', bg: '#F3E3CC' },
  { id: 'daytrip', label: 'Day trip', emoji: '🚆', bg: '#DCE8E3' },
  { id: 'shop', label: 'Shop', emoji: '🛍️', bg: '#EADBD2' },
  { id: 'night', label: 'Night out', emoji: '🍸', bg: '#E4DCE6' },
];

const GUEST_COLORS = ['#82AC9D', '#91602A', '#C0785A', '#B7828F', '#6F8F57', '#5F8C8C', '#C79A3C', '#7D5A6B', '#4F2F26', '#9A8A5A'];

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
function probeAssets() {
  const list = ['images/hero.jpg', ...TABS.map((t) => `icons/${t.id}.png`), 'icons/doodle-1.png', 'icons/doodle-2.png', 'icons/doodle-3.png'];
  return Promise.all(list.map((src) => new Promise((res) => {
    const i = new Image();
    i.onload = () => { ASSETS.add(src); res(); };
    i.onerror = () => res();
    i.src = src;
  })));
}
function icon(tabId, cls = '') {
  const t = TABS.find((x) => x.id === tabId);
  const src = `icons/${tabId}.png`;
  return ASSETS.has(src)
    ? `<span class="ico ${cls}"><img src="${src}" alt=""></span>`
    : `<span class="ico ${cls}" aria-hidden="true">${t ? t.emoji : ''}</span>`;
}
const doodle = (n, style = '') => (ASSETS.has(`icons/doodle-${n}.png`) ? `<img src="icons/doodle-${n}.png" alt="" style="position:absolute;pointer-events:none;${style}">` : '');

/* ==========================================================================
   Seed data — a realistic Rome group trip so the app looks alive on day one
   ========================================================================== */
function makeSeed() {
  const t = today();
  const start = addDays(t, 45);
  const end = addDays(start, 4);
  const D = (n) => isoOf(addDays(start, n));
  const g = ['Sofia Romano', 'Maya Chen', 'Jess Alvarez', 'Priya Nair', 'Lauren Brooks'].map((name, i) => ({ id: 'g' + (i + 1), name, color: GUEST_COLORS[i], diet: '', arrive: '', depart: '', confirmed: true }));
  g[0].diet = 'Vegetarian';
  g[1].diet = 'Tree-nut allergy (carries an EpiPen)';
  g[2].arrive = D(1);
  g[3].diet = 'No shellfish';
  g[4].confirmed = false;
  const V = (...ix) => ix.map((i) => g[i].id);

  const activities = [
    ['a1', '🏛️', 'Colosseum + Roman Forum underground tour', 'Arena floor and the hypogeum tunnels where gladiators waited.', V(0, 1, 2, 3, 4)],
    ['a2', '🎨', 'Vatican Museums & Sistine Chapel (timed entry)', 'First slot of the day, before the tour groups. Cover shoulders + knees.', V(0, 1, 3, 4)],
    ['a3', '🗿', 'Borghese Gallery', 'Bernini marble that looks like skin. Strict 2-hour timed slots.', V(1, 3)],
    ['a4', '🍝', 'Hands-on pasta & tiramisù class', 'Fettuccine, cacio e pepe, and a dessert we made ourselves.', V(0, 1, 2, 3, 4)],
    ['a5', '🍷', 'Trastevere evening food tour', 'Supplì, carbonara, and wine bars down ivy-covered lanes.', V(0, 2, 4)],
    ['a6', '🍹', 'Aperol-hour terrace crawl', 'Three terraces, three spritzes, golden hour.', V(0, 1, 2, 4)],
    ['a7', '🌋', 'Day trip to Pompeii', 'High-speed train to Naples, then the ruins. Long, unforgettable day.', V(1, 3)],
    ['a8', '⛲', "Day trip to Tivoli (Villa d'Este)", 'Renaissance fountain gardens about an hour outside the city.', V(3)],
    ['a9', '🪙', 'Trevi Fountain coin toss at sunrise', 'Same fountain, zero crowds — it is a different place at 7am.', V(0, 1, 2, 3)],
    ['a10', '🍋', "Campo de' Fiori market morning", 'Produce stalls, limoncello samples, and a caffè standing at the bar.', V(2, 4)],
    ['a11', '👠', 'Spanish Steps + Via Condotti shopping', 'Window-shop the big names, then gelato on the steps (no sitting!).', V(0, 2, 4)],
    ['a12', '🌅', 'Rooftop dinner with a Colosseum view', 'The group-photo dinner. Dress up.', V(0, 1, 2, 3, 4)],
    ['a13', '🚲', 'Bike the Appian Way', 'The ancient road south of the city: catacombs, aqueducts, umbrella pines.', V(1)],
  ].map(([id, emoji, title, note, votes]) => ({ id, emoji, title, note, votes, custom: false }));

  const bookings = [
    { id: 'b1', title: 'Vatican Museums & Sistine Chapel — timed entry', bookBy: D(-42), assignee: 'g2', booked: false, cost: 0, ref: '', food: false,
      tip: 'Tickets open about 60 days ahead on the official Vatican Museums site and the early slots go first in busy months. Book there, not through resellers — and pack shoulder & knee coverage.' },
    { id: 'b2', title: 'Colosseum underground + arena tour', bookBy: D(-35), assignee: 'g4', booked: false, cost: 0, ref: '', food: false,
      tip: 'Underground (hypogeum) and arena-floor tickets are capacity-limited and released in batches on the official Colosseum site, typically around a month ahead. Set a reminder — they can sell out within hours in peak season.' },
    { id: 'b6', title: 'Rome → Naples high-speed trains (Pompeii day)', bookBy: D(-38), assignee: 'g5', booked: false, cost: 0, ref: '', food: false,
      tip: 'Frecciarossa and Italo fares work like airfares: cheaper the earlier you book. From Naples, the Circumvesuviana local train runs to Pompei Scavi — buy Pompeii site tickets online to skip the queue.' },
    { id: 'b3', title: 'Borghese Gallery', bookBy: D(-21), assignee: 'g5', booked: false, cost: 0, ref: '', food: false,
      tip: 'Advance booking is required: entry is by timed 2-hour slot and capacity is limited. Weekend slots can sell out weeks ahead. Bags must be checked, so travel light.' },
    { id: 'b4', title: 'Rooftop dinner — Colosseum-view terrace', bookBy: D(-14), assignee: 'g3', booked: false, cost: 0, ref: '', food: true,
      tip: 'Terrace tables for groups of 5+ go first. Ask for the terrace specifically and expect a set menu or card deposit for larger groups. Book around sunset for the photos.' },
    { id: 'b5', title: 'Pasta & tiramisù cooking class', bookBy: D(-28), assignee: 'g2', booked: true, cost: 42500, ref: 'PASTA-5582', food: true,
      tip: 'Small-group classes often cap around 10–12 people, so a group of 5 can fill half a class. Book early and send dietary notes ahead of time.' },
  ];

  let n = 0;
  const I = (day, time, title, note, activityId = '', bookingId = '', cost = 0) => ({ id: 'i' + (++n), day, time, title, note, activityId, bookingId, cost });
  const itinerary = [
    I(0, '14:00', 'Check in — apartment in Monti', 'Keys from the café downstairs. 3 bedrooms, 2 baths, one very good balcony.'),
    I(0, '18:00', 'Aperol-hour terrace crawl', 'Start on the rooftop, end wherever the night takes us.', 'a6'),
    I(0, '20:30', 'Welcome dinner in Trastevere', 'Walk-in trattoria — early in the week you rarely need a reservation.'),
    I(1, '09:00', 'Colosseum + Roman Forum underground tour', 'Be at the meeting point 15 min early with ID matching the tickets.', 'a1', 'b2'),
    I(1, '13:30', 'Lunch + gelato in Monti', ''),
    I(1, '17:00', 'Pasta & tiramisù class', 'Bride gets the apron. 🤍', 'a4', 'b5'),
    I(2, '08:30', 'Vatican Museums & Sistine Chapel', 'Shoulders & knees covered! No photos in the Sistine Chapel.', 'a2', 'b1'),
    I(2, '14:00', 'Siesta (non-negotiable)', ''),
    I(2, '19:30', 'Rooftop dinner with a Colosseum view', 'Dress code: sparkle.', 'a12', 'b4'),
    I(3, '07:45', 'Train to Naples → Pompeii', 'From Roma Termini. Water + sunscreen — there is very little shade in the ruins.', 'a7', 'b6'),
    I(3, '19:30', 'Pizza night in', 'Feet up, face masks, group-chat photo dump.'),
    I(4, '09:30', "Campo de' Fiori market morning", 'Last cornetti + souvenir limoncello.', 'a10'),
    I(4, '12:00', 'Check out + airport transfer', 'Leonardo Express from Termini, or pre-book a van for 5 with bags.'),
  ];

  const expenses = [
    { id: 'e1', desc: 'Apartment in Monti (4 nights)', amount: 185000, category: 'stay', date: isoOf(addDays(t, -20)), paidBy: 'g2', mode: 'even', participants: V(0, 1, 2, 3, 4), custom: {} },
    { id: 'e2', desc: 'Pasta class deposit', amount: 42500, category: 'activities', date: isoOf(addDays(t, -9)), paidBy: 'g2', mode: 'even', participants: V(0, 1, 2, 3, 4), custom: {} },
    { id: 'e3', desc: 'Train tickets to Naples — bride rides free', amount: 23000, category: 'transport', date: isoOf(addDays(t, -6)), paidBy: 'g5', mode: 'percent', participants: V(1, 2, 3, 4), custom: { g2: 25, g3: 25, g4: 25, g5: 25 } },
    { id: 'e4', desc: 'Bachelorette sash, veil & props', amount: 4600, category: 'other', date: isoOf(addDays(t, -3)), paidBy: 'g4', mode: 'amount', participants: V(1, 2, 3, 4), custom: { g2: 1600, g3: 1000, g4: 1000, g5: 1000 } },
  ];

  const packing = [];
  const packedRate = [0.35, 0.8, 0.1, 0.55, 0];
  g.forEach((guest, gi) => {
    let k = 0;
    PACK_CATS.forEach((c) => PACK_TEMPLATE[c.id].forEach((text) => {
      packing.push({ id: uid(), guestId: guest.id, cat: c.id, text, done: ((k++ * 7) % 10) / 10 < packedRate[gi] });
    }));
  });

  const dream = [
    { id: 'd1', title: 'Aventine Keyhole', note: "Peek through the Knights of Malta keyhole — St. Peter's dome, perfectly framed.", kind: 'see', img: '', promoted: '', rot: -2 },
    { id: 'd2', title: 'Gelato showdown', note: 'Giolitti vs. Fatamorgana. A very scientific taste test.', kind: 'eat', img: '', promoted: '', rot: 1.5 },
    { id: 'd3', title: 'Orvieto day trip', note: 'Hilltop town, striped cathedral, a glass of the local white. ~1 hr by train.', kind: 'daytrip', img: '', promoted: '', rot: -1 },
    { id: 'd4', title: 'Vintage on Via del Governo Vecchio', note: 'Second-hand designer finds a few steps from Piazza Navona.', kind: 'shop', img: '', promoted: '', rot: 2 },
    { id: 'd5', title: 'Sunset at the Pincio Terrace', note: 'Free, golden, and right above Piazza del Popolo.', kind: 'see', img: '', promoted: '', rot: -2.5 },
    { id: 'd6', title: 'Late-night jazz in Trastevere', note: 'For the night nobody wants to go home.', kind: 'night', img: '', promoted: '', rot: 1 },
  ];

  const journal = [
    { id: 'j1', day: null, title: 'The night we booked it', img: '',
      text: 'Group chat hit 400 messages deciding between Monti and Trastevere. Maya made a spreadsheet. We ignored the spreadsheet. We picked the apartment with the balcony.',
      favorite: 'Sofia screaming "ROMA!!" in a voice note at 1am.' },
  ];

  return {
    schema: SCHEMA,
    trip: { name: "Roman Holiday", start: isoOf(start), end: isoOf(end), budget: 500000, currency: '€', heroImg: '' },
    guests: g, activities, itinerary, expenses, bookings, packing, dream, journal,
  };
}

/** Blank trip that keeps the Rome know-how (ideas, booking tips) but none of the sample people or money. */
function makeBlank() {
  const s = makeSeed();
  return {
    ...s,
    trip: { ...s.trip, name: 'Our Rome Trip', budget: 0, heroImg: '' },
    guests: [], itinerary: [], expenses: [], packing: [], journal: [],
    activities: s.activities.map((a) => ({ ...a, votes: [] })),
    bookings: s.bookings.map((b) => ({ ...b, assignee: '', booked: false, cost: 0, ref: '' })),
    dream: s.dream.map((d) => ({ ...d, promoted: '' })),
  };
}

/** Fill in anything missing without touching well-formed data (keeps backups round-tripping exactly). */
function normalize(d) {
  const blank = { schema: SCHEMA, trip: { name: 'Our Rome Trip', start: '', end: '', budget: 0, currency: '€', heroImg: '' },
    guests: [], activities: [], itinerary: [], expenses: [], bookings: [], packing: [], dream: [], journal: [] };
  const out = { ...blank, ...d, trip: { ...blank.trip, ...(d.trip || {}) } };
  for (const k of ['guests', 'activities', 'itinerary', 'expenses', 'bookings', 'packing', 'dream', 'journal']) if (!Array.isArray(out[k])) out[k] = [];
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
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(flush, 250); }
function flush() {
  clearTimeout(saveTimer);
  saveTimer = null;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    lastSaved = Date.now();
    const s = $('#saveState');
    if (s) { s.textContent = 'Saved ✓'; s.classList.remove('flash'); void s.offsetWidth; s.classList.add('flash'); }
  } catch (e) {
    toast("This browser's storage is full — try a smaller photo, or save a backup and remove a few photos.");
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

function renderShell() {
  const urgent = state.bookings.filter((b) => urgency(b).level === 'red').length;
  const navBtn = (t) => `<li><button type="button" data-action="go" data-tab="${t.id}" ${ui.tab === t.id ? 'aria-current="page"' : ''}>${icon(t.id)}<span>${t.label}</span>${t.id === 'bookings' && urgent ? `<span class="badge" title="${urgent} urgent">${urgent}</span>` : ''}</button></li>`;
  patch($('#sidebar'), `
    <div class="side-brand">
      <div class="wordmark">Booked <i>&amp;</i> Busy</div>
      <span class="edition-chip">Roma</span>
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
    <div class="brandmark"><b>Booked <i>&amp;</i> Busy</b></div>
    <span class="edition-chip only-mobile">Roma</span>
    <span class="title-sm only-desktop">${esc(state.trip.name)} · ${esc(t.label)}</span>
    <span class="spacer"></span>
    <span class="faint" id="saveState" style="font-size:12px;font-weight:600">${lastSaved ? 'Saved ✓' : ''}</span>
    <button type="button" class="icon-btn only-mobile" data-action="exportData" aria-label="Save a backup" title="Save a backup">${svgIcon('download')}</button>`);
}

function svgIcon(name) {
  const p = {
    download: '<path d="M12 3v12m0 0-4.5-4.5M12 15l4.5-4.5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
    upload: '<path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
    trash: '<path d="M4 7h16M10 11v6m4-6v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  }[name];
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}

function backupCard() {
  let last = null;
  try { last = localStorage.getItem(BACKUP_KEY); } catch (e) { /* ignore */ }
  const used = (() => { try { return Math.round((JSON.stringify(state).length * 2) / (5 * 1024 * 1024) * 100); } catch (e) { return 0; } })();
  return `<div class="backup-card">
    <h4>Keep your trip safe</h4>
    <p>Everything saves to this browser automatically. Save a backup file to move the plan to another phone, share it with the group, or keep it forever.</p>
    <div class="btns">
      <button type="button" class="btn small dark" data-action="exportData">${svgIcon('download')} Save a backup</button>
      <button type="button" class="btn small" data-action="importData">${svgIcon('upload')} Load a backup</button>
      <button type="button" class="linkish" style="font-size:12.5px;margin-top:4px;align-self:center" data-action="resetMenu">Start over…</button>
    </div>
    <div class="storage">${last ? `Last backup: ${fmtDate(new Date(last))}` : 'No backup saved yet'} · ~${Math.max(1, used)}% of browser storage used</div>
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
const noGuests = (what) => emptyState('💌', 'first things first', 'Add your crew', `Once your travelers are on the Guest List, ${what}.`, '<button type="button" class="btn primary" data-action="go" data-tab="guests">Go to Guest List</button>');
const check = (attrs, on, label = '') => `<span class="check"><input type="checkbox" ${attrs} ${on ? 'checked' : ''} ${label ? `aria-label="${esc(label)}"` : ''}><span class="box"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg></span></span>`;

/* ==========================================================================
   HOME
   ========================================================================== */
function heroArt() {
  const arches = [];
  const rows = [[62, 34, 0, 250], [108, 34, 0, 330], [152, 36, 0, 360]];
  rows.forEach(([y, h, x0, x1]) => {
    for (let x = x0 + 12; x + 22 <= x1 - 8; x += 34) arches.push(`M${x} ${y + h}v-${h * 0.55}a11 11 0 0 1 22 0v${h * 0.55}z`);
  });
  return `<svg viewBox="0 0 800 420" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs>
      <linearGradient id="hsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#82AC9D"/><stop offset=".55" stop-color="#E5EFDF"/><stop offset="1" stop-color="#F4D9AE"/></linearGradient>
    </defs>
    <rect width="800" height="420" fill="url(#hsky)"/>
    <circle cx="590" cy="200" r="96" fill="#F3C07E" opacity=".85"/>
    <circle cx="590" cy="200" r="130" fill="#F3C07E" opacity=".18"/>
    <g fill="#82AC9D" opacity=".75">
      <path d="M60 330h170v-40h-14a71 71 0 0 0-142 0H60z"/><rect x="138" y="196" width="14" height="24" rx="3"/><circle cx="145" cy="190" r="5"/>
      <path d="M0 330v-22h30v-18h26v40zM236 330v-28h38v-14h30v42z"/>
    </g>
    <path fill="#C99B6B" opacity=".55" d="M0 350v-30h52v-12h40v18h36v-26h44v22h60v-16h40v44z"/>
    <g transform="translate(400 190)">
      <path fill="#91602A" d="M0 200V44Q120 8 250 14l6 46 40 8 20 12 44 6v114z"/>
      <path fill="#7E5223" d="M0 200V56Q120 26 250 30v8Q120 36 0 66z" opacity=".6"/>
      <path fill="#F1DDBC" d="${arches.join('')}"/>
      <path fill="#6D4719" d="M0 102h330M0 146h360" stroke="#6D4719" stroke-width="4"/>
    </g>
    <g fill="#4F2F26">
      <path d="M104 420c3-60 6-104 14-150l6 1c-6 46-9 90-10 149z"/>
      <ellipse cx="120" cy="262" rx="74" ry="20"/><ellipse cx="92" cy="250" rx="42" ry="14"/><ellipse cx="150" cy="248" rx="46" ry="15"/>
      <path d="M730 420c-2-54-6-92-16-128l6-2c10 36 14 76 16 130z"/>
      <ellipse cx="716" cy="284" rx="62" ry="17"/><ellipse cx="740" cy="272" rx="40" ry="13"/>
      <rect y="396" width="800" height="24"/>
    </g>
  </svg>`;
}

function countdownStamp() {
  const p = tripPhase();
  const days = tripDays();
  let big = '?', lbl = 'set your dates';
  if (p.phase === 'before') { big = p.until; lbl = p.until === 1 ? 'day until Rome' : 'days until Rome'; }
  else if (p.phase === 'during') { big = p.index + 1; lbl = `day ${p.index + 1} of ${days.length} · in Rome`; }
  else if (p.phase === 'after') { big = '✓'; lbl = 'Roma, collected'; }
  const start = days[0] ? days[0].date : null;
  return `<div class="stamp-wrap" aria-label="${esc(`${big} ${lbl}`)}">
    <div class="stamp"><div class="stamp-inner"><div class="roma">Roma</div><div class="big num">${big}</div><div class="lbl">${lbl}</div></div></div>
    <div class="postmark" aria-hidden="true"><span>Roma<br>${start ? esc(start.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })) : '— —'}<br>B&amp;B</span>
      <svg class="wave" viewBox="0 0 70 30" fill="none" stroke="rgba(79,47,38,.5)" stroke-width="2"><path d="M0 5q9-6 17 0t17 0 17 0 19 0M0 15q9-6 17 0t17 0 17 0 19 0M0 25q9-6 17 0t17 0 17 0 19 0"/></svg>
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
  try { welcome = !localStorage.getItem(WELCOME_KEY); } catch (e) { /* ignore */ }
  const heroSrc = tr.heroImg || (ASSETS.has('images/hero.jpg') ? 'images/hero.jpg' : '');
  const remaining = tr.budget - spent;
  const unscheduled = state.activities.filter((a) => !isScheduled(a.id)).length;
  const voters = state.guests.filter((g) => state.activities.some((a) => a.votes.includes(g.id))).length;
  const daysLabel = p.phase === 'before' ? p.until : p.phase === 'during' ? `Day ${p.index + 1}` : p.phase === 'after' ? '✓' : '—';

  return `
  <div class="hero">
    <div class="hero-photo">
      ${heroSrc ? `<img src="${esc(heroSrc)}" alt="Trip cover photo">` : `<div class="hero-art">${heroArt()}</div>`}
      <div class="hero-tools">
        <button type="button" class="btn small" data-action="heroPhoto">${svgIcon('camera')} ${tr.heroImg ? 'Change' : 'Add'} cover photo</button>
        ${tr.heroImg ? `<button type="button" class="btn small" data-action="heroPhotoRemove" aria-label="Remove cover photo">${svgIcon('x')}</button>` : ''}
      </div>
      ${countdownStamp()}
      <div class="hero-inner">
        <div class="hero-card">
          ${doodle(1, 'right:-18px;top:-30px;width:70px;transform:rotate(10deg)')}
          <div class="kicker">Booked &amp; Busy · Roma edition</div>
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
      <div style="flex:1">
        <span class="hand" style="font-size:21px;color:var(--ochre)">Ciao! Start here →</span>
        <p style="margin-top:4px">This is a sample trip so you can see how everything works. Rename it above, set your dates, add your crew on the Guest List, and edit or delete anything. Want a clean slate? <button type="button" class="linkish" data-action="resetMenu">Start with a blank trip</button>.</p>
      </div>
      <button type="button" class="icon-btn" data-action="dismissWelcome" aria-label="Dismiss">${svgIcon('x')}</button>
    </div>
  </div>` : ''}

  <div class="stats">
    <button type="button" class="card lift stat" data-action="go" data-tab="budget">
      <span class="kicker">Budget</span>${icon('budget')}
      <span class="v num">${money(spent)} <small>of ${money(tr.budget)}</small></span>
      ${bar(pct(spent, tr.budget), `ochre ${spent > tr.budget && tr.budget ? 'over' : ''}`)}
      <span class="s">${tr.budget ? (remaining >= 0 ? `${money(remaining)} left to play with` : `${money(-remaining)} over budget`) : 'Set a total budget →'}</span>
    </button>
    <button type="button" class="card lift stat" data-action="go" data-tab="packing">
      <span class="kicker">Packing</span>${icon('packing')}
      <span class="v num">${ps.pct}<small>% packed</small></span>
      ${bar(ps.pct)}
      <span class="s">${ps.total ? `${ps.done} of ${ps.total} items across the group` : 'No packing lists yet'}</span>
    </button>
    <button type="button" class="card lift stat" data-action="go" data-tab="itinerary">
      <span class="kicker">${p.phase === 'during' ? 'In Rome' : p.phase === 'after' ? 'Trip' : 'Countdown'}</span>${icon('itinerary')}
      <span class="v num">${daysLabel} <small>${p.phase === 'before' ? (p.until === 1 ? 'day to go' : 'days to go') : p.phase === 'during' ? `of ${days.length}` : p.phase === 'after' ? 'complete' : 'no dates yet'}</small></span>
      <span class="s">${days.length ? `${fmtDay(days[0].date)} → ${fmtDay(days[days.length - 1].date)}` : 'Add dates in the card above'}</span>
    </button>
    <button type="button" class="card lift stat" data-action="go" data-tab="guests">
      <span class="kicker">Crew</span>${icon('guests')}
      <span class="v num">${confirmed}<small> of ${state.guests.length} confirmed</small></span>
      <span class="avatars">${state.guests.slice(0, 8).map((g) => avatar(g, 'sm')).join('')}</span>
      <span class="s">${state.guests.length - confirmed ? `${pl(state.guests.length - confirmed, 'person')} still deciding` : state.guests.length ? 'Everyone’s in 🎉' : 'Add your travelers'}</span>
    </button>
  </div>

  <div class="section">
    <h2 class="section-title">Jump back in</h2>
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
    todayCard = emptyState('🗓️', 'no dates yet', 'When are we going?', 'Add your trip dates on the Home page and this card turns into a live “today in Rome” agenda.', '<button type="button" class="btn primary" data-action="go" data-tab="home">Set trip dates</button>');
  } else if (p.phase === 'before') {
    const first = itemsForDay(0);
    todayCard = `<div class="card washi today-card">
      <div class="kicker">Today · ${esc(fmtLong(today()))}</div>
      <h3 style="font-size:26px;margin:6px 0 4px">The trip hasn’t started yet</h3>
      <p class="muted">${p.until === 1 ? 'Tomorrow is the day.' : `${p.until} days until wheels-down in Rome.`} Here’s how Day 1 looks so far:</p>
      <div style="margin-top:12px"><div class="dayname">Day 1 · ${esc(fmtDay(days[0].date))}</div>
      ${first.length ? agendaList(first) : '<p class="faint" style="padding:10px 0">Nothing planned for Day 1 yet.</p>'}</div>
      <button type="button" class="btn small" data-action="go" data-tab="itinerary" style="margin-top:8px">See the full itinerary →</button>
    </div>`;
  } else if (p.phase === 'during') {
    const its = itemsForDay(p.index);
    todayCard = `<div class="card washi ochre-tape today-card" style="border:2px solid var(--ochre)">
      <div class="kicker">Today · Day ${p.index + 1} of ${days.length}</div>
      <h3 style="font-size:26px;margin:6px 0 10px">${esc(fmtLong(days[p.index].date))}</h3>
      ${its.length ? agendaList(its, true) : '<p class="faint" style="padding:10px 0">Nothing on the plan today — dolce far niente. 🍋</p>'}
      <div class="row wrap" style="margin-top:10px">
        <button type="button" class="btn small" data-action="go" data-tab="itinerary">Full itinerary</button>
        <button type="button" class="btn small" data-action="writeDay" data-day="${p.index}">Write today’s memory</button>
      </div>
    </div>`;
  } else {
    todayCard = `<div class="card espresso today-card">
      <div class="kicker">After the trip</div>
      <h3 style="font-size:28px;margin:8px 0 6px">That’s a wrap — Roma, collected.</h3>
      <p style="opacity:.8;margin-bottom:14px">Relive it while it’s fresh: add photos, favorite moments and the stories you’ll retell for years.</p>
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

  return viewHead('dashboard', `What’s <em>happening</em>`, 'Your daily driver: today’s plan, what’s still open, and where the money’s at.') + `
  <div class="grid cols-2">
    <div class="span-2">${todayCard}</div>
    <div class="card">
      <div class="card-head"><h3>What’s left to do</h3></div>
      <ul class="todo-list">
        ${row(unbooked.length, unbooked.length === 1 ? 'booking still to make' : 'bookings still to make', urgentN ? `${urgentN} urgent — book these first` : unbooked.length ? 'Nothing urgent yet' : 'All booked!', 'bookings')}
        ${row(ps.total - ps.done, 'items left to pack', `${ps.pct}% packed across the group`, 'packing')}
        ${row(favs.length, favs.length === 1 ? 'crowd favorite not scheduled' : 'crowd favorites not scheduled', tie.length ? `Tie: ${tie.slice(0, 3).map((r) => esc(r.a.title.split(/[—(+&]/)[0].trim())).join(' vs. ')} (${pl(tie[0].n, 'vote')} each)` : nonVoters.length ? `${pl(nonVoters.length, 'person hasn’t', 'people haven’t')} voted yet` : 'Everyone has voted', 'vote')}
        ${row(settle.length, settle.length === 1 ? 'payment to settle up' : 'payments to settle up', settle.length ? `Largest: ${money(Math.max(...settle.map((s) => s.amount)))}` : 'Everyone’s square', 'budget')}
        ${row(pending.length, pending.length === 1 ? 'guest still deciding' : 'guests still deciding', pending.length ? pending.map((g) => esc(firstName(g.name))).join(', ') : 'Whole crew confirmed', 'guests')}
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
        ${next.length ? next.map((x) => { const u = urgency(x); return `<button type="button" class="settle" style="width:100%;border:0;background:none;text-align:left;font:inherit;color:inherit" data-action="go" data-tab="bookings"><span class="dot ${u.level}"></span><span style="flex:1;min-width:0"><b style="display:block;font-weight:600">${esc(x.title)}</b><small class="muted">Book by ${esc(fmtDate(parseISO(x.bookBy))) || '—'} · ${esc(u.label)}</small></span></button>`; }).join('') : '<p class="muted">Nothing left to book. Look at you. ✨</p>'}
      </div>
    </div>
    <div class="span-2 only-mobile">${backupCard()}</div>
  </div>`;
}

/* ==========================================================================
   GUEST LIST
   ========================================================================== */
function viewGuests() {
  const gs = state.guests;
  const confirmed = gs.filter((g) => g.confirmed).length;
  const diets = dietNotes().length;
  const tr = state.trip;
  return viewHead('guests', `The <em>crew</em>`, 'Add everyone once — their names flow into voting, packing, bookings and the money math automatically.') + `
  <form class="card row" data-form="addGuest" style="margin-bottom:14px;gap:8px">
    <label class="sr-only" for="newGuest">Traveler name</label>
    <input class="input" id="newGuest" name="name" placeholder="Add a traveler — e.g. Bianca" autocomplete="off" maxlength="60" style="flex:1">
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
  }).join('')}</div>` : emptyState('💌', 'it takes a village', 'Who’s coming to Rome?', 'Add your first traveler above. Names you add here show up everywhere — no re-typing, ever.')}`;
}

/* ==========================================================================
   GROUP PICKS
   ========================================================================== */
function viewVote() {
  const gs = state.guests;
  if (!gs.length) return viewHead('vote', `Group <em>picks</em>`, '') + noGuests('everyone can vote on what the group actually wants to do');
  const voter = guest(ui.voteAs);
  const ranked = rankedActivities();
  const top = ranked.length ? ranked[0].n : 0;
  return viewHead('vote', `Group <em>picks</em>`, 'Tap in on everything you’d actually get up early for. The list re-sorts itself so the group’s favorites float to the top.',
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
          ${r.n && r.n === top ? '<span class="crown">♛ group fave</span>' : ''}
          ${tied ? '<span class="chip amber">Tied for top</span>' : ''}
          ${sched ? '<span class="chip mint">✓ On the itinerary</span>' : ''}
          ${a.custom ? '<span class="chip outline">Suggested</span>' : ''}
        </div>
        ${voter
          ? `<div class="row wrap"><button type="button" class="btn ${mine ? 'sage' : ''} small" aria-pressed="${!!mine}" data-action="vote" data-id="${a.id}" data-g="${voter.id}">${mine ? '💘 I’m in' : '♡ I’m in'}</button><span class="avatars">${votes.map((id) => avatar(guest(id), 'sm')).join('')}</span></div>`
          : `<div class="gchips">${gs.map((g) => gchip(g, votes.includes(g.id), `data-action="vote" data-id="${a.id}" data-g="${g.id}"`)).join('')}</div>`}
      </div>
    </div>`;
  }).join('') || emptyState('💘', 'blank slate', 'No ideas yet', 'Suggest the first thing you’d love to do in Rome.', '<button type="button" class="btn primary" data-action="addActivity">Suggest an idea</button>')}</div>`;
}

/* ==========================================================================
   ITINERARY
   ========================================================================== */
function slotHTML(it) {
  const b = state.bookings.find((x) => x.id === it.bookingId);
  const a = state.activities.find((x) => x.id === it.activityId);
  const u = b ? urgency(b) : null;
  const cost = it.cost || (b && b.cost) || 0;
  return `<button type="button" class="slot" data-key="it-${it.id}" data-action="editItem" data-id="${it.id}">
    <span class="time ${it.time ? '' : 'none'}">${it.time ? fmtTime(it.time) : 'Anytime'}</span>
    <span style="min-width:0">
      <span class="ti">${esc(it.title)}</span>
      ${it.note ? `<span class="no" style="display:block">${esc(it.note)}</span>` : ''}
      ${b || a ? `<span class="meta">
        ${b ? `<span class="chip ${u.level === 'done' ? 'green' : u.level}"><span class="dot ${u.level}"></span>${u.level === 'done' ? 'Booked' : `Book by ${esc(fmtDate(parseISO(b.bookBy)))}`}</span>` : ''}
        ${a ? `<span class="chip">💘 ${validVotes(a).length} of ${state.guests.length}</span>` : ''}
      </span>` : ''}
    </span>
    <span class="cost">${cost ? money(cost) : ''}</span>
  </button>`;
}

function viewItinerary() {
  const days = tripDays();
  const actions = `<button type="button" class="btn primary" data-action="winners">✨ Add from Group Picks</button><button type="button" class="btn" data-action="addItem" data-day="0">${svgIcon('plus')} Add plan</button>`;
  if (!days.length) return viewHead('itinerary', `Day by <em>day</em>`, '') + emptyState('🗓️', 'first, the dates', 'When is Rome happening?', 'Set your trip dates on the Home page and your day-by-day agenda appears here.', '<button type="button" class="btn primary" data-action="go" data-tab="home">Set trip dates</button>');
  const p = tripPhase();
  const out = state.itinerary.filter((i) => i.day >= days.length || i.day < 0);
  return viewHead('itinerary', `Day by <em>day</em>`, 'Tap any plan to edit it. Linked bookings show their deadline so nothing slips.', actions) + `
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
      ${its.length ? its.map(slotHTML).join('') : `<div class="day-empty"><span class="hand">wide open</span> — perfect for a long lunch, or add something below.</div>`}
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
  const head = viewHead('budget', `Money, <em>minus the drama</em>`, 'Track the big number, see everyone’s fair share, and let the math decide who owes who.',
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

  <div class="card section">
    <div class="card-head"><h3>Everyone’s fair share</h3></div>
    <p class="muted" style="font-size:13.5px;margin-bottom:10px">Split evenly, each of the ${pl(gs.length, 'traveler')} owes about <b>${money(evenSpent)}</b> of what’s been spent so far${tr.budget ? `, and <b>${money(perHead)}</b> of the full budget` : ''}. The table uses each expense’s real split — so the bride riding free is handled.</p>
    <div class="table-wrap"><table class="ledger">
      <thead><tr><th>Traveler</th><th class="r">Their share</th><th class="r">Paid</th><th class="r">Balance</th></tr></thead>
      <tbody>${gs.map((g) => { const b = bal[g.id] || 0; return `<tr data-key="pp-${g.id}"><td><span class="person-cell">${avatar(g, 'sm')}${esc(g.name)}</span></td><td class="r">${money(shareOf[g.id])}</td><td class="r">${money(paidOf[g.id])}</td><td class="r ${b > 0 ? 'pos' : b < 0 ? 'neg' : ''}">${b > 0 ? `gets ${money(b)}` : b < 0 ? `owes ${money(-b)}` : 'square'}</td></tr>`; }).join('')}</tbody>
    </table></div>
    <button type="button" class="btn small" style="margin-top:12px" data-action="budgetView" data-v="split">See who pays who →</button>
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
        : `<div style="text-align:center;padding:18px 0"><div style="font-size:34px">🥂</div><h3 style="margin:6px 0 4px">Everyone’s square</h3><p class="muted" style="font-size:13.5px">No one owes anyone. Friendship intact.</p></div>`}
    </div>
    <div class="card">
      <div class="card-head"><h3>Expenses</h3><button type="button" class="btn small" data-action="addExpense">${svgIcon('plus')} Log one</button></div>
      ${exps.length ? exps.map((e) => { const c = catOf(e.category); return `<button type="button" class="expense" data-key="ex-${e.id}" data-action="editExpense" data-id="${e.id}">
        <span class="cat-ico" style="background:${c.color}22">${c.emoji}</span>
        <span style="min-width:0"><span class="ti" style="display:block">${esc(e.desc || c.label)}</span><span class="sub">${splitLabel(e)}</span></span>
        <span class="amt">${money(e.amount)}<small>${esc(fmtDate(parseISO(e.date)))}</small></span>
      </button>`; }).join('') : emptyState('🧾', 'clean ledger', 'No expenses yet', 'Log the apartment, the train tickets, that round of spritzes — then let the settle-up do the math.')}
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
  return viewHead('bookings', `Book it <em>before</em> it’s gone`, 'Rome’s best things sell out. Colors update on their own from today’s date — red is due within 3 days (or overdue), amber within two weeks, green means you’ve got time.',
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
  if (!gs.length) return viewHead('packing', `Pack <em>smart</em>`, '') + noGuests('everyone gets their own packing checklist');
  if (!guest(ui.packGuest)) ui.packGuest = gs[0].id;
  const me = guest(ui.packGuest);
  const all = packStats();
  const mine = packStats(me.id);
  return viewHead('packing', `Pack <em>smart</em>, not heavy`, 'Everyone gets their own checklist. Tap your name, tick things off, watch the group bar fill up.') + `
  <div class="card mint" style="margin-bottom:14px">
    <div class="row between" style="margin-bottom:8px"><b style="font:600 19px var(--f-display)">The group is ${all.pct}% packed</b><span class="muted num" style="font-weight:600;font-size:13px">${all.done}/${all.total}</span></div>
    ${bar(all.pct, 'fat')}
  </div>
  <div class="pack-people" role="group" aria-label="Choose traveler">${gs.map((g) => { const s = packStats(g.id); return `<button type="button" class="pack-person" aria-pressed="${g.id === me.id}" data-action="packGuest" data-g="${g.id}" data-key="pp-${g.id}">
    ${avatar(g, 'sm')}<span class="nm">${esc(firstName(g.name))}</span>${bar(s.pct, 'thin')}<span class="pc">${s.pct === 100 && s.total ? 'All packed 🎉' : `${s.done}/${s.total} packed`}</span></button>`; }).join('')}</div>
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
    return `<section class="card pack-cat ${c.id === 'rome' ? 'rome washi' : ''}" data-key="pc-${c.id}">
      <div class="card-head"><span class="ico" aria-hidden="true">${c.emoji}</span><h3>${c.label}</h3><span class="chip ${done === items.length && items.length ? 'mint' : ''}">${done}/${items.length}</span></div>
      ${c.id === 'rome' ? '<p class="hand" style="color:var(--ochre);font-size:18px;margin:-6px 0 6px">Rome dress codes are real — the Vatican will turn you away.</p>' : ''}
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
  return viewHead('dream', `The <em>maybe</em> pile`, 'Collect places, tables and day trips the group hasn’t committed to yet. Promote the keepers to the itinerary or put them to a vote.',
    `<button type="button" class="btn primary" data-action="addDream">${svgIcon('plus')} Pin an idea</button>`) +
  (state.dream.length ? `<div class="board" style="position:relative">${doodle(2, 'right:0;top:-40px;width:80px')}${state.dream.map((d) => {
    const k = DREAM_KINDS.find((x) => x.id === d.kind) || DREAM_KINDS[0];
    return `<article class="polaroid" style="--rot:${d.rot || 0}deg" data-key="dr-${d.id}">
      <div class="pic" style="background:${k.bg}">${d.img ? `<img src="${esc(d.img)}" alt="">` : `<span aria-hidden="true">${k.emoji}</span>`}
        ${d.promoted ? `<span class="stamped">${d.promoted === 'plan' ? 'On the plan' : 'Up for a vote'}</span>` : ''}</div>
      <h3>${esc(d.title)}</h3>
      <div class="kind-tag">${k.label}</div>
      ${d.note ? `<p style="margin-top:4px">${esc(d.note)}</p>` : ''}
      <div class="acts">
        <button type="button" class="btn small" data-action="dreamToPlan" data-id="${d.id}">→ Itinerary</button>
        <button type="button" class="btn small ghost" data-action="dreamToVote" data-id="${d.id}">→ Vote</button>
        <button type="button" class="icon-btn" style="width:34px;height:34px;margin-left:auto" data-action="editDream" data-id="${d.id}" aria-label="Edit ${esc(d.title)}">${svgIcon('edit')}</button>
      </div>
    </article>`;
  }).join('')}</div>` : emptyState('✨', 'start collecting', 'Your board is empty', 'Saw a gelato place on TikTok? A day trip someone mentioned? Pin it here before it disappears into the group chat.', '<button type="button" class="btn primary" data-action="addDream">Pin the first idea</button>'));
}

/* ==========================================================================
   MEMORIES
   ========================================================================== */
function entryHTML(e, whenLabel) {
  return `<article class="card entry washi mint-tape" data-key="je-${e.id}">
    <div class="entry-photo">
      ${e.img ? `<img src="${esc(e.img)}" alt="">
        <button type="button" class="icon-btn rm" data-action="entryPhotoRemove" data-id="${e.id}" aria-label="Remove photo">${svgIcon('x')}</button>`
        : `<div class="ph"><span>📷</span>Add a photo</div><button type="button" class="ph-btn" data-action="entryPhoto" data-id="${e.id}" aria-label="Add a photo"></button>`}
    </div>
    <div style="min-width:0">
      <div class="row" style="align-items:flex-start">
        <div style="flex:1;min-width:0">
          <div class="when">${whenLabel}</div>
          <label class="sr-only" for="jt-${e.id}">Title</label>
          <input id="jt-${e.id}" class="input bare" style="font:600 23px/1.2 var(--f-display);min-height:40px" data-bind="journal:${e.id}:title" value="${esc(e.title)}" placeholder="Give this page a title" maxlength="90">
        </div>
        <button type="button" class="icon-btn danger" data-action="removeEntry" data-id="${e.id}" aria-label="Delete page">${svgIcon('trash')}</button>
      </div>
      <label class="sr-only" for="jx-${e.id}">What happened</label>
      <textarea id="jx-${e.id}" class="textarea lined" rows="5" data-bind="journal:${e.id}:text" placeholder="What happened? Who said what? What did it smell like?">${esc(e.text)}</textarea>
      <div class="fav"><span class="lbl">♥ favorite moment</span>
        <label class="sr-only" for="jf-${e.id}">Favorite moment</label>
        <input id="jf-${e.id}" class="input" data-bind="journal:${e.id}:favorite" value="${esc(e.favorite)}" placeholder="The one you’ll still be telling in ten years" maxlength="200"></div>
    </div>
  </article>`;
}
function viewMemories() {
  const days = tripDays();
  const p = tripPhase();
  const loose = state.journal.filter((e) => e.day == null || e.day >= days.length || e.day < 0);
  return viewHead('memories', `Travel <em>journal</em>`, 'The part you keep. Write a little each day — a line, a photo, the moment you want to remember — and reopen this file whenever you miss Rome.',
    `<button type="button" class="btn" data-action="addPage">${svgIcon('plus')} Add a loose page</button>`) + `
  ${p.phase === 'before' ? `<div class="card ochre" style="margin-bottom:18px"><span class="hand" style="font-size:21px;color:var(--ochre)">psst —</span> the day-by-day pages fill in during the trip, but there’s no rule against pre-trip pages. Hype is a memory too.</div>` : ''}
  <div class="journal">
    ${days.map((d) => {
      const e = state.journal.find((x) => x.day === d.i);
      const label = `Day ${d.i + 1} · ${esc(fmtDay(d.date))}`;
      if (e) return entryHTML(e, label);
      const future = p.phase === 'before' || (p.phase === 'during' && d.i > p.index);
      return `<button type="button" class="card lift" style="text-align:left;display:flex;align-items:center;gap:14px;font:inherit;color:inherit;${future ? 'opacity:.72' : ''}" data-key="jd-${d.i}" data-action="writeDay" data-day="${d.i}">
        <span class="vote-rank num" style="background:var(--mint);color:var(--sage-deep)">${d.i + 1}</span>
        <span style="flex:1"><b style="font:600 18px var(--f-display);display:block">${label}</b><span class="muted" style="font-size:13.5px">${future ? 'Not yet — but soon.' : 'Nothing written yet. Tap to start this page.'}</span></span>
        <span class="chev" style="color:var(--ochre)">✎</span>
      </button>`;
    }).join('')}
    ${loose.length ? `<h2 class="section-title" style="margin-top:10px">Loose pages <span class="count">${loose.length}</span></h2>${loose.map((e) => entryHTML(e, e.day != null ? 'From an old trip day' : 'Loose page')).join('')}` : ''}
    ${!days.length && !loose.length ? emptyState('📸', 'blank pages', 'Your journal is waiting', 'Set trip dates to get a page per day, or add a loose page any time.') : ''}
  </div>`;
}

/* ==========================================================================
   Render
   ========================================================================== */
const VIEWS = { home: viewHome, guests: viewGuests, dashboard: viewDashboard, vote: viewVote, itinerary: viewItinerary, budget: viewBudget, bookings: viewBookings, packing: viewPacking, dream: viewDream, memories: viewMemories };

let rendering = false;
function render() {
  // A blur-triggered `change` can fire while morph removes a focused input; defer instead of nesting.
  if (rendering) { queueMicrotask(render); return; }
  rendering = true;
  try { renderNow(); } finally { rendering = false; }
}
function renderNow() {
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
      <label class="field full"><span>What’s the plan?</span><input class="input" data-d="title" value="${esc(x.title)}" placeholder="e.g. Aperitivo at a rooftop bar" maxlength="100" autofocus></label>
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
      toast(it ? 'Plan updated' : `Added to Day ${rec.day + 1}`);
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
      <label class="field full"><span>Idea</span><input class="input" data-d="title" value="${esc(x.title)}" placeholder="e.g. Vespa tour at night" maxlength="90" autofocus></label>
      <label class="field full"><span>Why we should</span><input class="input" data-d="note" value="${esc(x.note)}" placeholder="One line to convince the group" maxlength="140"></label>
    </div>`,
    onSubmit: (x) => { state.activities.push({ id: uid(), emoji: x.emoji.trim(), title: x.title.trim(), note: x.note.trim(), votes: [], custom: true }); commit(); toast('Idea added — let the voting begin'); },
  });
}

/* ---- expense ---- */
function expenseSheet(e) {
  const gs = state.guests;
  const d = e ? {
    desc: e.desc, amount: moneyStr(e.amount), category: e.category === 'settlement' ? 'settlement' : e.category, date: e.date, paidBy: e.paidBy, mode: e.mode,
    participants: [...e.participants], custom: Object.fromEntries(Object.entries(e.custom || {}).map(([k, v]) => [k, e.mode === 'amount' ? moneyStr(v) : String(v)])),
  } : { desc: '', amount: '', category: 'food', date: isoOf(today()), paidBy: gs[0].id, mode: 'even', participants: gs.map((g) => g.id), custom: {} };
  const check = (x) => {
    const amt = parseMoney(x.amount);
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
        <label class="field full"><span>What was it?</span><input class="input" data-d="desc" value="${esc(x.desc)}" placeholder="e.g. Dinner at Da Enzo" maxlength="90" autofocus></label>
        <label class="field"><span>Amount</span><span class="money-input"><span class="cur">${esc(cur())}</span><input class="input" inputmode="decimal" data-d="amount" value="${esc(x.amount)}" placeholder="0.00"></span></label>
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
      const rec = { id: e ? e.id : uid(), desc: x.desc.trim(), amount: parseMoney(x.amount), category: x.category, date: x.date, paidBy: x.paidBy, mode: x.mode, participants: ps, custom };
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
      <label class="field full"><span>What needs booking?</span><input class="input" data-d="title" value="${esc(x.title)}" placeholder="e.g. Dinner at Roscioli" maxlength="100" autofocus></label>
      <label class="field"><span>Book by</span><input type="date" class="input" data-d="bookBy" value="${esc(x.bookBy)}"></label>
      <label class="field"><span>Who’s on it</span><select class="select" data-d="assignee">${guestOptions(x.assignee, 'Unassigned')}</select></label>
      <label class="field"><span>Cost</span><span class="money-input"><span class="cur">${esc(cur())}</span><input class="input" inputmode="decimal" data-d="cost" value="${esc(x.cost)}" placeholder="0"></span></label>
      <label class="field"><span>Confirmation #</span><input class="input" data-d="ref" value="${esc(x.ref)}" placeholder="optional" maxlength="60"></label>
      <label class="field full"><span>Good to know</span><textarea class="textarea" rows="3" data-d="tip" placeholder="Booking window, dress code, cancellation policy…">${esc(x.tip)}</textarea></label>
      <label class="switch full"><input type="checkbox" data-d="food" ${x.food ? 'checked' : ''}><span class="track"></span>Food booking — show the group’s dietary notes</label>
      <label class="switch full"><input type="checkbox" data-d="booked" ${x.booked ? 'checked' : ''}><span class="track"></span>Already booked</label>
    </div>`,
    onSubmit: (x) => {
      const rec = { id: b ? b.id : uid(), title: x.title.trim(), bookBy: x.bookBy, assignee: x.assignee, booked: !!x.booked, cost: parseMoney(x.cost), ref: x.ref.trim(), tip: x.tip.trim(), food: !!x.food };
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
  const d = dr ? { ...dr } : { title: '', note: '', kind: 'see', img: '' };
  openSheet({
    title: dr ? 'Edit idea' : 'Pin an idea',
    draft: d,
    submitLabel: dr ? 'Save' : 'Pin it',
    valid: (x) => x.title.trim(),
    body: (x) => `<div class="form-grid">
      <label class="field full"><span>Place or idea</span><input class="input" data-d="title" value="${esc(x.title)}" placeholder="e.g. Sunset aperitivo at Terrazza Borromini" maxlength="90" autofocus></label>
      <label class="field full"><span>Note</span><input class="input" data-d="note" value="${esc(x.note)}" placeholder="Why it’s on the board" maxlength="160"></label>
      <div class="field full"><span>Kind</span><div class="gchips">${DREAM_KINDS.map((k) => `<button type="button" class="gchip" style="--c:var(--sage-deep);padding-left:12px" aria-pressed="${x.kind === k.id}" data-action="dSet" data-field="kind" data-v="${k.id}">${k.emoji} ${k.label}</button>`).join('')}</div></div>
      <div class="field full"><span>Photo <small class="faint">(optional)</small></span>
        <div class="row">${x.img ? `<img src="${esc(x.img)}" alt="" style="width:84px;height:64px;object-fit:cover;border-radius:8px">` : ''}
          <button type="button" class="btn small" data-action="dPhoto">${svgIcon('camera')} ${x.img ? 'Change' : 'Add a photo'}</button>
          ${x.img ? '<button type="button" class="btn small ghost" data-action="dSet" data-field="img" data-v="">Remove</button>' : ''}</div></div>
    </div>`,
    onSubmit: (x) => {
      const rec = { title: x.title.trim(), note: x.note.trim(), kind: x.kind, img: x.img };
      if (dr) Object.assign(dr, rec); else state.dream.unshift({ id: uid(), ...rec, promoted: '', rot: +((Math.random() * 5) - 2.5).toFixed(1) });
      commit();
      toast(dr ? 'Idea updated' : 'Pinned to the board');
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
    body: (x) => `<p class="muted" style="margin-bottom:14px"><b>${esc(dr.title)}</b> graduates from “maybe” to “we’re doing it.”</p>
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
   Photos — downscaled to keep localStorage happy
   ========================================================================== */
function pickPhoto(maxDim = 1400, quality = 0.8) {
  return new Promise((resolve) => {
    const inp = $('#photoPick');
    inp.value = '';
    inp.onchange = () => {
      const f = inp.files && inp.files[0];
      if (!f) return resolve(null);
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * s);
        c.height = Math.round(img.naturalHeight * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => { URL.revokeObjectURL(url); toast('That file doesn’t look like a photo we can read.'); resolve(null); };
      img.src = url;
    };
    inp.click();
  });
}

/* ==========================================================================
   Backup: save / load / start over
   ========================================================================== */
function exportData() {
  flush();
  const payload = { app: 'booked-and-busy', edition: 'rome', schema: SCHEMA, exportedAt: new Date().toISOString(), data: state };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const slug = (state.trip.name || 'rome-trip').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'rome-trip';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${slug}-backup-${isoOf(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  try { localStorage.setItem(BACKUP_KEY, new Date().toISOString()); } catch (e) { /* ignore */ }
  toast('Backup saved to your downloads 💾');
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
        toast('Hmm, that file isn’t a Booked & Busy backup. Look for the .json file you saved from this page.');
        return;
      }
      const when = (() => { try { return JSON.parse(r.result).exportedAt; } catch (e) { return null; } })();
      confirmSheet({
        title: 'Load this backup?',
        text: `“<b>${esc(data.trip.name || 'Untitled trip')}</b>”${when ? `, saved ${esc(fmtLong(new Date(when)))}` : ''} — ${pl((data.guests || []).length, 'traveler')}, ${pl((data.itinerary || []).length, 'plan')}. This replaces what’s on this device right now (you can undo straight after).`,
        ok: 'Load backup',
        onOk: () => undoable('Backup loaded', () => { state = normalize(data); }),
      });
    };
    r.readAsText(f);
  };
  inp.click();
}
function resetMenu() {
  openSheet({
    title: 'Start over?',
    body: () => `<p class="muted" style="margin-bottom:14px">Tip: save a backup first if there’s anything you want to keep. Either way you can undo right after.</p>
      <div class="stack" style="gap:10px">
        <button type="button" class="card lift" style="text-align:left;font:inherit;color:inherit" data-action="doReset" data-v="blank"><b style="font:600 18px var(--f-display)">Blank trip</b><p class="muted" style="font-size:13.5px;margin-top:4px">Clears the sample travelers, plans, money and journal. Keeps the Rome ideas, booking tips and inspiration so you’re not starting from zero.</p></button>
        <button type="button" class="card lift" style="text-align:left;font:inherit;color:inherit" data-action="doReset" data-v="sample"><b style="font:600 18px var(--f-display)">Sample trip</b><p class="muted" style="font-size:13.5px;margin-top:4px">Bring back the example bachelorette trip to see how everything works.</p></button>
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
  const colors = ['#82AC9D', '#91602A', '#E5EFDF', '#4F2F26', '#F3C07E', '#C0785A'];
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
  sheetDelete: () => { const fn = sheet && sheet.onDelete; closeSheet(); if (fn) fn(); },
  exportData: () => exportData(),
  importData: () => { closeSheet(); importData(); },
  resetMenu: () => resetMenu(),
  doReset: (el) => { closeSheet(); undoable(el.dataset.v === 'blank' ? 'Fresh start — your Rome trip awaits' : 'Sample trip restored', () => { state = el.dataset.v === 'blank' ? makeBlank() : makeSeed(); }); try { localStorage.setItem(WELCOME_KEY, '1'); } catch (e) { /* ignore */ } render(); },
  dismissWelcome: () => { try { localStorage.setItem(WELCOME_KEY, '1'); } catch (e) { /* ignore */ } render(); },

  heroPhoto: async () => { const src = await pickPhoto(1800, 0.8); if (src) { state.trip.heroImg = src; commit(); toast('Cover photo set'); } },
  heroPhotoRemove: () => undoable('Cover photo removed', () => { state.trip.heroImg = ''; }),

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
    if (!e) { e = { id: uid(), day, title: '', text: '', favorite: '', img: '' }; state.journal.push(e); }
    if (ui.tab !== 'memories') go('memories'); else commit();
    save();
    setTimeout(() => { const t = document.getElementById('jx-' + e.id); if (t) { t.scrollIntoView({ behavior: 'smooth', block: 'center' }); t.focus({ preventScroll: true }); } }, 80);
  },
  addPage: () => {
    const e = { id: uid(), day: null, title: '', text: '', favorite: '', img: '' };
    state.journal.push(e);
    commit();
    setTimeout(() => { const t = document.getElementById('jt-' + e.id); if (t) { t.scrollIntoView({ behavior: 'smooth', block: 'center' }); t.focus({ preventScroll: true }); } }, 80);
  },
  removeEntry: (el) => undoable('Page deleted', () => { state.journal = state.journal.filter((x) => x.id !== el.dataset.id); }),
  entryPhoto: async (el) => { const src = await pickPhoto(1200, 0.78); const e = state.journal.find((x) => x.id === el.dataset.id); if (src && e) { e.img = src; commit(); } },
  entryPhotoRemove: (el) => undoable('Photo removed', () => { const e = state.journal.find((x) => x.id === el.dataset.id); if (e) e.img = ''; }),

  /* draft helpers inside sheets */
  dToggle: (el) => { const arr = sheet.draft[el.dataset.field]; const v = el.dataset.v; const i = arr.indexOf(v); if (i > -1) arr.splice(i, 1); else arr.push(v); renderSheet(); },
  dSet: (el) => { sheet.draft[el.dataset.field] = el.dataset.v; renderSheet(); },
  dAll: (el) => { sheet.draft[el.dataset.field] = state.guests.map((g) => g.id); renderSheet(); },
  dNone: (el) => { sheet.draft[el.dataset.field] = []; renderSheet(); },
  dPhoto: async () => { const s = sheet; const src = await pickPhoto(1000, 0.78); if (src && sheet === s) { s.draft.img = src; renderSheet(); } },
};

/* after-hooks for data-bind fields */
const AFTER = {
  fixDates: () => {
    const s = parseISO(state.trip.start), e = parseISO(state.trip.end);
    if (s && (!e || e < s)) state.trip.end = state.trip.start;
    if (s && e && diffDays(s, e) > 59) state.trip.end = isoOf(addDays(s, 59));
  },
  celebrateBooked: (el) => { if (el.checked) { confetti(el); toast('Booked! One less thing ✨'); } },
  celebratePacked: (el) => {
    if (!el.checked) return;
    const p = state.packing.find((x) => `packing:${x.id}:done` === el.dataset.bind);
    const s = p && packStats(p.guestId);
    if (s && s.pct === 100) { confetti(el); toast(`${firstName(guest(p.guestId).name)} is fully packed 🧳`); }
  },
};

function applyBind(el) {
  const [col, id, field] = el.dataset.bind.split(':');
  const obj = col === 'trip' ? state.trip : (state[col] || []).find((x) => x.id === id);
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
    const used = new Set(state.guests.map((g) => g.color));
    const color = GUEST_COLORS.find((c) => !used.has(c)) || GUEST_COLORS[state.guests.length % GUEST_COLORS.length];
    const g = { id: uid(), name, color, diet: '', arrive: '', depart: '', confirmed: true };
    state.guests.push(g);
    PACK_CATS.forEach((c) => PACK_TEMPLATE[c.id].forEach((text) => state.packing.push({ id: uid(), guestId: g.id, cat: c.id, text, done: false })));
    f.reset();
    commit();
    toast(`${firstName(name)} added — they’re in every list now`);
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
window.addEventListener('pagehide', () => { if (saveTimer) flush(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && saveTimer) flush(); else if (document.visibilityState === 'visible') render(); });
window.addEventListener('storage', (e) => {
  if (e.key === STORE_KEY && e.newValue) { try { state = normalize(JSON.parse(e.newValue)); render(); } catch (err) { /* ignore */ } }
});

state = load();
(function boot() {
  let tab = location.hash.slice(1);
  if (!VIEWS[tab]) { try { tab = localStorage.getItem(TAB_KEY) || 'home'; } catch (e) { tab = 'home'; } }
  ui.tab = VIEWS[tab] ? tab : 'home';
  try { if (!localStorage.getItem(STORE_KEY)) flush(); } catch (e) { /* storage unavailable: app still works for this visit */ }
  render();
  probeAssets().then(() => { if (ASSETS.size) render(); });
})();
