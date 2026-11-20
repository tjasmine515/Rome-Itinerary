// Hand-drawn Paris doodles for the listing images.
// Ink lines get a slight wobble (#rough); colour sits underneath as a loose
// watercolour wash (#wash), a little off-register like real hand painting.
export const C = {
  ink: '#4B271F', cream: '#F3E3CC', pink: '#E8B7B8', pinkDeep: '#D99A9C', blue: '#949FB3',
  blueDeep: '#6E7A92', tan: '#B9866F', tanLight: '#DDB896', gold: '#D7A55F', paper: '#FBF4E8',
};

export const defs = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <filter id="rough" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency="0.025" numOctaves="2" seed="4" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="wash" x="-15%" y="-15%" width="130%" height="130%">
    <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="9" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="9" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="2" seed="2" result="g"/>
    <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.9 1.15" result="ga"/>
    <feComposite in="d" in2="ga" operator="in" result="t"/>
    <feGaussianBlur in="t" stdDeviation="0.4"/>
  </filter>
  <filter id="blob" x="-20%" y="-20%" width="140%" height="140%">
    <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="12" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="22" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="6" result="g"/>
    <feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.7 1.1" result="ga"/>
    <feComposite in="d" in2="ga" operator="in"/>
  </filter>
</defs></svg>`;

const svg = (vb, body, w, style = '') => `<svg viewBox="${vb}" width="${w}" style="${style}" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const wash = (body, op = 0.85) => `<g filter="url(#wash)" opacity="${op}" stroke="none">${body}</g>`;
const ink = (body, w = 2.4) => `<g filter="url(#rough)" stroke="${C.ink}" stroke-width="${w}">${body}</g>`;

export const D = {
  eiffel: (w = 160) => svg('0 0 100 160', wash(`<path fill="${C.tanLight}" d="M47 22h7l3 30h6l4 38h8l17 66H75c-4-24-12-36-25-36S29 132 25 156H8l17-66h8l4-38h6z"/>`) + ink(`
    <path d="M50 4v14"/><path d="M47 6l-2-2M53 6l2-2" stroke-width="1.6"/>
    <path d="M46 18h8l3 32h-14z"/><path d="M41 50h18" stroke-width="3"/>
    <path d="M43 52l-5 36M57 52l5 36"/><path d="M33 88h34" stroke-width="3.2"/>
    <path d="M36 91L18 156M64 91l18 65"/><path d="M27 120h46" stroke-width="2"/>
    <path d="M28 156c3-22 10-34 22-34s19 12 22 34"/><path d="M6 156h22M72 156h22"/>
    <path d="M45 56l11 14M55 56L44 70M44 70l13 16M56 70L43 86" stroke-width="1.3"/>
    <path d="M36 94l26 24M64 94L36 118M30 124l9 12M70 124l-9 12" stroke-width="1.3"/>`), w),

  croissant: (w = 150) => svg('0 0 140 90', wash(`<path fill="${C.gold}" d="M8 62c0-9 7-15 16-15 2-14 14-24 30-26 6-3 18-3 26 0 16 2 28 12 30 26 9 0 16 6 16 15-8 5-17 5-23-1-5 7-13 10-23 10H54c-10 0-18-3-23-10-6 6-15 6-23 1z"/>`, 0.8) + ink(`
    <path d="M8 62c0-9 7-15 16-15 2-14 14-24 30-26 6-3 18-3 26 0 16 2 28 12 30 26 9 0 16 6 16 15-8 5-17 5-23-1-5 7-13 10-23 10H54c-10 0-18-3-23-10-6 6-15 6-23 1z"/>
    <path d="M31 30c4 10 6 22 4 36M54 21c3 12 4 28 2 46M80 21c-3 12-4 28-2 46M103 30c-4 10-6 22-4 36" stroke-width="1.8"/>
    <path d="M24 47c2 6 3 10 7 15M110 47c-2 6-3 10-7 15" stroke-width="1.6"/>`), w),

  macaron: (w = 110) => svg('0 0 100 80', wash(`<path fill="${C.pink}" d="M12 34c0-14 17-24 38-24s38 10 38 24zM12 48c0 14 17 24 38 24s38-10 38-24z"/><rect fill="${C.cream}" x="10" y="34" width="80" height="14" rx="7"/>`) + ink(`
    <path d="M12 34c0-14 17-24 38-24s38 10 38 24z"/><path d="M12 48c0 14 17 24 38 24s38-10 38-24z"/><rect x="10" y="34" width="80" height="14" rx="7"/>
    <path d="M16 35c3 3 5 3 8 0s5-3 8 0 5 3 8 0 5-3 8 0 5 3 8 0 5-3 8 0 5 3 8 0 5-3 8 0" stroke-width="1.3"/>`), w),

  cafeTable: (w = 170) => svg('0 0 160 120', wash(`<ellipse fill="${C.blue}" cx="80" cy="52" rx="34" ry="9"/><path fill="${C.pink}" d="M68 36h9l2 14h-13z"/><path fill="${C.tanLight}" d="M86 40c0-5 9-5 9 0v8h-9z"/>`) + ink(`
    <ellipse cx="80" cy="52" rx="34" ry="9"/><path d="M80 61v45M66 110h28M70 106l10-8 10 8"/>
    <path d="M68 36h9l2 14h-13z" stroke-width="1.8"/><path d="M86 41c0-6 9-6 9 0v8h-9z M95 43c4 0 4 5 0 5" stroke-width="1.8"/>
    <path d="M18 30c0-8 14-8 14 0v34h14v46M18 30v80M18 64h14" /><path d="M20 72h24M24 64l-4 46M42 64l4 46" stroke-width="1.6"/>
    <path d="M142 30c0-8-14-8-14 0v34h-14v46M142 30v80M142 64h-14" /><path d="M140 72h-24M136 64l4 46M118 64l-4 46" stroke-width="1.6"/>`), w),

  wine: (w = 70) => svg('0 0 60 110', wash(`<path fill="${C.pinkDeep}" d="M13 26h34c-1 13-7 21-17 21s-16-8-17-21z"/>`, 0.75) + ink(`
    <path d="M10 6h40c0 26-8 42-20 42S10 32 10 6z"/><path d="M30 48v44M16 100c4-5 24-5 28 0M14 101h32"/><path d="M15 26h30" stroke-width="1.6"/>`), w),

  metro: (w = 190) => svg('0 0 200 170', wash(`<rect fill="${C.cream}" x="34" y="20" width="132" height="36" rx="6"/><path fill="${C.blue}" d="M30 60c-10-20 4-38 18-36M170 60c10-20-4-38-18-36" stroke="${C.blue}" stroke-width="6"/>`) + ink(`
    <rect x="34" y="20" width="132" height="36" rx="6"/><rect x="40" y="25" width="120" height="26" rx="4" stroke-width="1.4"/>
    <path d="M44 60v104M156 60v104"/><path d="M44 60c-16-4-22-22-10-32 8-6 18 0 14 8M156 60c16-4 22-22 10-32-8-6-18 0-14 8"/>
    <path d="M38 164h14M150 164h14"/><path d="M44 110c-6 0-10-4-10-10M156 110c6 0 10-4 10-10" stroke-width="1.6"/>
    <ellipse cx="44" cy="14" rx="7" ry="9" stroke-width="1.8"/><ellipse cx="156" cy="14" rx="7" ry="9" stroke-width="1.8"/>`) +
    `<text x="100" y="45" text-anchor="middle" font-family="Fraunces" font-weight="700" font-size="20" letter-spacing="3" fill="${C.ink}" filter="url(#rough)">MÉTRO</text>`, w),

  stamp: (w = 230, rot = 6) => svg('0 0 200 230', `<g transform="rotate(${rot} 100 115)">
    <path fill="${C.paper}" d="${perforated(16, 14, 168, 200, 6)}" filter="url(#rough)"/>
    ${wash(`<rect fill="${C.pink}" x="30" y="28" width="140" height="150"/><path fill="${C.blue}" opacity=".7" d="M30 150c30-12 50-6 70 0s40 10 70 0v28H30z"/><circle fill="${C.cream}" cx="128" cy="62" r="18"/>`, 0.8)}
    ${ink(`<rect x="30" y="28" width="140" height="150" stroke-width="2"/>
      <path d="M100 52v10M96 62h8l2 18h-12zM92 80h16M93 82l-4 24M107 82l4 24M86 106h28M88 108l-10 40M112 108l10 40M90 148c2-12 6-18 10-18s8 6 10 18M84 124h32" stroke-width="2"/>`)}
    <text x="100" y="200" text-anchor="middle" font-family="Fraunces" font-style="italic" font-weight="600" font-size="20" fill="${C.ink}">Paris</text></g>`, w),

  postmark: (w = 170) => svg('0 0 170 90', ink(`<circle cx="120" cy="45" r="34" stroke-width="2"/><circle cx="120" cy="45" r="27" stroke-width="1.2"/>
    <path d="M4 28q10-8 20 0t20 0 20 0 20 0M4 45q10-8 20 0t20 0 20 0 20 0M4 62q10-8 20 0t20 0 20 0 20 0" stroke-width="2"/>`, 2) +
    `<text x="120" y="42" text-anchor="middle" font-family="DM Sans" font-weight="700" font-size="10" letter-spacing="1.5" fill="${C.ink}" opacity=".8">PARIS</text><text x="120" y="56" text-anchor="middle" font-family="DM Sans" font-weight="700" font-size="9" letter-spacing="1.5" fill="${C.ink}" opacity=".8">B&amp;B</text>`, w, 'opacity:.75'),

  heart: (w = 50, col = C.pinkDeep) => svg('0 0 50 46', `<g filter="url(#rough)" stroke="${col}" stroke-width="3"><path d="M25 42C10 31 4 22 6 13c2-8 13-11 19-2 6-9 17-6 19 2 2 9-4 18-19 29z"/></g>`, w),
  star: (w = 44, col = C.gold) => svg('0 0 50 50', wash(`<path fill="${col}" d="M25 4l6 14 15 1-11 10 4 15-14-8-13 8 3-15L4 19l15-1z"/>`, 0.9) + ink(`<path d="M25 4l6 14 15 1-11 10 4 15-14-8-13 8 3-15L4 19l15-1z" stroke-width="1.8"/>`), w),
  sparks: (w = 70, col = C.tan, flip = false) => svg('0 0 70 60', `<g filter="url(#rough)" stroke="${col}" stroke-width="4" ${flip ? 'transform="scale(-1 1) translate(-70 0)"' : ''}><path d="M10 50L26 34M8 26l22 2M28 6l6 18"/></g>`, w),
  swash: (w = 400, col = C.pink) => svg('0 0 400 30', `<g filter="url(#wash)"><path d="M6 20C90 8 250 4 394 14" stroke="${col}" stroke-width="9" opacity=".95"/></g>`, w),
  plane: (w = 200) => svg('0 0 200 120', ink(`<path d="M8 110c30-10 50-40 40-60s-34 0-20 18 60 12 90-20" stroke-width="2" stroke-dasharray="7 9"/><path d="M128 44l58-30-30 54-8-18zM148 50l38-36" stroke-width="2.2"/>`), w),
  waves: (w = 150) => svg('0 0 150 50', ink(`<path d="M4 12q12-9 24 0t24 0 24 0 24 0 24 0 24 0M4 30q12-9 24 0t24 0 24 0 24 0 24 0 24 0" stroke-width="2.2"/>`), w, 'opacity:.55'),
  leafSprig: (w = 120) => svg('0 0 120 120', wash(`<path fill="#A8B59A" d="M30 70c-14-4-22-18-18-30 14 2 22 14 18 30zM52 52c-4-14 2-28 14-32 4 14-2 26-14 32zM60 86c4-14 18-22 30-18-2 14-16 22-30 18z"/>`, 0.7) + ink(`<path d="M10 110C40 90 60 60 70 20" stroke-width="2"/><path d="M30 70c-14-4-22-18-18-30 14 2 22 14 18 30zM52 52c-4-14 2-28 14-32 4 14-2 26-14 32zM60 86c4-14 18-22 30-18-2 14-16 22-30 18z" stroke-width="1.6"/>`), w),

  // simple icons for callouts (drawn on a 60x60 grid)
  ico: {
    tickets: () => wash(`<path fill="${C.pink}" d="M6 18h40v8a5 5 0 0 0 0 10v8H6v-8a5 5 0 0 0 0-10z" transform="rotate(-10 26 31)"/><path fill="${C.gold}" d="M14 24h40v8a5 5 0 0 0 0 10v8H14v-8a5 5 0 0 0 0-10z"/>`) + ink(`<path d="M14 24h40v8a5 5 0 0 0 0 10v8H14v-8a5 5 0 0 0 0-10z"/><path d="M24 24v26" stroke-dasharray="3 4" stroke-width="1.6"/><path d="M38 31l2 4 4 .5-3 3 1 4-4-2-4 2 1-4-3-3 4-.5z" stroke-width="1.5"/>`),
    laptop: () => wash(`<rect fill="${C.blue}" x="12" y="14" width="36" height="24" rx="2"/>`) + ink(`<rect x="12" y="14" width="36" height="24" rx="2"/><path d="M6 44h48l-4 5H10z"/><circle cx="30" cy="26" r="7" stroke-width="1.6"/><path d="M23 26h14M30 19c-3 4-3 10 0 14 3-4 3-10 0-14" stroke-width="1.4"/>`),
    phone: () => wash(`<rect fill="${C.pink}" x="19" y="8" width="22" height="44" rx="4"/>`) + ink(`<rect x="19" y="8" width="22" height="44" rx="4"/><path d="M27 12h6M28 47h4"/><path d="M30 34c-5-4-7-6-6-9 1-2 4-3 6 0 2-3 5-2 6 0 1 3-1 5-6 9z" stroke-width="1.6"/>`),
    sync: () => wash(`<circle fill="${C.blue}" cx="30" cy="30" r="17" opacity=".6"/>`) + ink(`<path d="M46 26a17 17 0 0 0-31-6M14 34a17 17 0 0 0 31 6"/><path d="M15 12v8h8M45 48v-8h-8"/>`, 3),
    envelope: () => wash(`<rect fill="${C.paper}" x="8" y="16" width="44" height="30" rx="2"/><path fill="${C.pinkDeep}" d="M30 34c-5-4-7-6-6-9 1-2 4-3 6 0 2-3 5-2 6 0 1 3-1 5-6 9z"/>`) + ink(`<rect x="8" y="16" width="44" height="30" rx="2"/><path d="M8 18l22 16 22-16"/>`),
    people: () => wash(`<circle fill="${C.blue}" cx="18" cy="22" r="7"/><circle fill="${C.pink}" cx="30" cy="18" r="8"/><circle fill="${C.tan}" cx="42" cy="22" r="7"/><path fill="${C.blue}" d="M6 50c0-10 5-16 12-16s12 6 12 16z"/><path fill="${C.tan}" d="M30 50c0-10 5-16 12-16s12 6 12 16z"/><path fill="${C.pink}" d="M17 50c0-12 6-19 13-19s13 7 13 19z"/>`) + ink(`<circle cx="30" cy="18" r="8"/><path d="M17 50c0-12 6-19 13-19s13 7 13 19"/><circle cx="16" cy="22" r="6" stroke-width="1.6"/><circle cx="44" cy="22" r="6" stroke-width="1.6"/>`),
    bulb: () => wash(`<path fill="${C.gold}" d="M30 8c-10 0-17 7-17 16 0 7 4 11 7 14v6h20v-6c3-3 7-7 7-14 0-9-7-16-17-16z"/>`, 0.7) + ink(`<path d="M30 8c-10 0-17 7-17 16 0 7 4 11 7 14v6h20v-6c3-3 7-7 7-14 0-9-7-16-17-16z"/><path d="M22 49h16M24 54h12M26 38c0-6 1-12 4-14 3 2 4 8 4 14" stroke-width="1.8"/>`),
    heart: () => wash(`<path fill="${C.pinkDeep}" d="M30 50C14 39 8 30 10 21c2-8 13-11 20-2 7-9 18-6 20 2 2 9-4 18-20 29z"/>`, 0.8) + ink(`<path d="M30 50C14 39 8 30 10 21c2-8 13-11 20-2 7-9 18-6 20 2 2 9-4 18-20 29z"/>`),
    calendar: () => wash(`<rect fill="${C.paper}" x="10" y="14" width="40" height="36" rx="4"/><rect fill="${C.pink}" x="10" y="14" width="40" height="10" rx="3"/>`) + ink(`<rect x="10" y="14" width="40" height="36" rx="4"/><path d="M10 24h40M20 9v9M40 9v9"/><path d="M17 32h4M28 32h4M39 32h4M17 41h4M28 41h4" stroke-width="2.6"/>`),
    ticket: () => wash(`<path fill="${C.tanLight}" d="M8 20h44v7a5 5 0 0 0 0 10v7H8v-7a5 5 0 0 0 0-10z"/>`) + ink(`<path d="M8 20h44v7a5 5 0 0 0 0 10v7H8v-7a5 5 0 0 0 0-10z"/><path d="M20 20v24" stroke-dasharray="3 4" stroke-width="1.6"/><path d="M27 29h16M27 36h11" stroke-width="2"/>`),
    signpost: () => wash(`<path fill="${C.blue}" d="M30 12h20l6 6-6 6H30z"/><path fill="${C.pink}" d="M30 28H10l-6 6 6 6h20z"/>`) + ink(`<path d="M30 6v48M22 54h16"/><path d="M30 12h20l6 6-6 6H30zM30 28H10l-6 6 6 6h20z"/>`),
    receipt: () => wash(`<path fill="${C.paper}" d="M14 6h32v48l-5-4-5 4-5-4-5 4-5-4-4 4-3-2z"/>`) + ink(`<path d="M14 6h32v48l-5-4-5 4-5-4-5 4-5-4-4 4-3-2z"/><path d="M21 17h18M21 25h18M21 33h12" stroke-width="2"/>`),
    pie: () => wash(`<circle fill="${C.blue}" cx="30" cy="30" r="20"/><path fill="${C.tan}" d="M30 30V10a20 20 0 0 1 19 14z"/>`) + ink(`<circle cx="30" cy="30" r="20"/><path d="M30 10v20l19-6"/>`),
    chat: () => wash(`<path fill="${C.pink}" d="M8 12h34a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H22l-9 8v-8H8a4 4 0 0 1-4-4V16a4 4 0 0 1 4-4z"/>`) + ink(`<path d="M8 12h34a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H22l-9 8v-8H8a4 4 0 0 1-4-4V16a4 4 0 0 1 4-4z"/><path d="M50 24h2a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4h-3v6l-7-6h-9" stroke-width="1.8"/><path d="M13 21h24M13 28h15" stroke-width="2"/>`),
    clock: () => wash(`<circle fill="${C.blue}" cx="30" cy="31" r="20"/>`, 0.6) + ink(`<circle cx="30" cy="31" r="20"/><path d="M30 19v12l8 6"/><path d="M14 10l-6 6M46 10l6 6"/>`),
    warning: () => wash(`<path fill="${C.pink}" d="M30 8l24 42H6z"/>`) + ink(`<path d="M30 8l24 42H6z"/><path d="M30 24v12M30 43v1" stroke-width="3"/>`),
    euro: () => wash(`<circle fill="${C.gold}" cx="30" cy="30" r="20"/>`, 0.7) + ink(`<circle cx="30" cy="30" r="20"/><path d="M38 21a11 11 0 1 0 0 18M18 27h16M18 33h14" stroke-width="2.4"/>`),
    key: () => wash(`<circle fill="${C.gold}" cx="20" cy="20" r="10"/><path fill="${C.pink}" d="M8 34l-2 14 8 4 6-12z"/>`) + ink(`<circle cx="20" cy="20" r="10"/><circle cx="20" cy="20" r="3"/><path d="M27 27l24 24M42 42l5-5M48 48l5-5"/><path d="M8 34l-2 14 8 4 6-12" stroke-width="1.8"/>`),
    house: () => wash(`<path fill="${C.pink}" d="M10 28L30 10l20 18v24H10z"/>`) + ink(`<path d="M6 30L30 8l24 22M12 26v26h36V26"/><path d="M25 52V38h10v14" stroke-width="2"/>`),
    devices: () => wash(`<rect fill="${C.blue}" x="6" y="12" width="34" height="24" rx="2"/><rect fill="${C.pink}" x="38" y="22" width="16" height="28" rx="3"/>`) + ink(`<rect x="6" y="12" width="34" height="24" rx="2"/><path d="M2 42h32"/><rect x="38" y="22" width="16" height="28" rx="3"/>`),
    map: () => wash(`<path fill="${C.blue}" d="M6 14l16-6 16 6 16-6v38l-16 6-16-6-16 6z" opacity=".7"/>`) + ink(`<path d="M6 14l16-6 16 6 16-6v38l-16 6-16-6-16 6zM22 8v38M38 14v38"/><path d="M44 20c-4 0-6 3-6 6 0 4 6 10 6 10s6-6 6-10c0-3-2-6-6-6z" stroke-width="1.8"/>`),
    suitcase: () => wash(`<rect fill="${C.blue}" x="8" y="18" width="44" height="32" rx="4"/><rect fill="${C.pink}" x="16" y="24" width="10" height="8"/>`) + ink(`<rect x="8" y="18" width="44" height="32" rx="4"/><path d="M22 18v-6h16v6M18 18v32M42 18v32"/>`),
    camera: () => wash(`<rect fill="${C.paper}" x="6" y="16" width="48" height="34" rx="5"/><path fill="${C.pink}" d="M6 40h48v5a5 5 0 0 1-5 5H11a5 5 0 0 1-5-5z"/>`) + ink(`<rect x="6" y="16" width="48" height="34" rx="5"/><circle cx="30" cy="32" r="10"/><circle cx="30" cy="32" r="4" stroke-width="1.6"/><path d="M12 12h10v4M44 22h4"/>`),
  },
};

export function icon(name, size = 70) {
  return `<svg viewBox="0 0 60 60" width="${size}" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${D.ico[name]()}</svg>`;
}

function perforated(x, y, w, h, r) {
  // rectangle edge with bites taken out, like a postage stamp
  const step = r * 2.6; let d = `M${x} ${y}`;
  for (let i = x + step / 2; i < x + w - r; i += step) d += `L${i - r} ${y}a${r} ${r} 0 0 0 ${2 * r} 0`;
  d += `L${x + w} ${y}`;
  for (let j = y + step / 2; j < y + h - r; j += step) d += `L${x + w} ${j - r}a${r} ${r} 0 0 0 0 ${2 * r}`;
  d += `L${x + w} ${y + h}`;
  for (let i = x + w - step / 2; i > x + r; i -= step) d += `L${i + r} ${y + h}a${r} ${r} 0 0 0 ${-2 * r} 0`;
  d += `L${x} ${y + h}`;
  for (let j = y + h - step / 2; j > y + r; j -= step) d += `L${x} ${j + r}a${r} ${r} 0 0 0 0 ${-2 * r}`;
  return d + 'Z';
}
