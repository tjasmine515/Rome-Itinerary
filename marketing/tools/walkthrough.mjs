// Records a clicked-through tour of a city's app (phone or laptop) as an .mp4 (needs ffmpeg).
// Serve the site with Firebase switched off, then:  node walkthrough.mjs <phone|laptop> <outDir> [baseUrl] [accessCode]
// Frames come from Chrome's screencast at full device resolution (Playwright's own recorder ignores it).
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const [mode = 'phone', out = 'video', base = 'http://localhost:8812/', code = 'paris'] = process.argv.slice(2);
const phone = mode === 'phone';
const vp = phone ? { width: 390, height: 844 } : { width: 1440, height: 900 };
const scale = phone ? 2 : 1.5;
mkdirSync(out, { recursive: true });

// A soft dot that follows the pointer and shrinks on tap, so viewers can see what's being clicked.
const CURSOR = `addEventListener('DOMContentLoaded', () => {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;left:-60px;top:-60px;width:${phone ? 34 : 24}px;height:${phone ? 34 : 24}px;border-radius:50%;background:rgba(92,49,39,.22);border:2px solid rgba(92,49,39,.6);pointer-events:none;z-index:2147483647;transform:translate(-50%,-50%);transition:transform .12s, background .12s';
  document.documentElement.appendChild(d);
  addEventListener('mousemove', (e) => { d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px'; }, true);
  addEventListener('mousedown', () => { d.style.transform = 'translate(-50%,-50%) scale(.7)'; d.style.background = 'rgba(232,183,184,.6)'; }, true);
  addEventListener('mouseup', () => { d.style.transform = 'translate(-50%,-50%)'; d.style.background = 'rgba(92,49,39,.22)'; }, true);
});`;

// the flag makes the screencast send full-resolution frames
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: [`--force-device-scale-factor=${scale}`] });
const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: scale });
await ctx.addInitScript(CURSOR);
const p = await ctx.newPage();
const frames = [];
const cdp = await ctx.newCDPSession(p);
cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
  frames.push({ t: metadata.timestamp, data: Buffer.from(data, 'base64') });
  cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: vp.width * scale, maxHeight: vp.height * scale, everyNthFrame: 1 });
const wait = (ms) => p.waitForTimeout(ms);
let mx = vp.width / 2, my = vp.height / 2;

async function moveTo(loc) {
  await loc.scrollIntoViewIfNeeded();
  const box = await loc.boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await p.mouse.move(x, y, { steps: Math.max(8, Math.round(Math.hypot(x - mx, y - my) / 18)) });
  mx = x; my = y;
}
async function tap(sel, pause = 700) {
  const loc = p.locator(sel).locator('visible=true').first();
  await moveTo(loc); await wait(180);
  await p.mouse.down(); await wait(90); await p.mouse.up();
  await wait(pause);
}
async function type(sel, text, pause = 400) {
  await tap(sel, 150);
  await p.keyboard.type(text, { delay: 75 });
  await wait(pause);
}
async function scroll(dy, ms = 1200) {
  await p.evaluate((dy) => window.scrollBy({ top: dy, behavior: 'smooth' }), dy);
  await wait(ms);
}
async function goTab(id, label) {
  if (!phone) return tap(`.navlist [data-tab=${id}]`, 1300);
  if (['home', 'itinerary', 'vote', 'budget'].includes(id)) return tap(`.bottomnav [data-tab=${id}]`, 1300);
  await tap('.bottomnav [data-action=more]', 700);
  await tap(`.more-grid [data-tab=${id}]`, 1300);
}

// 1. start a trip (lowercase code works)
await p.goto(`${base}?mock&today=2026-11-20`);
await wait(1200);
await p.fill('#startForm [name=name]', '');
await type('#startForm [name=name]', 'Bonjour, Paris');
await type('#startForm [name=me]', 'Maya');
await type('#startForm [name=code]', code);
await tap('#startForm label:has(input[value=sample])', 500);
await tap('#startForm button[type=submit]', 2200);
await p.evaluate(() => { localStorage.setItem(WELCOME_KEY + ':' + SYNC.tripId, '1'); render(); });
await wait(800);

// 2. home
await scroll(phone ? 520 : 380, 1500); await scroll(phone ? 520 : 400, 1500); await scroll(-2000, 1200);

// 3. group picks: vote
await goTab('vote');
await scroll(phone ? 380 : 200, 1100);
await tap('.vote-item [data-action=vote][aria-pressed=false]', 900);
await scroll(phone ? 600 : 400, 1300);

// 4. itinerary + the closed-day warning
await goTab('itinerary');
await scroll(phone ? 500 : 300, 1300);
await scroll(-2000, 900);
await tap('[data-action=addItem][data-day="0"] >> nth=0', 900);
await type('#sheetPanel [data-d=title]', 'Louvre', 500);
const tue = await p.evaluate(() => (tripDays().find((d) => d.date.getDay() === 2) || {}).i);
await tap('#sheetPanel [data-d=day]', 300);
await p.selectOption('#sheetPanel [data-d=day]', String(tue));
await wait(2200);
await tap('#sheetPanel [data-action=closeSheet] >> nth=-1', 900);

// 5. budget: tourist tax + price guide
await goTab('budget');
await scroll(phone ? 700 : 520, 1400);
await p.locator('.tax-card').scrollIntoViewIfNeeded(); await wait(700);
await tap('[data-bind="tax::stay"]', 300);
await p.selectOption('[data-bind="tax::stay"]', 'rental'); await wait(900);
await type('[data-bind="tax::nightly"]', '60', 300);
await p.fill('[data-bind="tax::adults"]', ''); await type('[data-bind="tax::adults"]', '5', 300);
await p.fill('[data-bind="tax::nights"]', ''); await type('[data-bind="tax::nights"]', '4', 1600);
await scroll(phone ? 700 : 400, 1600);
await tap('[data-action=budgetView][data-v=split]', 1600);

// 6. bookings: mark one booked
await goTab('bookings');
await scroll(phone ? 300 : 150, 1000);
await tap('.ticket:not(.done) .switch .track', 1800);

// 7. packing
await goTab('packing');
await scroll(phone ? 420 : 200, 1000);
for (let i = 0; i < 3; i++) await tap('.pack-item:not(.is-done) .check', 500);
await wait(600);

// 8. good to know
await goTab('pocket');
await scroll(phone ? 500 : 300, 1300);
await tap('[data-action=jumpPocket][data-v=customs]', 1600);
await tap('[data-action=jumpPocket][data-v=facts]', 1800);

// 9. dashboard, dream board, memories, home
await goTab('dashboard');
await scroll(phone ? 600 : 300, 1500);
await goTab('dream'); await scroll(phone ? 500 : 250, 1200);
await goTab('memories'); await wait(800);
await goTab('home'); await wait(1500);

await cdp.send('Page.stopScreencast');
await ctx.close();
await b.close();
// frames only arrive when something changes, so hold each one until the next
const tmp = `${out}/frames-${mode}`;
rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
let list = '';
frames.forEach((f, i) => {
  const name = `${String(i).padStart(6, '0')}.jpg`;
  writeFileSync(`${tmp}/${name}`, f.data);
  const dur = i + 1 < frames.length ? Math.max(0.001, frames[i + 1].t - f.t) : 1.5;
  list += `file '${name}'\nduration ${dur.toFixed(4)}\n`;
});
list += `file '${String(frames.length - 1).padStart(6, '0')}.jpg'\n`;
writeFileSync(`${tmp}/list.txt`, list);
const mp4 = `${out}/walkthrough-${mode}.mp4`;
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', `${tmp}/list.txt`, '-vf', 'fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
rmSync(tmp, { recursive: true, force: true });
console.log('saved', mp4, frames.length, 'frames');
