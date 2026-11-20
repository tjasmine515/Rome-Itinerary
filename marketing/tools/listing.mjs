// Builds the Paris Etsy listing images: node listing.mjs <outDir> [names...]
// Canvas is 1600x1200 CSS px, rendered at 1.25x = 2000x1500 (4:3, same shape as the Rome set).
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { C, D, defs, icon } from './doodles.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const LIST = resolve(HERE, '../listing');
const SHOT = (n) => `file://${LIST}/shots/${n}.png`;
const LOGO = readFileSync(`${LIST}/logo.svg`, 'utf8');
const F = (p) => `file://${HERE}/node_modules/${p}`;
const out = process.argv[2];
const only = process.argv.slice(3);
mkdirSync(out, { recursive: true });

const css = `
@font-face { font-family: Fraunces; src: url(${F('@fontsource-variable/fraunces/files/fraunces-latin-full-normal.woff2')}); font-weight: 100 900; font-style: normal; }
@font-face { font-family: Fraunces; src: url(${F('@fontsource-variable/fraunces/files/fraunces-latin-full-italic.woff2')}); font-weight: 100 900; font-style: italic; }
@font-face { font-family: 'DM Sans'; src: url(${F('@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2')}); font-weight: 100 1000; }
@font-face { font-family: Caveat; src: url(${F('@fontsource/caveat/files/caveat-latin-700-normal.woff2')}); font-weight: 700; }
* { box-sizing: border-box; margin: 0; }
html, body { width: 1600px; height: 1200px; overflow: hidden; }
body { position: relative; background: #F6EBDC; color: ${C.ink}; font-family: 'DM Sans', sans-serif; }
body::before { content: ""; position: absolute; inset: 0; z-index: 0; pointer-events: none; opacity: .5; mix-blend-mode: multiply;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' seed='3'/%3E%3CfeColorMatrix values='0 0 0 0 .55 0 0 0 0 .42 0 0 0 0 .32 0 0 0 .22 0'/%3E%3C/filter%3E%3Crect width='400' height='400' filter='url(%23n)'/%3E%3C/svg%3E"); }
body::after { content: ""; position: absolute; inset: 0; z-index: 0; pointer-events: none;
  background: radial-gradient(ellipse at 50% 40%, transparent 55%, rgba(185,134,111,.14) 100%); }
.abs { position: absolute; z-index: 2; }
.logo svg { width: 100%; height: auto; display: block; }
h1 { font-family: Fraunces; font-weight: 800; font-variation-settings: 'opsz' 144, 'SOFT' 100, 'WONK' 0; letter-spacing: -.025em; line-height: .92; color: #3F2119; }
.sub { font-family: 'DM Sans'; font-weight: 500; font-size: 31px; line-height: 1.3; color: #5C3127; }
.sub-i { font-family: Fraunces; font-style: italic; font-weight: 500; font-variation-settings: 'opsz' 48, 'SOFT' 50; font-size: 34px; color: #5C3127; }
.hand { font-family: Caveat; font-weight: 700; }
.swash { position: absolute; z-index: 1; }
/* devices */
.laptop { position: absolute; z-index: 3; filter: drop-shadow(0 26px 30px rgba(75,39,31,.28)); }
.laptop .scr { background: #1E1B1A; border-radius: 22px 22px 6px 6px; padding: 16px 16px 20px; }
.laptop .scr img { display: block; width: 100%; border-radius: 4px; }
.laptop .base { height: 22px; margin: 0 -7%; background: linear-gradient(#E4E1DD, #B9B5B0); border-radius: 2px 2px 18px 18px; position: relative; }
.laptop .base::after { content: ""; position: absolute; left: 50%; top: 0; width: 16%; height: 8px; transform: translateX(-50%); background: #A9A49F; border-radius: 0 0 10px 10px; }
.phone { position: absolute; z-index: 4; background: #1E1B1A; border-radius: 48px; padding: 11px; filter: drop-shadow(0 26px 26px rgba(75,39,31,.32)); }
.phone .in { border-radius: 38px; overflow: hidden; background: #F1E3CF; }
.phone .bar { height: 46px; display: flex; align-items: center; justify-content: space-between; padding: 6px 30px 0; font: 700 15px 'DM Sans'; color: #3F2119; }
.phone .bar i { width: 26px; height: 12px; border: 2px solid #3F2119; border-radius: 4px; position: relative; }
.phone .bar i::after { content: ''; position: absolute; inset: 1px 5px 1px 1px; background: #3F2119; border-radius: 1px; }
.phone img { display: block; width: 100%; }
.phone::before { content: ""; position: absolute; top: 19px; left: 50%; width: 28%; height: 22px; transform: translateX(-50%); background: #1E1B1A; border-radius: 99px; z-index: 2; }
/* paper cards + callouts */
.card { position: absolute; z-index: 2; padding: 26px 26px 28px; }
.card::before { content: ""; position: absolute; inset: 0; z-index: -1; border-radius: 10px; background: var(--bg); filter: url(#blob); opacity: .9; }
.card p { font-family: Fraunces; font-weight: 600; font-variation-settings: 'opsz' 72, 'SOFT' 80; font-size: 29px; line-height: 1.1; color: #3F2119; }
.callout { position: absolute; z-index: 2; display: flex; align-items: center; gap: 22px; }
.callout .dot { width: 120px; height: 120px; flex: none; display: grid; place-items: center; position: relative; }
.callout .dot::before { content: ""; position: absolute; inset: 0; border-radius: 50%; background: var(--bg); filter: url(#blob); opacity: .85; }
.callout .dot svg { position: relative; }
.callout p { font-family: Fraunces; font-style: italic; font-weight: 600; font-variation-settings: 'opsz' 72, 'SOFT' 60; font-size: 30px; line-height: 1.08; color: #3F2119; }
.under { position: relative; display: inline-block; }
.under::after { content: ""; position: absolute; left: 1%; right: 3%; bottom: -4px; height: 17px; background: var(--u, ${C.pinkDeep}); border-radius: 99px; filter: url(#wash); opacity: 1; transform: rotate(-.8deg); z-index: -1; }
`;

const page = (body) => `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${defs}${body}</body></html>`;
const at = (x, y, html, extra = '') => `<div class="abs" style="left:${x}px;top:${y}px;${extra}">${html}</div>`;
const logo = (x, y, w) => `<div class="abs logo" style="left:${x}px;top:${y}px;width:${w}px">${LOGO}</div>`;
const laptop = (img, x, y, w) => `<div class="laptop" style="left:${x}px;top:${y}px;width:${w}px"><div class="scr"><img src="${SHOT(img)}"></div><div class="base"></div></div>`;
const phone = (img, x, y, w, crop = 0.86) => `<div class="phone" style="left:${x}px;top:${y}px;width:${w}px"><div class="in"><div class="bar" style="font-size:${Math.round(w / 15)}px"><span>9:41</span><i></i></div><img src="${SHOT(img)}"></div></div>`;
const card = (x, y, w, bg, ico, text, rot = 0, extra = '') => `<div class="card" style="left:${x}px;top:${y}px;width:${w}px;--bg:${bg};transform:rotate(${rot}deg);${extra}">${icon(ico, 78)}<p style="margin-top:8px">${text}</p></div>`;
const callout = (x, y, bg, ico, text, w = 370) => `<div class="callout" style="left:${x}px;top:${y}px;width:${w}px"><div class="dot" style="--bg:${bg}">${icon(ico, 76)}</div><p>${text}</p></div>`;
const bottomRow = (items) => `<div class="abs" style="left:0;right:0;top:1052px;display:flex;justify-content:center;gap:34px;z-index:5">${items.map(([bg, ico, t], i) => `${i ? `<div style="width:2px;align-self:stretch;background:${C.tan};opacity:.35;margin:8px 0"></div>` : ''}<div class="callout" style="position:relative;gap:18px"><div class="dot" style="--bg:${bg};width:110px;height:110px">${icon(ico, 66)}</div><p style="font-size:33px;width:300px">${t}</p></div>`).join('')}</div>`;

const PINK = '#F2D3D0', BLUE = '#DCE1EA', TAN = '#EED9C4', CREAM = '#F7E7CF';

const IMAGES = {
  '01-good-to-know': () => page(`
    ${logo(675, 30, 250)}
    ${at(580, 52, D.sparks(64, C.tan))}${at(960, 52, D.sparks(64, C.tan, true))}
    <h1 class="abs" style="left:0;right:0;top:268px;text-align:center;font-size:140px">Good to <span class="under">know.</span></h1>
    <p class="abs sub-i" style="left:0;right:0;top:432px;text-align:center">Everything you need before your group gets started.</p>
    ${laptop('d-home', 470, 520, 640)}
    ${phone('m-home', 1040, 556, 176)}
    ${card(40, 46, 290, PINK, 'tickets', 'One purchase covers your whole group.', -1.5)}
    ${card(40, 420, 290, CREAM, 'laptop', 'Works in any browser on phones, tablets and laptops.', 1)}
    ${card(40, 812, 290, BLUE, 'envelope', 'Digital product. Nothing physical ships.', -1)}
    ${card(1270, 46, 290, BLUE, 'phone', 'No app or account required.', 1.5)}
    ${card(1270, 420, 290, TAN, 'sync', 'Changes sync live for everyone with the link.', -1)}
    ${card(1270, 812, 290, PINK, 'people', 'Made for girls’ trips, birthdays and reunions.', 1)}
    ${at(470, 1050, D.croissant(120), 'transform:rotate(-8deg)')}
    <div class="abs" style="left:610px;top:1054px;transform:rotate(-2.5deg);padding:14px 30px;background:#FBF4E8;box-shadow:0 6px 14px rgba(75,39,31,.12)"><span class="hand" style="font-size:42px;color:#5C3127">Paris ideas &amp; tips included.</span></div>
    ${at(1060, 1040, D.heart(44))}
  `),

  '02-little-things': () => page(`
    ${at(70, 60, D.eiffel(110), 'transform:rotate(-6deg)')}
    ${at(1380, 40, D.stamp(170, 7))}
    <h1 class="abs" style="left:0;right:0;top:56px;text-align:center;font-size:112px">The little things?<br><span class="under">On the list, too.</span></h1>
    <p class="abs sub" style="left:0;right:0;top:318px;text-align:center">Keep the practical details and the fun parts<br>of the trip in one place.</p>
    ${[['Packing Lists', 'Everyone’s checklist,<br>Paris extras included.', BLUE, 'suitcase', 40], ['Dream Board', 'Save the places you<br>saw on Instagram.', PINK, 'heart', 600], ['Trip Journal', 'The little moments<br>and the big ones.', TAN, 'camera', 1080]].map(([t, d, bg, ico, x]) => `
      <div class="abs" style="left:${x}px;top:440px;width:480px;text-align:center">
        <div style="display:inline-flex;align-items:center;gap:12px;position:relative;padding:4px 26px"><span style="position:absolute;inset:0;background:${bg};filter:url(#blob);border-radius:10px;z-index:-1"></span>${icon(ico, 58)}<span style="font:800 44px/1 Fraunces;font-variation-settings:'opsz' 144,'SOFT' 100;color:#3F2119">${t}</span></div>
        <p class="sub" style="font-size:25px;margin-top:12px">${d}</p></div>`).join('')}
    ${laptop('d-packing', 56, 640, 470)}
    ${phone('m-dream', 683, 610, 236)}
    ${laptop('d-memories', 1076, 640, 470)}
    ${at(560, 1090, D.macaron(80), 'transform:rotate(-10deg)')}${at(980, 1070, D.heart(40))}
  `),

  '03-bookings': () => page(`
    ${logo(38, 40, 230)}
    <h1 class="abs" style="left:300px;right:30px;top:52px;text-align:center;font-size:96px">The reservation is made.<br>Now keep the <span class="under">details</span> straight.</h1>
    <p class="abs sub" style="left:300px;right:30px;top:272px;text-align:center">Keep booking info, deadlines, and who’s booking what<br>organized in one shared place.</p>
    ${at(40, 330, D.metro(190), 'transform:rotate(-4deg)')}
    ${laptop('d-bookings', 280, 395, 860)}
    ${phone('m-bookings', 1190, 420, 250)}
    ${at(1460, 330, D.wine(56), 'transform:rotate(10deg)')}
    ${bottomRow([[PINK, 'calendar', 'Book-by dates follow<br>your trip dates'], ['#F7E2B8', 'people', 'Assign who’s<br>booking it'], [BLUE, 'warning', '“Book these first”<br>alerts']])}
  `),

  '04-group-picks': () => page(`
    ${logo(38, 40, 240)}
    <h1 class="abs" style="left:310px;right:20px;top:58px;text-align:center;font-size:96px">Everyone gets a say.<br>Someone <span class="under">actually</span> decides.</h1>
    <p class="abs sub" style="left:310px;right:20px;top:280px;text-align:center">Collect ideas, vote on your favorites, and move<br>the winners right into your itinerary.</p>
    ${callout(30, 430, '#F7E2B8', 'bulb', 'Suggest cafés, museums &amp; day trips')}
    ${callout(30, 650, PINK, 'heart', 'See what the group is excited about')}
    ${callout(30, 870, BLUE, 'people', 'Spend less time debating')}
    ${laptop('d-vote', 420, 420, 820)}
    ${phone('m-vote', 1300, 440, 250)}
    ${at(1330, 1040, D.stamp(140, 8))}
    ${at(560, 1070, D.croissant(110), 'transform:rotate(-6deg)')}
  `),

  '05-itinerary': () => page(`
    ${logo(38, 40, 230)}
    <h1 class="abs" style="left:300px;right:30px;top:52px;text-align:center;font-size:100px">A plan for the day.<br>Room for the <span class="under">unexpected.</span></h1>
    <p class="abs sub" style="left:300px;right:30px;top:276px;text-align:center">Organize your days, activities, and key details<br>in one easy-to-follow itinerary.</p>
    ${at(40, 400, D.cafeTable(200))}
    ${laptop('d-itinerary-clash', 280, 395, 860)}
    ${phone('m-itinerary-clash', 1190, 420, 250)}
    ${at(1460, 330, D.plane(120), 'opacity:.8')}
    ${bottomRow([[BLUE, 'calendar', 'See the plan<br>at a glance'], [PINK, 'warning', 'Heads-up when a<br>venue is closed'], ['#F7E2B8', 'signpost', 'Enjoy the trip with<br>less guessing']])}
  `),

  '06-budget': () => page(`
    ${logo(38, 40, 230)}
    <h1 class="abs" style="left:300px;right:30px;top:52px;text-align:center;font-size:104px">Know what’s spent.<br>See what’s <span class="under">left.</span></h1>
    <p class="abs sub-i" style="left:300px;right:30px;top:284px;text-align:center">Track spending, split it fairly, and see the tourist tax before it surprises you.</p>
    ${at(50, 420, D.croissant(170), 'transform:rotate(-10deg)')}
    ${laptop('d-budget', 280, 395, 860)}
    ${phone('m-budget-tax', 1190, 420, 250)}
    ${at(1470, 340, D.macaron(90), 'transform:rotate(12deg)')}
    ${bottomRow([['#F7E2B8', 'receipt', 'Track every<br>expense'], [PINK, 'euro', 'Tourist tax,<br>worked out'], [BLUE, 'people', 'Make group costs<br>less awkward']])}
  `),

  '07-three-steps': () => page(`
    <h1 class="abs" style="left:0;right:0;top:44px;text-align:center;font-size:100px">From download to ‘we’re going!’<br>in <span class="under">three steps.</span></h1>
    <p class="abs sub" style="left:0;right:0;top:266px;text-align:center">Setup takes about two minutes. Only one person does it.</p>
    ${[['1', '#DCE1EA', 'Open your planner.', 'Download the file, open the link<br>and enter your access code.', 'm-start', 70], ['2', '#F7E2B8', 'Add your people.', 'Name the trip and pick your name.<br>Friends add theirs when they join.', 'm-whoareyou', 580], ['3', '#F2D3D0', 'Share the link.', 'Everyone can view, add ideas,<br>vote and help plan.', 'm-home', 1090]].map(([n, bg, t, d, img, x]) => `
      <div class="abs" style="left:${x}px;top:350px;width:450px">
        <div style="display:flex;align-items:center;gap:16px"><div style="width:84px;height:84px;flex:none;display:grid;place-items:center;position:relative"><span style="position:absolute;inset:0;border-radius:50%;background:${bg};filter:url(#blob)"></span><span style="position:relative;font:700 58px/1 Caveat;color:#3F2119">${n}</span></div>
        <div><div style="font:800 36px/1.05 Fraunces;font-variation-settings:'opsz' 144,'SOFT' 100;color:#3F2119">${t}</div><p class="sub" style="font-size:21px;margin-top:6px">${d}</p></div></div></div>
      ${phone(img, x + 95, 525, 262)}`).join('')}
    <svg class="abs" style="left:440px;top:770px" width="140" height="60" viewBox="0 0 140 60" fill="none"><g filter="url(#rough)" stroke="${C.ink}" stroke-width="3" stroke-linecap="round"><path d="M6 44C40 6 90 6 128 30M114 18l14 12-16 6"/></g></svg>
    <svg class="abs" style="left:950px;top:770px" width="140" height="60" viewBox="0 0 140 60" fill="none"><g filter="url(#rough)" stroke="${C.ink}" stroke-width="3" stroke-linecap="round"><path d="M6 44C40 6 90 6 128 30M114 18l14 12-16 6"/></g></svg>
    ${at(40, 1060, D.croissant(110), 'transform:rotate(-8deg)')}${at(1500, 1080, D.heart(46))}
  `),

  '08-everything': () => page(`
    ${logo(38, 36, 220)}
    ${at(1360, 30, D.stamp(170, 7))}
    <h1 class="abs" style="left:280px;right:220px;top:60px;text-align:center;font-size:116px">Everything <span class="under">included.</span></h1>
    <p class="abs sub-i" style="left:280px;right:220px;top:214px;text-align:center;font-size:44px;font-weight:600">11 tools. One link.</p>
    <div class="abs" style="left:40px;right:40px;top:330px;display:grid;grid-template-columns:repeat(6,1fr);gap:22px 18px">
      ${[['house', 'Home', 'Your trip at a glance, with a countdown.'], ['people', 'Guest List', 'Everyone on the trip, typed once.'], ['clock', 'Today', 'What’s on now and what’s next.'], ['bulb', 'Group Picks', 'Vote on ideas as a group.'], ['map', 'Itinerary', 'Day by day, with closed-day alerts.'], ['euro', 'Budget & Split', 'Who owes who, plus tourist tax.'],
         ['ticket', 'Booking Tracker', 'Deadlines and who’s booking.'], ['suitcase', 'Packing', 'A list for everyone, Paris extras too.'], ['chat', 'Good to Know', 'French phrases, customs, fun facts.', 'NEW'], ['heart', 'Dream Board', 'Save the must-sees.'], ['camera', 'Trip Journal', 'Memories, notes and highlights.']]
        .map(([ico, t, d, isNew], i) => `<div style="position:relative;padding:30px 16px 34px;text-align:center;${i >= 6 ? `grid-row:2;grid-column:${i - 6 + 1} / span 1;transform:translateX(${50}%)` : ''}">
          <span style="position:absolute;inset:0;border-radius:12px;background:#FBF4E8;box-shadow:0 4px 12px rgba(75,39,31,.08)"></span>
          <span style="position:absolute;left:14px;top:12px;width:44px;height:44px;border-radius:50%;background:${[BLUE, '#F7E2B8', PINK][i % 3]};filter:url(#blob);display:grid;place-items:center"></span>
          <span style="position:absolute;left:14px;top:12px;width:44px;height:44px;display:grid;place-items:center;font:600 20px/1 Fraunces;color:#3F2119">${String(i + 1).padStart(2, '0')}</span>
          ${isNew ? `<span style="position:absolute;right:12px;top:14px;font:700 13px/1 'DM Sans';letter-spacing:.1em;background:${C.pinkDeep};color:#fff;padding:5px 8px;border-radius:99px">NEW</span>` : ''}
          <div style="position:relative;margin:34px 0 18px">${icon(ico, 112)}</div>
          <div style="position:relative;font:800 27px/1.05 Fraunces;font-variation-settings:'opsz' 144,'SOFT' 100;color:#3F2119"><span class="under" style="--u:${C.tanLight}">${t}</span></div>
          <p class="sub" style="position:relative;font-size:19px;margin-top:14px;line-height:1.3">${d}</p></div>`).join('')}
    </div>
    ${at(36, 1090, D.croissant(100), 'transform:rotate(-8deg)')}${at(1490, 1095, D.macaron(74), 'transform:rotate(8deg)')}
  `),

  '09-why-different': () => page(`
    ${logo(38, 40, 230)}
    <h1 class="abs" style="left:300px;right:30px;top:96px;text-align:center;font-size:120px">Why it’s <span class="under">different.</span></h1>
    <p class="abs sub-i" style="left:300px;right:30px;top:250px;text-align:center">Built for real group trips, not just pretty plans.</p>
    ${[['map', BLUE, 'More than an itinerary template.', 'Plan days, vote on ideas, track the budget and bookings in one place.'], ['house', '#F7E2B8', 'One shared home base.', 'No more scattered links or buried group-chat details.'], ['people', PINK, 'Everyone in it.', 'The whole group adds ideas, votes and stays updated.'], ['devices', BLUE, 'Works on phone + laptop.', 'A simple link on any device. No app to download.']]
      .map(([ico, bg, t, d], i) => `<div class="abs" style="left:34px;top:${350 + i * 200}px;width:520px;display:flex;gap:22px;align-items:flex-start">
        <div class="callout" style="position:relative"><div class="dot" style="--bg:${bg};width:120px;height:120px">${icon(ico, 72)}</div></div>
        <div><div style="font:800 32px/1.05 Fraunces;font-variation-settings:'opsz' 144,'SOFT' 100;color:#3F2119">${t}</div><p class="sub" style="font-size:22px;margin-top:8px">${d}</p></div></div>`).join('')}
    ${laptop('d-home', 600, 400, 760)}
    ${phone('m-home', 1320, 460, 236)}
    ${at(1400, 40, D.eiffel(100), 'transform:rotate(5deg)')}
    ${at(780, 1060, D.cafeTable(150))}
  `),

  '10-good-to-know-tab': () => page(`
    ${logo(38, 40, 230)}
    <h1 class="abs" style="left:300px;right:30px;top:52px;text-align:center;font-size:104px">Bonjour first.<br>The rest is <span class="under">in your pocket.</span></h1>
    <p class="abs sub" style="left:300px;right:30px;top:276px;text-align:center">A built-in Good to Know guide with French phrases,<br>local customs and fun facts, sized for your phone.</p>
    ${callout(40, 420, PINK, 'chat', 'Phrases with easy pronunciation')}
    ${callout(40, 620, '#F7E2B8', 'heart', 'Customs, so you fit right in')}
    ${callout(40, 820, BLUE, 'map', 'Metro and airport tips')}
    ${phone('m-pocket', 520, 400, 300)}
    ${phone('m-pocket-customs', 880, 450, 300)}
    ${at(1240, 470, D.metro(260), 'transform:rotate(3deg)')}
    ${at(1250, 800, D.cafeTable(230))}
    ${at(1230, 1080, D.croissant(110), 'transform:rotate(-10deg)')}
  `),
};

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 1.25 });
for (const [name, build] of Object.entries(IMAGES)) {
  if (only.length && !only.includes(name)) continue;
  const file = `${out}/${name}.html`;
  writeFileSync(file, build());
  const p = await ctx.newPage();
  await p.goto('file://' + file);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/${name}.png` });
  await p.close();
  console.log('wrote', name);
}
await b.close();
