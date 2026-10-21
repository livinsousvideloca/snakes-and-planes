/* ===================== Engine: values, standards, solver (no DOM) ===================== */
const E_BASE = {
  E6:  [1.0, 1.5, 2.2, 3.3, 4.7, 6.8],
  E12: [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2],
  E24: [1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1]
};
function genE(n) {
  const a = [];
  for (let i = 0; i < n; i++) {
    let v = Math.round(Math.pow(10, i / n) * 100) / 100;
    if (n === 192 && i === 185) v = 9.20; // IEC 60063 exception
    a.push(v);
  }
  return a;
}
E_BASE.E48 = genE(48); E_BASE.E96 = genE(96); E_BASE.E192 = genE(192);
const SERIES_TOL = { E6: 20, E12: 10, E24: 5, E48: 2, E96: 1, E192: 0.5 };
const POWER_RATINGS = [0.125, 0.25, 0.5, 1, 2, 3, 5, 10];

function snap(v, series = 'E24', mode = 'nearest') {
  if (!(v > 0) || !isFinite(v)) return NaN;
  const base = E_BASE[series];
  const d = Math.floor(Math.log10(v) + 1e-12);
  const c = [];
  for (let k = d - 1; k <= d + 1; k++) for (const b of base) c.push(+(b * Math.pow(10, k)).toPrecision(4));
  if (mode === 'up') return c.filter(x => x >= v * (1 - 1e-9)).sort((a, b) => a - b)[0];
  if (mode === 'down') return c.filter(x => x <= v * (1 + 1e-9)).sort((a, b) => b - a)[0];
  let best = NaN, bd = Infinity;
  for (const x of c) { const dd = Math.abs(Math.log(x / v)); if (dd < bd) { bd = dd; best = x; } }
  return best;
}
function isInSeries(v, series) { const s = snap(v, series); return Math.abs(s / v - 1) < 1e-6; }

const PREFIX = { p: 1e-12, n: 1e-9, u: 1e-6, 'µ': 1e-6, 'μ': 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, meg: 1e6, G: 1e9, R: 1, r: 1, '': 1 };
function parseEng(s) {
  if (typeof s === 'number') return s;
  s = String(s ?? '').trim().replace(/\s+/g, '').replace(/,/g, '.').replace(/−/g, '-');
  if (!s) return NaN;
  const m = s.match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)(meg|Meg|MEG|[pnuµμmkKMGRr])?(\d*)([a-zA-ZΩ°%]*)$/);
  if (!m) return NaN;
  const num = m[1], pre = m[2] || '', frac = m[3];
  const p = PREFIX[/^meg$/i.test(pre) ? 'meg' : pre];
  let n;
  if (frac) { if (/[.eE]/.test(num)) return NaN; n = parseFloat(num + '.' + frac); }
  else n = parseFloat(num);
  return n * p;
}
const PRE_OUT = { 9: 'G', 6: 'M', 3: 'k', 0: '', '-3': 'm', '-6': 'µ', '-9': 'n', '-12': 'p' };
function fmtEng(v, unit = '', sig = 3, zero = 1e-12) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  if (!isFinite(v)) return (v < 0 ? '−' : '') + '∞ ' + unit;
  if (Math.abs(v) < zero) return '0 ' + unit;
  let e = Math.floor(Math.log10(Math.abs(v)) / 3) * 3;
  e = Math.max(-12, Math.min(9, e));
  let s = +(v / Math.pow(10, e)).toPrecision(sig);
  if (Math.abs(s) >= 1000 && e < 9) { e += 3; s = +(v / Math.pow(10, e)).toPrecision(sig); }
  return (s < 0 ? '−' : '') + String(Math.abs(s)) + ' ' + PRE_OUT[e] + unit;
}
function fmtNum(v, d = 2) { if (!isFinite(v)) return '—'; const s = v.toFixed(d); return s.startsWith('-') && +s !== 0 ? '−' + s.slice(1) : s.replace(/^-/, ''); }

/* IEC 60062 RKM code: 4k7, 470R, 2R2, 1M0 */
function rkm(v) {
  if (!(v > 0)) return '—';
  let e = Math.floor(Math.log10(v) / 3) * 3; e = Math.max(0, Math.min(9, e));
  if (v < 1) e = 0;
  const L = { 0: 'R', 3: 'k', 6: 'M', 9: 'G' }[e];
  const m = +(v / Math.pow(10, e)).toPrecision(3);
  const [ip, fp] = String(m).split('.');
  if (!fp) return m >= 10 ? ip + L : ip + L + '0';
  return (ip === '0' ? '' : ip) + L + fp;
}
const BAND = [
  { n: 'black', h: '#1b1b1b' }, { n: 'brown', h: '#7a4626' }, { n: 'red', h: '#d12f2f' }, { n: 'orange', h: '#f07c12' },
  { n: 'yellow', h: '#f5c518' }, { n: 'green', h: '#2f8f3e' }, { n: 'blue', h: '#1f5fc4' }, { n: 'violet', h: '#7b3fa8' },
  { n: 'grey', h: '#8b8b8b' }, { n: 'white', h: '#f6f6f6' }
];
const GOLD = { n: 'gold', h: '#c8a23a' }, SILVER = { n: 'silver', h: '#b9bdc3' };
const TOL_BAND = { 20: null, 10: SILVER, 5: GOLD, 2: BAND[2], 1: BAND[1], 0.5: BAND[5], 0.25: BAND[6], 0.1: BAND[7] };
function colorBands(v, tol) {
  if (!(v > 0)) return null;
  const nd = tol <= 2 ? 3 : 2;
  let mult = Math.floor(Math.log10(v) + 1e-9) - (nd - 1);
  let digits = Math.round(v / Math.pow(10, mult));
  if (digits >= Math.pow(10, nd)) { digits = Math.round(digits / 10); mult++; }
  if (mult < -2 || mult > 9) return null;
  const bands = String(digits).padStart(nd, '0').split('').map(d => BAND[+d]);
  bands.push(mult >= 0 ? BAND[mult] : mult === -1 ? GOLD : SILVER);
  const tb = TOL_BAND[tol];
  if (tb) bands.push(tb);
  return bands;
}
/* SMD codes: EIA-96 for E96 values, 3-digit for E24 and coarser */
function smdCode(v, series) {
  if (!(v > 0)) return '—';
  const d = Math.floor(Math.log10(v) + 1e-9);
  if (series === 'E96' || series === 'E48') {
    const base = +(v / Math.pow(10, d)).toPrecision(3);
    const idx = E_BASE.E96.findIndex(x => Math.abs(x - base) < 1e-6);
    if (idx >= 0) {
      const mult = v / (base * 100);
      const letters = { '-3': 'Z', '-2': 'Y', '-1': 'X', 0: 'A', 1: 'B', 2: 'C', 3: 'D', 4: 'E', 5: 'F' };
      const L = letters[Math.round(Math.log10(mult))];
      if (L) return String(idx + 1).padStart(2, '0') + L + ' (EIA-96)';
    }
  }
  if (v < 10) return rkm(v).replace('R', 'R');
  const mult = d - 1; const digits = Math.round(v / Math.pow(10, mult));
  return String(digits) + String(mult);
}
function capCodeEncode(f) {
  const p = f / 1e-12;
  if (!(p > 0)) return '—';
  if (p < 10) return String(+p.toPrecision(2)).replace('.', 'R').replace(/^(\d)$/, '$1R0');
  const mult = Math.floor(Math.log10(p) + 1e-9) - 1;
  let digits = Math.round(p / Math.pow(10, mult));
  if (mult > 7) return '—';
  return String(digits) + String(mult);
}
function capCodeDecode(code) {
  const m = String(code).trim().match(/^(\d)(\d)(\d)$/);
  if (!m) return NaN;
  const c = +m[3];
  const mult = c === 8 ? 0.01 : c === 9 ? 0.1 : Math.pow(10, c);
  return (+m[1] * 10 + +m[2]) * mult * 1e-12;
}

/* ===================== Parts catalog ===================== */
/* LED presets: Vf at 20 mA for generic 5 mm through-hole parts */
const LED_TYPES = {
  red:    { label: 'Red (625 nm)',      vf: 2.0, rs: 10, hex: '#ef3b2c' },
  orange: { label: 'Orange (605 nm)',   vf: 2.0, rs: 10, hex: '#ff8a1c' },
  yellow: { label: 'Yellow (590 nm)',   vf: 2.1, rs: 10, hex: '#ffd21c' },
  green:  { label: 'Green (525 nm)',    vf: 3.0, rs: 15, hex: '#3fdc5a' },
  blue:   { label: 'Blue (470 nm)',     vf: 3.1, rs: 15, hex: '#3a8bff' },
  white:  { label: 'White',             vf: 3.1, rs: 15, hex: '#f4f7ff' },
  ir:     { label: 'Infrared (940 nm)', vf: 1.3, rs: 5,  hex: '#7a3b5a' }
};
const VT = 0.025852; // thermal voltage at 300 K

/*
 * Each entry is a real, purchasable part (or a clearly marked ideal model).
 * type selects the device model; footprint '3inline' or 'dip8' places by one click,
 * with pins listed in footprint order (left to right; DIP pin 1 bottom-left).
 */
const CATALOG = [
  // ---- Passives
  { id: 'R-CF', cat: 'Passives', type: 'R', name: 'Carbon film resistor', mpn: 'CF-25', pkg: 'Axial', spec: '¼ W · ±5% · E24', defaults: { value: 1000, tol: 5, pRating: 0.25 } },
  { id: 'R-MF', cat: 'Passives', type: 'R', name: 'Metal film resistor', mpn: 'MF-25', pkg: 'Axial', spec: '¼ W · ±1% · E96', defaults: { value: 1000, tol: 1, pRating: 0.25 } },
  { id: 'R-MF-H', cat: 'Passives', type: 'R', name: 'Metal film resistor, ½ W', mpn: 'MF-50', pkg: 'Axial', spec: '½ W · ±1% · E96', defaults: { value: 1000, tol: 1, pRating: 0.5 } },
  { id: 'R-MO-1', cat: 'Passives', type: 'R', name: 'Metal oxide resistor, 1 W', mpn: 'MO-1W', pkg: 'Axial', spec: '1 W · ±5%', defaults: { value: 100, tol: 5, pRating: 1 } },
  { id: 'R-MO-2', cat: 'Passives', type: 'R', name: 'Metal oxide resistor, 2 W', mpn: 'MO-2W', pkg: 'Axial', spec: '2 W · ±5%', defaults: { value: 47, tol: 5, pRating: 2 } },
  { id: 'R-WW-5', cat: 'Passives', type: 'R', name: 'Cement wirewound, 5 W', mpn: 'SQP-5W', pkg: 'Axial', spec: '5 W · ±5%', defaults: { value: 10, tol: 5, pRating: 5 } },
  { id: 'C-C0G', cat: 'Passives', type: 'C', name: 'Ceramic capacitor, C0G', mpn: 'C0G/NP0', pkg: 'Radial', spec: '50 V · ±5% · 1 pF–10 nF', defaults: { value: 1e-9, vRating: 50, dielectric: 'C0G' } },
  { id: 'C-X7R', cat: 'Passives', type: 'C', name: 'Ceramic capacitor, X7R', mpn: 'X7R', pkg: 'Radial', spec: '50 V · ±10% · 100 pF–1 µF', defaults: { value: 100e-9, vRating: 50, dielectric: 'X7R' } },
  { id: 'C-FILM', cat: 'Passives', type: 'C', name: 'Polyester film capacitor', mpn: 'MKT', pkg: 'Radial box', spec: '100 V · ±5% · 1 nF–1 µF', defaults: { value: 100e-9, vRating: 100, dielectric: 'film' } },
  { id: 'C-ELEC', cat: 'Passives', type: 'C', name: 'Aluminium electrolytic, 25 V', mpn: 'Radial 105 °C', pkg: 'Radial can', spec: '25 V · ±20% · polarized · ESR 0.3 Ω', defaults: { value: 100e-6, vRating: 25, esr: 0.3, polarized: true } },
  { id: 'C-ELEC-50', cat: 'Passives', type: 'C', name: 'Aluminium electrolytic, 50 V', mpn: 'Radial 105 °C', pkg: 'Radial can', spec: '50 V · ±20% · polarized · ESR 1 Ω', defaults: { value: 10e-6, vRating: 50, esr: 1, polarized: true } },
  { id: 'L-AX', cat: 'Passives', type: 'L', name: 'Axial RF choke', mpn: 'Axial, 1 mH', pkg: 'Axial', spec: '±10% · DCR 3.6 Ω · 150 mA', defaults: { value: 1e-3, dcr: 3.6, iRating: 0.15 } },
  { id: 'L-PWR', cat: 'Passives', type: 'L', name: 'Radial power inductor', mpn: 'Radial drum core', pkg: 'Radial', spec: '±20% · DCR 0.12 Ω · 1.5 A', defaults: { value: 100e-6, dcr: 0.12, iRating: 1.5 } },
  { id: 'L-IDEAL', cat: 'Passives', type: 'L', name: 'Ideal inductor', mpn: 'Model only', pkg: '—', spec: 'No winding resistance', defaults: { value: 10e-3, dcr: 0, iRating: 1 } },
  // ---- Controls
  { id: 'POT-3386', cat: 'Controls', type: 'POT', name: 'Trimmer potentiometer', mpn: 'Bourns 3386P', pkg: '3-pin, 2.54 mm', spec: 'Linear · ½ W', defaults: { value: 10000, pos: 0.5, pRating: 0.5 }, footprint: '3inline', pins: ['1', 'W', '3'] },
  { id: 'POT-RV09', cat: 'Controls', type: 'POT', name: 'Panel potentiometer', mpn: 'RV09', pkg: '3-pin', spec: 'Linear · 0.05 W', defaults: { value: 10000, pos: 0.5, pRating: 0.05 }, footprint: '3inline', pins: ['1', 'W', '3'] },
  { id: 'SW-SLIDE', cat: 'Controls', type: 'SW', name: 'Slide switch (SPST)', mpn: 'SS12D00', pkg: 'Through-hole', spec: '0.3 A at 50 V DC', defaults: { closed: true, iRating: 0.3, ron: 0.03 } },
  { id: 'SW-TACT', cat: 'Controls', type: 'SW', name: 'Tactile push button', mpn: 'Omron B3F, 6 mm', pkg: 'Through-hole', spec: '50 mA at 12 V DC · momentary', defaults: { closed: false, iRating: 0.05, ron: 0.1, momentary: true } },
  // ---- Sources
  { id: 'V-BENCH', cat: 'Sources', type: 'VDC', name: 'Bench supply', mpn: '0–30 V, 3 A', pkg: 'Clip leads', spec: 'Constant voltage with current limit', defaults: { value: 5, iLimit: 1 } },
  { id: 'V-IDEAL', cat: 'Sources', type: 'VDC', name: 'Ideal DC source', mpn: 'Model only', pkg: '—', spec: 'No internal resistance, no limit', defaults: { value: 5 } },
  { id: 'V-9V', cat: 'Sources', type: 'VDC', name: '9 V battery', mpn: 'PP3 alkaline', pkg: 'Snap clip', spec: 'About 1.7 Ω internal resistance', defaults: { value: 9, rint: 1.7 } },
  { id: 'V-4AA', cat: 'Sources', type: 'VDC', name: '4 × AA battery pack', mpn: 'Alkaline AA', pkg: 'Wire leads', spec: '6 V · about 0.6 Ω', defaults: { value: 6, rint: 0.6 } },
  { id: 'V-USB', cat: 'Sources', type: 'VDC', name: 'USB port', mpn: 'USB 2.0', pkg: 'Breakout', spec: '5 V · 500 mA', defaults: { value: 5, iLimit: 0.5 } },
  { id: 'V-CR2032', cat: 'Sources', type: 'VDC', name: 'Coin cell', mpn: 'CR2032', pkg: 'Holder', spec: '3 V · about 15 Ω', defaults: { value: 3, rint: 15 } },
  { id: 'VAC-GEN', cat: 'Sources', type: 'VAC', name: 'Function generator', mpn: '50 Ω output', pkg: 'BNC to clips', spec: 'Sine · rms amplitude', defaults: { value: 1, phase: 0, rint: 50 } },
  { id: 'VAC-IDEAL', cat: 'Sources', type: 'VAC', name: 'Ideal AC source', mpn: 'Model only', pkg: '—', spec: 'Sine · rms amplitude', defaults: { value: 1, phase: 0 } },
  // ---- Semiconductors
  { id: 'D-1N4148', cat: 'Semiconductors', type: 'D', name: 'Small-signal diode', mpn: '1N4148', pkg: 'DO-35 glass', spec: '100 V · 300 mA · 4 ns', body: 'glass', model: { Is: 2.52e-9, N: 1.752, Rs: 0.568, BV: 100, IBV: 100e-6 }, rating: { ifMax: 0.3, vrMax: 100 } },
  { id: 'D-1N4001', cat: 'Semiconductors', type: 'D', name: 'Rectifier diode', mpn: '1N4001', pkg: 'DO-41', spec: '50 V · 1 A', body: 'black', model: { Is: 14.11e-9, N: 1.984, Rs: 0.0337, BV: 50, IBV: 5e-6 }, rating: { ifMax: 1, vrMax: 50 } },
  { id: 'D-1N4007', cat: 'Semiconductors', type: 'D', name: 'Rectifier diode', mpn: '1N4007', pkg: 'DO-41', spec: '1000 V · 1 A', body: 'black', model: { Is: 14.11e-9, N: 1.984, Rs: 0.0337, BV: 1000, IBV: 5e-6 }, rating: { ifMax: 1, vrMax: 1000 } },
  { id: 'D-1N5819', cat: 'Semiconductors', type: 'D', name: 'Schottky diode', mpn: '1N5819', pkg: 'DO-41', spec: '40 V · 1 A · Vf 0.45 V', body: 'black', model: { Is: 1.25e-5, N: 1.37, Rs: 0.05, BV: 40, IBV: 1e-3 }, rating: { ifMax: 1, vrMax: 40 } },
  { id: 'D-1N4728A', cat: 'Semiconductors', type: 'D', name: 'Zener diode, 3.3 V', mpn: '1N4728A', pkg: 'DO-41', spec: '1 W · 3.3 V at 76 mA', body: 'zener', zener: true, model: { Is: 1e-14, N: 1, Rs: 0.5, BV: 3.3, IBV: 0.076, NBV: 29.4 }, rating: { pdMax: 1, ifMax: 1 } },
  { id: 'D-1N4733A', cat: 'Semiconductors', type: 'D', name: 'Zener diode, 5.1 V', mpn: '1N4733A', pkg: 'DO-41', spec: '1 W · 5.1 V at 49 mA', body: 'zener', zener: true, model: { Is: 1e-14, N: 1, Rs: 0.5, BV: 5.1, IBV: 0.049, NBV: 13.3 }, rating: { pdMax: 1, ifMax: 1 } },
  { id: 'D-1N4742A', cat: 'Semiconductors', type: 'D', name: 'Zener diode, 12 V', mpn: '1N4742A', pkg: 'DO-41', spec: '1 W · 12 V at 21 mA', body: 'zener', zener: true, model: { Is: 1e-14, N: 1, Rs: 0.5, BV: 12, IBV: 0.021, NBV: 7.3 }, rating: { pdMax: 1, ifMax: 1 } },
  ...Object.entries(LED_TYPES).map(([k, t]) => ({ id: 'LED-' + k, cat: 'Semiconductors', type: 'LED', name: '5 mm LED, ' + t.label.split(' (')[0].toLowerCase(), mpn: 'Generic 5 mm', pkg: 'T-1¾', spec: `Vf ${t.vf} V at 20 mA · 20 mA max`, defaults: { color: k, ifMax: 0.02 } })),
  { id: 'Q-2N3904', cat: 'Semiconductors', type: 'BJT', name: 'NPN transistor', mpn: '2N3904', pkg: 'TO-92', spec: '40 V · 200 mA · hFE about 200', footprint: '3inline', pins: ['E', 'B', 'C'], model: { pol: 1, Is: 6.734e-15, BF: 200, BR: 0.737, VAF: 74, IKF: 0.0668 }, rating: { icMax: 0.2, vceoMax: 40, pdMax: 0.625 } },
  { id: 'Q-2N2222A', cat: 'Semiconductors', type: 'BJT', name: 'NPN transistor', mpn: 'PN2222A', pkg: 'TO-92', spec: '40 V · 600 mA · hFE about 200', footprint: '3inline', pins: ['E', 'B', 'C'], model: { pol: 1, Is: 14.34e-15, BF: 200, BR: 6.09, VAF: 74, IKF: 0.285 }, rating: { icMax: 0.6, vceoMax: 40, pdMax: 0.625 } },
  { id: 'Q-BC547B', cat: 'Semiconductors', type: 'BJT', name: 'NPN transistor', mpn: 'BC547B', pkg: 'TO-92 (C-B-E)', spec: '45 V · 100 mA · hFE about 290', footprint: '3inline', pins: ['C', 'B', 'E'], model: { pol: 1, Is: 7.05e-15, BF: 290, BR: 3, VAF: 63, IKF: 0.08 }, rating: { icMax: 0.1, vceoMax: 45, pdMax: 0.5 } },
  { id: 'Q-2N3906', cat: 'Semiconductors', type: 'BJT', name: 'PNP transistor', mpn: '2N3906', pkg: 'TO-92', spec: '−40 V · −200 mA · hFE about 180', footprint: '3inline', pins: ['E', 'B', 'C'], model: { pol: -1, Is: 1.41e-15, BF: 180, BR: 4.98, VAF: 18.7, IKF: 0.08 }, rating: { icMax: 0.2, vceoMax: 40, pdMax: 0.625 } },
  { id: 'Q-BC557B', cat: 'Semiconductors', type: 'BJT', name: 'PNP transistor', mpn: 'BC557B', pkg: 'TO-92 (C-B-E)', spec: '−45 V · −100 mA · hFE about 290', footprint: '3inline', pins: ['C', 'B', 'E'], model: { pol: -1, Is: 3e-15, BF: 290, BR: 3, VAF: 40, IKF: 0.08 }, rating: { icMax: 0.1, vceoMax: 45, pdMax: 0.5 } },
  { id: 'M-2N7000', cat: 'Semiconductors', type: 'MOS', name: 'N-channel MOSFET', mpn: '2N7000', pkg: 'TO-92 (S-G-D)', spec: '60 V · 200 mA · Vth about 2.1 V', footprint: '3inline', pins: ['S', 'G', 'D'], model: { pol: 1, Vto: 2.1, K: 0.105, lambda: 0.02 }, rating: { idMax: 0.2, vdsMax: 60, pdMax: 0.4, vgsMax: 20 } },
  { id: 'M-IRLZ44N', cat: 'Semiconductors', type: 'MOS', name: 'N-channel logic-level MOSFET', mpn: 'IRLZ44N', pkg: 'TO-220 (G-D-S)', spec: '55 V · 47 A · 22 mΩ at 5 V', footprint: '3inline', pins: ['G', 'D', 'S'], model: { pol: 1, Vto: 1.5, K: 13, lambda: 0.005 }, rating: { idMax: 47, vdsMax: 55, pdMax: 2, vgsMax: 16 } },
  // ---- ICs
  { id: 'U-LM358', cat: 'ICs', type: 'OPAMP', name: 'Dual op-amp', mpn: 'LM358', pkg: 'DIP-8', spec: '1 MHz · 3–32 V single supply · output swings to V−', footprint: 'dip8', units: [{ out: 0, inn: 1, inp: 2 }, { out: 6, inn: 5, inp: 4 }], vn: 3, vp: 7, pins: ['1OUT', '1IN−', '1IN+', 'V−', '2IN+', '2IN−', '2OUT', 'V+'], model: { A0: 1e5, GBW: 1e6, headLo: 0.02, headHi: 1.5, Ilim: 0.03, Iq: 0.0007, Ro: 50 }, rating: { vsMax: 32, vsMin: 3 } },
  { id: 'U-TL072', cat: 'ICs', type: 'OPAMP', name: 'Dual JFET op-amp', mpn: 'TL072', pkg: 'DIP-8', spec: '3 MHz · ±18 V max · not rail-to-rail', footprint: 'dip8', units: [{ out: 0, inn: 1, inp: 2 }, { out: 6, inn: 5, inp: 4 }], vn: 3, vp: 7, pins: ['1OUT', '1IN−', '1IN+', 'V−', '2IN+', '2IN−', '2OUT', 'V+'], model: { A0: 2e5, GBW: 3e6, headLo: 1.5, headHi: 1.5, Ilim: 0.03, Iq: 0.0028, Ro: 50 }, rating: { vsMax: 36, vsMin: 7 } },
  { id: 'U-NE5532', cat: 'ICs', type: 'OPAMP', name: 'Dual low-noise op-amp', mpn: 'NE5532', pkg: 'DIP-8', spec: '10 MHz · ±22 V max', footprint: 'dip8', units: [{ out: 0, inn: 1, inp: 2 }, { out: 6, inn: 5, inp: 4 }], vn: 3, vp: 7, pins: ['1OUT', '1IN−', '1IN+', 'V−', '2IN+', '2IN−', '2OUT', 'V+'], model: { A0: 1e5, GBW: 10e6, headLo: 2, headHi: 2, Ilim: 0.038, Iq: 0.008, Ro: 50 }, rating: { vsMax: 44, vsMin: 10 } },
  { id: 'U-MCP6002', cat: 'ICs', type: 'OPAMP', name: 'Dual rail-to-rail op-amp', mpn: 'MCP6002', pkg: 'DIP-8', spec: '1 MHz · 1.8–6 V · rail-to-rail in/out', footprint: 'dip8', units: [{ out: 0, inn: 1, inp: 2 }, { out: 6, inn: 5, inp: 4 }], vn: 3, vp: 7, pins: ['1OUT', '1IN−', '1IN+', 'V−', '2IN+', '2IN−', '2OUT', 'V+'], model: { A0: 1e5, GBW: 1e6, headLo: 0.025, headHi: 0.025, Ilim: 0.023, Iq: 0.0002, Ro: 50 }, rating: { vsMax: 6, vsMin: 1.8 } },
  { id: 'U-LM741', cat: 'ICs', type: 'OPAMP', name: 'Single op-amp', mpn: 'LM741', pkg: 'DIP-8', spec: '1 MHz · ±18 V max · classic', footprint: 'dip8', units: [{ out: 5, inn: 1, inp: 2 }], vn: 3, vp: 6, pins: ['NULL', 'IN−', 'IN+', 'V−', 'NULL', 'OUT', 'V+', 'NC'], model: { A0: 2e5, GBW: 1e6, headLo: 2, headHi: 2, Ilim: 0.025, Iq: 0.0017, Ro: 75 }, rating: { vsMax: 36, vsMin: 10 } },
  { id: 'U-L7805', cat: 'ICs', type: 'REG', name: '5 V linear regulator', mpn: 'L7805', pkg: 'TO-220 (I-G-O)', spec: '1.5 A · 2 V dropout · 35 V max in', footprint: '3inline', pins: ['IN', 'GND', 'OUT'], model: { kind: 'fixed', Vreg: 5, Vdo: 2, Iq: 0.005, Ro: 0.01, Ilim: 2.2 }, rating: { iMax: 1.5, vinMax: 35, pdMax: 2 } },
  { id: 'U-L7812', cat: 'ICs', type: 'REG', name: '12 V linear regulator', mpn: 'L7812', pkg: 'TO-220 (I-G-O)', spec: '1.5 A · 2 V dropout · 35 V max in', footprint: '3inline', pins: ['IN', 'GND', 'OUT'], model: { kind: 'fixed', Vreg: 12, Vdo: 2, Iq: 0.005, Ro: 0.01, Ilim: 2.2 }, rating: { iMax: 1.5, vinMax: 35, pdMax: 2 } },
  { id: 'U-LM317', cat: 'ICs', type: 'REG', name: 'Adjustable regulator', mpn: 'LM317T', pkg: 'TO-220 (A-O-I)', spec: '1.25–37 V · 1.5 A · needs 10 mA load', footprint: '3inline', pins: ['ADJ', 'OUT', 'IN'], model: { kind: 'adj', Vref: 1.25, Vdo: 2, Iadj: 50e-6, Ro: 0.01, Ilim: 2.2 }, rating: { iMax: 1.5, vdiffMax: 40, pdMax: 2, iMin: 0.01 } },
  { id: 'U-LM1117-33', cat: 'ICs', type: 'REG', name: '3.3 V LDO regulator', mpn: 'LM1117T-3.3', pkg: 'TO-220 (G-O-I)', spec: '800 mA · 1.1 V dropout · 15 V max in', footprint: '3inline', pins: ['GND', 'OUT', 'IN'], model: { kind: 'fixed', Vreg: 3.3, Vdo: 1.1, Iq: 0.005, Ro: 0.01, Ilim: 1.2 }, rating: { iMax: 0.8, vinMax: 15, pdMax: 1.5 } }
];
const CATALOG_BY_ID = Object.fromEntries(CATALOG.map(c => [c.id, c]));
const DEFAULT_MODEL = { R: 'R-CF', C: 'C-X7R', L: 'L-IDEAL', LED: 'LED-red', VDC: 'V-IDEAL', VAC: 'VAC-IDEAL' };
function catalogOf(p) { return CATALOG_BY_ID[p.model] || CATALOG_BY_ID[DEFAULT_MODEL[p.type]] || null; }
function ledModel(color) {
  const t = LED_TYPES[color] || LED_TYPES.red, N = 2;
  return { Is: 0.02 / Math.exp((t.vf - 0.02 * t.rs) / (N * VT)), N, Rs: t.rs, BV: 20, IBV: 1e-5 };
}

/* ----- Breadboard topology ----- */
const RAILS = ['TP', 'TN', 'BN', 'BP'];
const COLS = 30;
function parseHole(k) { const m = /^(TP|TN|BP|BN|[a-j])(\d+)$/.exec(k); return m ? { r: m[1], c: +m[2] } : null; }
function baseNetOfHole(k) {
  const h = parseHole(k);
  if (!h) return null;
  if (RAILS.includes(h.r)) return h.r;
  return ('abcde'.includes(h.r) ? 'U' : 'L') + h.c;
}
function holesOfBaseNet(b) {
  if (RAILS.includes(b)) return Array.from({ length: COLS }, (_, i) => b + (i + 1));
  const c = +b.slice(1);
  return (b[0] === 'U' ? 'abcde' : 'fghij').split('').map(r => r + c);
}
/* Holes a footprint part occupies when anchored at a hole; null if it does not fit */
function footprintHoles(footprint, anchor) {
  const h = parseHole(anchor);
  if (!h || RAILS.includes(h.r)) return null;
  if (footprint === '3inline') return h.c + 2 <= COLS ? [0, 1, 2].map(i => h.r + (h.c + i)) : null;
  if (footprint === 'dip8') {
    if (h.c + 3 > COLS) return null;
    const c = h.c;
    return ['f' + c, 'f' + (c + 1), 'f' + (c + 2), 'f' + (c + 3), 'e' + (c + 3), 'e' + (c + 2), 'e' + (c + 1), 'e' + c];
  }
  return null;
}
function leadsOf(p) { return p.pins ? p.pins : p.b ? [p.a, p.b] : [p.a]; }

/* ----- linear algebra ----- */
function csolve(A, b) {
  const n = b.length;
  for (let k = 0; k < n; k++) {
    let p = k, pm = 0;
    for (let i = k; i < n; i++) { const m = Math.hypot(A[i][k][0], A[i][k][1]); if (m > pm) { pm = m; p = i; } }
    if (pm < 1e-20) return null;
    if (p !== k) { [A[k], A[p]] = [A[p], A[k]]; [b[k], b[p]] = [b[p], b[k]]; }
    const pr = A[k][k][0], pi = A[k][k][1], d = pr * pr + pi * pi;
    for (let i = k + 1; i < n; i++) {
      const ar = A[i][k][0], ai = A[i][k][1];
      if (ar === 0 && ai === 0) continue;
      const fr = (ar * pr + ai * pi) / d, fi = (ai * pr - ar * pi) / d;
      for (let j = k; j < n; j++) {
        const xr = A[k][j][0], xi = A[k][j][1];
        A[i][j] = [A[i][j][0] - (fr * xr - fi * xi), A[i][j][1] - (fr * xi + fi * xr)];
      }
      b[i] = [b[i][0] - (fr * b[k][0] - fi * b[k][1]), b[i][1] - (fr * b[k][1] + fi * b[k][0])];
    }
  }
  const x = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let sr = b[i][0], si = b[i][1];
    for (let j = i + 1; j < n; j++) { const [ar, ai] = A[i][j], [xr, xi] = x[j]; sr -= ar * xr - ai * xi; si -= ar * xi + ai * xr; }
    const [pr, pi] = A[i][i], d = pr * pr + pi * pi;
    x[i] = [(sr * pr + si * pi) / d, (si * pr - sr * pi) / d];
  }
  return x;
}
/* real dense solve on a row-major Float64Array, in place */
function rsolve(A, b, n) {
  for (let k = 0; k < n; k++) {
    let p = k, pm = Math.abs(A[k * n + k]);
    for (let i = k + 1; i < n; i++) { const m = Math.abs(A[i * n + k]); if (m > pm) { pm = m; p = i; } }
    if (pm < 1e-18) return null;
    if (p !== k) {
      for (let j = 0; j < n; j++) { const t = A[k * n + j]; A[k * n + j] = A[p * n + j]; A[p * n + j] = t; }
      const t = b[k]; b[k] = b[p]; b[p] = t;
    }
    const piv = A[k * n + k];
    for (let i = k + 1; i < n; i++) {
      const f = A[i * n + k] / piv;
      if (f === 0) continue;
      for (let j = k; j < n; j++) A[i * n + j] -= f * A[k * n + j];
      b[i] -= f * b[k];
    }
  }
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i];
    for (let j = i + 1; j < n; j++) s -= A[i * n + j] * x[j];
    x[i] = s / A[i * n + i];
  }
  return x;
}
const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cdiv = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
const cabs = a => Math.hypot(a[0], a[1]);
const cdeg = a => Math.atan2(a[1], a[0]) * 180 / Math.PI;

const ELEMENT_TYPES = ['R', 'C', 'L', 'LED', 'D', 'VDC', 'VAC', 'SW', 'POT', 'BJT', 'MOS', 'OPAMP', 'REG'];
const GMIN = 1e-12;

/* ----- device equations (currents flowing INTO each pin) ----- */
const XMAX = 80;
const limexp = x => x < XMAX ? Math.exp(x) : Math.exp(XMAX) * (1 + x - XMAX);
const dlimexp = x => Math.exp(Math.min(x, XMAX));
const softplus = x => x > 30 ? x : Math.log1p(Math.exp(x));
const smin = (a, b, e = 0.05) => (a + b - Math.sqrt((a - b) * (a - b) + e * e)) / 2;
const smax = (a, b, e = 0.05) => (a + b + Math.sqrt((a - b) * (a - b) + e * e)) / 2;

function junctionI(vj, m) {
  const nvt = m.N * VT;
  let i = m.Is * (limexp(vj / nvt) - 1), g = m.Is / nvt * dlimexp(vj / nvt);
  if (m.BV) {
    const nb = (m.NBV || 1) * VT;
    i -= m.IBV * (limexp(-(vj + m.BV) / nb) - Math.exp(-m.BV / nb));
    g += m.IBV / nb * dlimexp(-(vj + m.BV) / nb);
  }
  return [i, g];
}
/* diode with series resistance: solve vj + Rs·I(vj) = v for the junction voltage */
function diodeI(v, m) {
  if (!(m.Rs > 0)) return junctionI(v, m)[0];
  let lo = Math.min(0, v), hi = Math.max(0, v), vj = v > 0 ? Math.min(v, 0.6) : v;
  for (let k = 0; k < 100; k++) {
    const [i, g] = junctionI(vj, m), f = vj + m.Rs * i - v;
    if (Math.abs(f) < 1e-12) break;
    if (f > 0) hi = vj; else lo = vj;
    let nv = vj - f / (1 + m.Rs * g);
    if (!(nv > lo && nv < hi)) nv = (lo + hi) / 2;
    if (Math.abs(nv - vj) < 1e-13) { vj = nv; break; }
    vj = nv;
  }
  return (v - vj) / m.Rs;
}
function bjtI(v, m) { // v = {E,B,C}
  const p = m.pol;
  const vbe = p * (v.B - v.E), vbc = p * (v.B - v.C);
  const icc = m.Is * (limexp(vbe / VT) - 1), iec = m.Is * (limexp(vbc / VT) - 1);
  const q1 = 1 / Math.max(0.1, 1 - vbc / m.VAF);
  const q2 = m.IKF ? Math.max(icc, 0) / m.IKF : 0;
  const qb = q1 / 2 * (1 + Math.sqrt(1 + 4 * q2));
  const it = (icc - iec) / qb, ib = icc / m.BF + iec / m.BR, ic = it - iec / m.BR;
  return { C: p * ic, B: p * ib, E: -p * (ic + ib) };
}
function mosI(v, m) { // v = {S,G,D}
  const p = m.pol;
  let vgs = p * (v.G - v.S), vds = p * (v.D - v.S), sign = 1;
  if (vds < 0) { vgs = p * (v.G - v.D); vds = -vds; sign = -1; }
  const s = 0.02, vov = s * softplus((vgs - m.Vto) / s);
  const id = vds < vov ? m.K * (vov * vds - vds * vds / 2) * (1 + m.lambda * vds) : m.K / 2 * vov * vov * (1 + m.lambda * vds);
  return { D: p * sign * id, S: -p * sign * id, G: 0 };
}
function opampI(v, c) { // v = array of 8 pin voltages
  const m = c.model, I = new Array(8).fill(0), units = [];
  const vhi = v[c.vp] - m.headHi, vlo = v[c.vn] + m.headLo;
  const vc = (vhi + vlo) / 2, vh = Math.max((vhi - vlo) / 2, 0.01);
  const powered = 0.5 * (1 + Math.tanh((v[c.vp] - v[c.vn] - 1) / 0.1)); // an unpowered chip does not drive its output
  for (const u of c.units) {
    const T = vc + vh * Math.tanh(m.A0 * (v[u.inp] - v[u.inn]) / vh);
    const io = powered * m.Ilim * Math.tanh((v[u.out] - T) / m.Ro / m.Ilim);
    const s = 0.5 * (1 + Math.tanh(-io / 1e-3));
    I[u.out] += io; I[c.vp] += -io * s; I[c.vn] += -io * (1 - s);
    units.push({ T, io });
  }
  const iq = m.Iq * 0.5 * (1 + Math.tanh((v[c.vp] - v[c.vn] - 1) / 0.3));
  I[c.vp] += iq; I[c.vn] -= iq;
  return I;
}
function regI(v, c) { // v = {IN, OUT, GND|ADJ}
  const m = c.model;
  const ref = m.kind === 'adj' ? v.ADJ : v.GND;
  let T = smin(ref + (m.kind === 'adj' ? m.Vref : m.Vreg), v.IN - m.Vdo);
  T = smax(T, ref);
  const powered = 0.5 * (1 + Math.tanh((v.IN - ref - 1) / 0.1));
  const io = powered * m.Ilim * Math.tanh((v.OUT - T) / m.Ro / m.Ilim);
  const s = 0.5 * (1 + Math.tanh(-io / 1e-3));
  if (m.kind === 'adj') { const ia = powered * m.Iadj; return { OUT: io, ADJ: -ia - io * (1 - s), IN: -io * s + ia }; }
  const iq = m.Iq * 0.5 * (1 + Math.tanh((v.IN - v.GND - 1) / 0.3));
  return { OUT: io, IN: -io * s + iq, GND: -io * (1 - s) - iq };
}
function limitedSupplyI(vab, p) { // current INTO the + pin
  const ro = p.rint > 0 ? p.rint : 1e-3;
  return -p.iLimit * Math.tanh((p.value - vab) / ro / p.iLimit);
}

/* Build a nonlinear device: pin list and a function from pin voltages to pin currents */
function makeDevice(p) {
  const cat = catalogOf(p);
  if (p.type === 'LED' || p.type === 'D') {
    const m = p.type === 'LED' ? ledModel(p.color) : cat.model;
    return { pins: [p.a, p.b], f: v => { const i = diodeI(v[0] - v[1], m); return [i, -i]; } };
  }
  if (p.type === 'BJT') {
    const names = cat.pins, m = cat.model;
    return { pins: p.pins, f: v => { const o = {}; names.forEach((n, k) => o[n] = v[k]); const r = bjtI(o, m); return names.map(n => r[n]); } };
  }
  if (p.type === 'MOS') {
    const names = cat.pins, m = cat.model;
    return { pins: p.pins, f: v => { const o = {}; names.forEach((n, k) => o[n] = v[k]); const r = mosI(o, m); return names.map(n => r[n]); } };
  }
  if (p.type === 'OPAMP') {
    const inputs = new Set(cat.units.flatMap(u => [u.inp, u.inn]));
    // small-signal step: with ~1e5 open-loop gain a 1e-7 V input step swings the output across the supply-split knee
    return { pins: p.pins, f: v => opampI(v, cat), acCols: inputs, fp: cat.model.GBW / cat.model.A0, hAC: 1e-11 };
  }
  if (p.type === 'REG') {
    const names = cat.pins;
    return { pins: p.pins, f: v => { const o = {}; names.forEach((n, k) => o[n] = v[k]); const r = regI(o, cat); return names.map(n => r[n]); } };
  }
  if (p.type === 'VDC' && p.iLimit > 0) {
    return { pins: [p.a, p.b], f: (v, lam = 1) => { const i = limitedSupplyI(v[0] - v[1], Object.assign({}, p, { value: p.value * lam })); return [i, -i]; } };
  }
  return null;
}

/* Topology: nets after wires, ground choice */
function topology(parts) {
  const parent = new Map();
  const find = x => { if (!parent.has(x)) parent.set(x, x); let r = x; while (parent.get(r) !== r) r = parent.get(r); parent.set(x, r); return r; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(rb, ra); };
  for (const p of parts) for (const k of leadsOf(p)) if (k) find(baseNetOfHole(k));
  for (const p of parts) if (p.type === 'wire') union(baseNetOfHole(p.a), baseNetOfHole(p.b));
  const els = parts.filter(p => ELEMENT_TYPES.includes(p.type));
  let gnd = null, autoGround = false;
  const g = parts.find(p => p.type === 'GND');
  if (g) gnd = find(baseNetOfHole(g.a));
  else {
    const s = els.find(p => p.type === 'VDC') || els.find(p => p.type === 'VAC');
    if (s) { gnd = find(baseNetOfHole(s.b)); autoGround = true; }
  }
  const used = new Set();
  const leadCount = new Map();
  for (const p of els) for (const k of leadsOf(p)) { const r = find(baseNetOfHole(k)); used.add(r); leadCount.set(r, (leadCount.get(r) || 0) + 1); }
  if (gnd === null && used.size) { gnd = [...used][0]; autoGround = true; }
  if (gnd !== null) used.add(gnd);
  return { find, gnd, autoGround, used, leadCount, els, parent };
}
function netName(root, topo) {
  if (root === topo.gnd) return 'GND';
  const members = [...topo.parent.keys()].filter(k => topo.find(k) === root);
  const rail = members.find(m => RAILS.includes(m));
  const pick = rail || members.sort((a, b) => +a.slice(1) - +b.slice(1))[0] || root;
  return netLabel(pick);
}
function netLabel(b) {
  return { TP: 'Top + rail', TN: 'Top − rail', BP: 'Bottom + rail', BN: 'Bottom − rail' }[b]
    || ('Col ' + b.slice(1) + (b[0] === 'U' ? ' a–e' : ' f–j'));
}

/* ----- circuit assembly ----- */
function isIdealBranch(p, mode) {
  if (p.type === 'VDC') return !(p.rint > 0) && !(p.iLimit > 0);
  if (p.type === 'VAC') return !(p.rint > 0);
  if (p.type === 'L') return mode === 'DC' && !(p.dcr > 0);
  return false;
}
function buildContext(topo, mode) {
  const { find, gnd, used, els } = topo;
  const idx = new Map(); let n = 0;
  for (const r of used) if (r !== gnd) idx.set(r, n++);
  const node = k => { const r = find(baseNetOfHole(k)); return r === gnd ? -1 : idx.get(r); };
  const branches = els.filter(p => isIdealBranch(p, mode));
  const devices = [];
  for (const p of els) { const d = makeDevice(p); if (d) { d.part = p; d.nodes = d.pins.map(node); devices.push(d); } }
  return { idx, n, node, branches, devices, N: n + branches.length };
}
/* linear 2-terminal admittance (DC: omega = 0) */
function linearY(p, omega, mode) {
  if (p.type === 'R') return [1 / p.value, 0];
  if (p.type === 'SW') return [p.closed ? 1 / (p.ron || 0.05) : 1e-10, 0];
  if (p.type === 'C') {
    if (mode === 'DC') return [0, 0];
    const zc = [p.esr || 0, -1 / (omega * p.value)];
    return cdiv([1, 0], zc);
  }
  if (p.type === 'L') {
    if (p.dcr > 0) return mode === 'DC' ? [1 / p.dcr, 0] : cdiv([1, 0], [p.dcr, omega * p.value]);
    return mode === 'DC' ? null : [0, -1 / (omega * p.value)];
  }
  if ((p.type === 'VDC' || p.type === 'VAC') && p.rint > 0 && !(p.iLimit > 0)) return [1 / p.rint, 0];
  return null;
}
function potR(p) { const pos = Math.min(1, Math.max(0, p.pos ?? 0.5)); return [Math.max(0.5, p.value * pos), Math.max(0.5, p.value * (1 - pos))]; }

function newtonDC(topo, ctx, lam, gext, x0, maxIt) {
  const { n, N, node, branches, devices } = ctx;
  const A0 = new Float64Array(N * N), b0 = new Float64Array(N);
  const add = (i, j, g) => { if (i >= 0 && j >= 0) A0[i * N + j] += g; };
  const stampG = (i, j, g) => { add(i, i, g); add(j, j, g); add(i, j, -g); add(j, i, -g); };
  for (let i = 0; i < n; i++) A0[i * N + i] += GMIN + gext;
  for (const p of topo.els) {
    if (p.type === 'POT') { const [r1, r2] = potR(p), [a, w, c] = p.pins.map(node); stampG(a, w, 1 / r1); stampG(w, c, 1 / r2); continue; }
    if (!p.b) continue;
    const y = linearY(p, 0, 'DC');
    if (!y) continue;
    const i = node(p.a), j = node(p.b);
    stampG(i, j, y[0]);
    if (p.type === 'VDC' && p.rint > 0 && !(p.iLimit > 0)) { const is = lam * p.value / p.rint; if (i >= 0) b0[i] += is; if (j >= 0) b0[j] -= is; }
  }
  branches.forEach((p, k) => {
    const m = n + k, i = node(p.a), j = node(p.b);
    if (i >= 0) { A0[i * N + m] += 1; A0[m * N + i] += 1; }
    if (j >= 0) { A0[j * N + m] -= 1; A0[m * N + j] -= 1; }
    b0[m] = p.type === 'VDC' ? lam * p.value : 0;
  });
  let x = x0 ? Float64Array.from(x0) : new Float64Array(N);
  const volt = (xx, k) => k < 0 ? 0 : xx[k];
  const residual = xx => {
    const F = new Float64Array(N);
    for (let i = 0; i < N; i++) { let s = -b0[i]; for (let j = 0; j < N; j++) s += A0[i * N + j] * xx[j]; F[i] = s; }
    for (const d of devices) { const I = d.f(d.nodes.map(k => volt(xx, k)), lam); d.nodes.forEach((k, q) => { if (k >= 0) F[k] += I[q]; }); }
    let t = 0; for (let i = 0; i < N; i++) t += F[i] * F[i];
    return t;
  };
  if (!devices.length) { const A = Float64Array.from(A0), b = Float64Array.from(b0); const s = rsolve(A, b, N); return s ? { x: s, ok: true, it: 1 } : { ok: false }; }
  for (let it = 0; it < maxIt; it++) {
    const A = Float64Array.from(A0), b = Float64Array.from(b0);
    for (const d of devices) {
      const v = d.nodes.map(k => volt(x, k));
      const { I, J } = deviceJ(d, v, lam);
      // Newton companion model: J·v_new = J·v0 − I(v0)
      for (let kk = 0; kk < v.length; kk++) {
        const rk = d.nodes[kk];
        if (rk < 0) continue;
        let jv = 0;
        for (let jj = 0; jj < v.length; jj++) {
          const cj = d.nodes[jj];
          jv += J[kk][jj] * v[jj];
          if (cj >= 0) A[rk * N + cj] += J[kk][jj];
        }
        b[rk] += jv - I[kk];
      }
    }
    const xn = rsolve(A, b, N);
    if (!xn || xn.some(z => !isFinite(z))) return { ok: false };
    let maxdv = 0, maxv = 0;
    for (let i = 0; i < n; i++) { maxdv = Math.max(maxdv, Math.abs(xn[i] - x[i])); maxv = Math.max(maxv, Math.abs(xn[i])); }
    // backtracking line search on the KCL residual, with a cap on any single node move
    let alpha = maxdv > 5 ? 5 / maxdv : 1;
    const f0 = residual(x), xprev = x;
    let xt;
    for (let k = 0; k < 30; k++) {
      xt = x.map((xi, i) => xi + alpha * (xn[i] - xi));
      if (residual(xt) <= f0 * (1 - 1e-4 * alpha) || f0 < 1e-15) break;
      alpha /= 2;
    }
    x = xt;
    // SPICE-style tolerances: 1 µV absolute plus 0.1% relative
    let conv = alpha === 1;
    for (let i = 0; i < n && conv; i++) if (Math.abs(xn[i] - xprev[i]) > 1e-6 + 1e-3 * Math.max(Math.abs(xn[i]), Math.abs(xprev[i]))) conv = false;
    // and KCL must actually balance: a current-limited supply has a ~1000 S slope, so a
    // millivolt left on its node is amps of error in its reported current
    if (conv && Math.sqrt(residual(x)) < 1e-7) return { x, ok: true, it: it + 1 };
  }
  return { x, ok: false };
}

/* Starting guess for boards with current-limited supplies: solve once with those supplies
   ideal. From 0 V a limited supply starts out saturated (flat), and Newton can stall there. */
function warmStart(topo, ctx) {
  const lim = topo.els.filter(p => p.type === 'VDC' && p.iLimit > 0);
  if (!lim.length) return null;
  const topo2 = Object.assign({}, topo, { els: topo.els.map(p => lim.includes(p) ? Object.assign({}, p, { iLimit: 0 }) : p) });
  const ctx2 = buildContext(topo2, 'DC');
  const r = solveDC(topo2, ctx2, true);
  if (!r.ok) return null;
  const x0 = new Float64Array(ctx.N);
  for (let i = 0; i < ctx.n; i++) x0[i] = r.x[i];
  ctx.branches.forEach((p, k) => { const k2 = ctx2.branches.findIndex(q => q.id === p.id); if (k2 >= 0) x0[ctx.n + k] = r.x[ctx2.n + k2]; });
  return x0;
}
function solveDC(topo, ctx, noWarm) {
  let r = newtonDC(topo, ctx, 1, 0, null, 150);
  if (r.ok) return Object.assign(r, { method: 'Newton–Raphson' });
  const x0 = noWarm ? null : warmStart(topo, ctx);
  if (x0) { r = newtonDC(topo, ctx, 1, 0, x0, 150); if (r.ok) return Object.assign(r, { method: 'Newton–Raphson (warm start)' }); }
  // source stepping
  let x = null, ok = true;
  for (let k = 1; k <= 20; k++) { const s = newtonDC(topo, ctx, k / 20, 0, x, 150); if (!s.ok) { ok = false; break; } x = s.x; }
  if (ok) return { x, ok: true, method: 'source stepping' };
  // gmin stepping
  x = null;
  let best = null;
  for (let e = -2; e >= -12; e--) {
    const s = newtonDC(topo, ctx, 1, Math.pow(10, e), x, 150);
    if (!s.ok) break;
    x = s.x; best = { x, ok: true, method: 'gmin stepping', leak: Math.pow(10, e) };
  }
  if (best) { const s = newtonDC(topo, ctx, 1, 0, best.x, 150); if (s.ok) return Object.assign(s, { method: 'gmin stepping' }); }
  if (best && best.leak <= 1e-9) return best; // a node is floating; keep the answer with a 1 GΩ (or larger) leak to ground
  return { ok: false };
}

/* numerical Jacobian of a device at pin voltages v */
function deviceJ(d, v, lam = 1, H = 1e-7) {
  const I = d.f(v, lam), J = [];
  for (let k = 0; k < v.length; k++) J.push(new Array(v.length).fill(0));
  for (let jj = 0; jj < v.length; jj++) {
    const vp = v.slice(); vp[jj] += H;
    const Ip = d.f(vp, lam);
    for (let kk = 0; kk < v.length; kk++) J[kk][jj] = (Ip[kk] - I[kk]) / H;
  }
  return { I, J };
}

function solveAC(topo, dcx, freq) {
  const ctx = buildContext(topo, 'AC');
  const { n, N, node, branches, devices } = ctx;
  const omega = 2 * Math.PI * freq;
  const A = Array.from({ length: N }, () => Array.from({ length: N }, () => [0, 0]));
  const b = Array.from({ length: N }, () => [0, 0]);
  const addA = (i, j, y) => { if (i < 0 || j < 0) return; A[i][j][0] += y[0]; A[i][j][1] += y[1]; };
  const stampY = (i, j, y) => { addA(i, i, y); addA(j, j, y); addA(i, j, [-y[0], -y[1]]); addA(j, i, [-y[0], -y[1]]); };
  for (let i = 0; i < n; i++) A[i][i][0] += GMIN;
  const admit = {};
  for (const p of topo.els) {
    if (p.type === 'POT') { const [r1, r2] = potR(p), [a, w, c] = p.pins.map(node); stampY(a, w, [1 / r1, 0]); stampY(w, c, [1 / r2, 0]); continue; }
    if (!p.b) continue;
    const y = linearY(p, omega, 'AC');
    if (!y) continue;
    const i = node(p.a), j = node(p.b);
    stampY(i, j, y); admit[p.id] = y;
    if (p.type === 'VAC' && p.rint > 0) {
      const ph = (p.phase || 0) * Math.PI / 180, is = [p.value * Math.cos(ph) / p.rint, p.value * Math.sin(ph) / p.rint];
      if (i >= 0) { b[i][0] += is[0]; b[i][1] += is[1]; }
      if (j >= 0) { b[j][0] -= is[0]; b[j][1] -= is[1]; }
    }
  }
  branches.forEach((p, k) => {
    const m = n + k, i = node(p.a), j = node(p.b);
    if (i >= 0) { A[i][m][0] += 1; A[m][i][0] += 1; }
    if (j >= 0) { A[j][m][0] -= 1; A[m][j][0] -= 1; }
    if (p.type === 'VAC') { const ph = (p.phase || 0) * Math.PI / 180; b[m] = [p.value * Math.cos(ph), p.value * Math.sin(ph)]; }
  });
  // nonlinear devices: small-signal Jacobian at the DC operating point
  const dcV = k => { const r = topo.find(baseNetOfHole(k)); return r === topo.gnd ? 0 : dcx.nodeV.get(r); };
  const devJ = {};
  for (const d of devices) {
    const v = d.pins.map(dcV);
    const { J } = deviceJ(d, v, 1, d.hAC || 1e-7);
    const H = d.acCols ? [1 / (1 + Math.pow(freq / d.fp, 2)), -(freq / d.fp) / (1 + Math.pow(freq / d.fp, 2))] : null;
    const Jc = J.map(row => row.map((g, jj) => H && d.acCols.has(jj) ? [g * H[0], g * H[1]] : [g, 0]));
    devJ[d.part.id] = Jc;
    d.nodes.forEach((rk, kk) => d.nodes.forEach((cj, jj) => addA(rk, cj, Jc[kk][jj])));
  }
  const x = N ? csolve(A, b) : [];
  if (!x || x.some(z => !isFinite(z[0]) || !isFinite(z[1]))) return null;
  return { x, ctx, admit, devJ, branches };
}

/* Per-part results from a solution. DC: x is Float64Array; AC: x is complex array */
function partResults(topo, ctx, x, mode, extra) {
  const { n, node, branches, devices } = ctx;
  const V = k => { const i = node(k); if (i < 0) return [0, 0]; return mode === 'DC' ? [x[i], 0] : x[i]; };
  const out = {};
  const devBy = new Map(devices.map(d => [d.part.id, d]));
  for (const p of topo.els) {
    const pins = leadsOf(p), pv = pins.map(V);
    let pi; // currents into each pin
    const k = branches.indexOf(p);
    if (k >= 0) { const ib = mode === 'DC' ? [x[n + k], 0] : x[n + k]; pi = [ib, [-ib[0], -ib[1]]]; }
    else if (devBy.has(p.id)) {
      const d = devBy.get(p.id);
      if (mode === 'DC') pi = d.f(pv.map(z => z[0])).map(c => [c, 0]);
      else { const J = extra.devJ[p.id]; pi = J.map(row => row.reduce((s, g, jj) => { const t = cmul(g, pv[jj]); return [s[0] + t[0], s[1] + t[1]]; }, [0, 0])); }
    } else if (p.type === 'POT') {
      const [r1, r2] = potR(p);
      const i1 = [(pv[0][0] - pv[1][0]) / r1, (pv[0][1] - pv[1][1]) / r1], i3 = [(pv[2][0] - pv[1][0]) / r2, (pv[2][1] - pv[1][1]) / r2];
      pi = [i1, [-i1[0] - i3[0], -i1[1] - i3[1]], i3];
    } else {
      const y = mode === 'DC' ? linearY(p, 0, 'DC') : extra.admit[p.id];
      const vab = [pv[0][0] - pv[1][0], pv[0][1] - pv[1][1]];
      let i = y ? cmul(y, vab) : [0, 0];
      if ((p.type === 'VDC' && mode === 'DC') && p.rint > 0) i = [(vab[0] - p.value) / p.rint, 0];
      if (p.type === 'VAC' && mode === 'AC' && p.rint > 0) { const ph = (p.phase || 0) * Math.PI / 180; i = [(vab[0] - p.value * Math.cos(ph)) / p.rint, (vab[1] - p.value * Math.sin(ph)) / p.rint]; }
      pi = [i, [-i[0], -i[1]]];
    }
    let P = 0;
    for (let q = 0; q < pv.length; q++) P += pv[q][0] * pi[q][0] + pv[q][1] * pi[q][1];
    const r = { pinV: pv, pinI: pi, p: P };
    if (pins.length === 2) { r.v = [pv[0][0] - pv[1][0], pv[0][1] - pv[1][1]]; r.i = pi[0]; }
    out[p.id] = r;
  }
  return out;
}

function analyze(parts, opts = {}) {
  const mode = opts.mode || 'DC';
  const freq = opts.freq || 1000;
  const topo = topology(parts);
  const res = { ok: true, mode, freq, errors: [], warnings: [], topo, parts: {}, nodeV: new Map() };
  if (!topo.els.length) { res.empty = true; return res; }
  const vsU = new Map();
  const vf = x => { if (!vsU.has(x)) vsU.set(x, x); let r = x; while (vsU.get(r) !== r) r = vsU.get(r); return r; };
  for (const p of topo.els) {
    const leads = leadsOf(p), roots = leads.map(k => topo.find(baseNetOfHole(k)));
    if (leads.length === 2 && roots[0] === roots[1]) {
      if (isIdealBranch(p, 'DC') || isIdealBranch(p, 'AC')) res.errors.push(`${p.name} is shorted: both leads land on the same connected strip.`);
      else res.warnings.push(`${p.name} is shorted out: both leads are on the same connected strip.`);
      continue;
    }
    if (leads.length === 2 && (isIdealBranch(p, 'DC') || (mode === 'AC' && isIdealBranch(p, 'AC')))) {
      const a = vf(roots[0]), b2 = vf(roots[1]);
      if (a === b2) res.errors.push(`${p.name} closes a loop of ideal sources and inductors with no resistance (in DC an inductor is a short).`);
      else vsU.set(b2, a);
    }
    if (leads.length > 2) {
      const seen = new Map();
      leads.forEach((k, q) => { const r = roots[q]; if (seen.has(r)) res.warnings.push(`${p.name}: pins ${seen.get(r)} and ${(catalogOf(p).pins || [])[q]} are on the same strip, so they are shorted together.`); else seen.set(r, (catalogOf(p).pins || [])[q]); });
    }
    // a dual op-amp with one unit left fully unconnected gets one note instead of three
    const idle = new Set();
    if (p.type === 'OPAMP') catalogOf(p).units.forEach((u, k) => {
      const pins = [u.out, u.inn, u.inp];
      if (pins.every(q => topo.leadCount.get(roots[q]) === 1)) {
        pins.forEach(q => idle.add(q));
        res.warnings.push(`${p.name} unit ${k + 1} is unused. On a real board tie its + input to ground (or mid-supply) and its output to its − input so it doesn't oscillate.`);
      }
    });
    leads.forEach((k, q) => {
      const r = roots[q];
      if (topo.leadCount.get(r) === 1 && r !== topo.gnd && !idle.has(q)) {
        const pinName = p.pins ? (catalogOf(p).pins[q]) : null;
        if (pinName && /^(NC|NULL)$/.test(pinName)) return;
        res.warnings.push(`${p.name} has ${pinName ? 'pin ' + pinName : 'a lead'} in ${netName(r, topo)} that connects to nothing else.`);
      }
    });
  }
  if (!topo.els.some(p => p.type === 'VDC' || p.type === 'VAC')) res.warnings.push('Add a DC supply or AC source to power the circuit.');
  if (res.errors.length) { res.ok = false; return res; }
  const ctx = buildContext(topo, 'DC');
  const dc = solveDC(topo, ctx);
  if (!dc.ok) { res.ok = false; res.errors.push('The DC solution did not converge, even with source and gmin stepping. Check for a floating gate or input, or parts wired in an impossible loop.'); return res; }
  res.method = dc.method;
  if (dc.leak) res.warnings.push(`Some nodes are floating, so they were held with a ${fmtEng(1 / dc.leak, 'Ω')} leak to ground. Connect every IC input and supply pin.`);
  const dcNodeV = new Map();
  for (const [r, i] of ctx.idx) dcNodeV.set(r, dc.x[i]);
  dcNodeV.set(topo.gnd, 0);
  res.dc = { nodeV: dcNodeV, parts: partResults(topo, ctx, dc.x, 'DC') };
  if (mode === 'DC') {
    for (const [r, v] of dcNodeV) res.nodeV.set(r, [v, 0]);
    res.parts = res.dc.parts;
    return res;
  }
  const ac = solveAC(topo, res.dc, freq);
  if (!ac) { res.ok = false; res.errors.push('The AC solution is singular at this frequency.'); return res; }
  for (const [r, i] of ac.ctx.idx) res.nodeV.set(r, ac.x[i]);
  res.nodeV.set(topo.gnd, [0, 0]);
  res.parts = partResults(topo, ac.ctx, ac.x, 'AC', ac);
  if (!topo.els.some(p => p.type === 'VAC')) res.warnings.push('No AC source on the board, so every AC phasor is zero.');
  return res;
}

/* Frequency sweep from the first AC source to a probe net, reusing one DC operating point */
function sweep(parts, probeBase, f0 = 1, f1 = 1e6, ppd = 30) {
  const src = parts.find(p => p.type === 'VAC');
  if (!src) return null;
  const base = analyze(parts, { mode: 'DC' });
  if (!base.ok || base.empty) return null;
  const topo = base.topo;
  const ph = (src.phase || 0) * Math.PI / 180, ref = [src.value * Math.cos(ph), src.value * Math.sin(ph)];
  const root = topo.find(probeBase);
  const pts = [];
  const n = Math.round(Math.log10(f1 / f0) * ppd);
  for (let k = 0; k <= n; k++) {
    const f = f0 * Math.pow(10, k / ppd);
    const ac = solveAC(topo, base.dc, f);
    if (!ac) return null;
    const i = ac.ctx.idx.get(root);
    const v = i === undefined ? [0, 0] : ac.x[i];
    const h = cdiv(v, ref);
    pts.push({ f, db: 20 * Math.log10(Math.max(cabs(h), 1e-12)), ph: cdeg(h) });
  }
  return pts;
}

/* SPICE netlist (LTspice-compatible) */
function spiceNetlist(parts, mode, freq) {
  const topo = topology(parts);
  const name = k => {
    const r = topo.find(baseNetOfHole(k));
    if (r === topo.gnd) return '0';
    return netName(r, topo).replace('Top + rail', 'RAIL_TP').replace('Top − rail', 'RAIL_TN').replace('Bottom + rail', 'RAIL_BP').replace('Bottom − rail', 'RAIL_BN')
      .replace(/^Col (\d+) a–e$/, 'C$1A').replace(/^Col (\d+) f–j$/, 'C$1F');
  };
  const sp = v => fmtEng(v, '', 4).replace(' ', '').replace('µ', 'u').replace('M', 'Meg');
  const L = ['* Breadboard Bench export'];
  const models = new Map(), subckts = new Map();
  const mdl = (k, s) => models.set(k, s);
  for (const p of topo.els) {
    const cat = catalogOf(p), pins = leadsOf(p).map(name);
    const [a, b] = pins;
    const tag = cat ? cat.mpn.replace(/[^A-Za-z0-9]/g, '') : '';
    switch (p.type) {
      case 'R': L.push(`${p.name} ${a} ${b} ${sp(p.value)}`); break;
      case 'C': L.push(`${p.name} ${a} ${b} ${sp(p.value)}${p.esr ? ' Rser=' + sp(p.esr) : ''}`); break;
      case 'L': L.push(`${p.name} ${a} ${b} ${sp(p.value)}${p.dcr > 0 ? ' Rser=' + sp(p.dcr) : ''}`); break;
      case 'SW': L.push(`R${p.name} ${a} ${b} ${p.closed ? sp(p.ron || 0.05) : '1G'} ; ${cat.name}, ${p.closed ? 'closed' : 'open'}`); break;
      case 'POT': { const [r1, r2] = potR(p); L.push(`R${p.name}A ${pins[0]} ${pins[1]} ${sp(r1)}`, `R${p.name}B ${pins[1]} ${pins[2]} ${sp(r2)} ; ${cat.mpn} ${sp(p.value)} at ${Math.round((p.pos ?? 0.5) * 100)}%`); break; }
      case 'LED': { const c = p.color || 'red', m = ledModel(c); mdl('LED_' + c.toUpperCase(), `.model LED_${c.toUpperCase()} D(Is=${m.Is.toExponential(3)} N=${m.N} Rs=${m.Rs} BV=${m.BV} IBV=${m.IBV}) ; Vf ${LED_TYPES[c].vf} V at 20 mA`); L.push(`${p.name} ${a} ${b} LED_${c.toUpperCase()}`); break; }
      case 'D': { const m = cat.model, mn = 'D' + tag + '_BB'; mdl(mn, `.model ${mn} D(Is=${m.Is} N=${m.N} Rs=${m.Rs} BV=${m.BV} IBV=${m.IBV}${m.NBV ? ' NBV=' + m.NBV : ''})`); L.push(`${p.name} ${a} ${b} ${mn}`); break; }
      case 'BJT': {
        const m = cat.model, mn = 'Q' + tag + '_BB', ord = ['C', 'B', 'E'].map(r => pins[cat.pins.indexOf(r)]);
        mdl(mn, `.model ${mn} ${m.pol > 0 ? 'NPN' : 'PNP'}(Is=${m.Is} Bf=${m.BF} Br=${m.BR} Vaf=${m.VAF} Ikf=${m.IKF})`);
        L.push(`${p.name} ${ord.join(' ')} ${mn}`); break;
      }
      case 'MOS': {
        const m = cat.model, mn = 'M' + tag + '_BB', ord = ['D', 'G', 'S'].map(r => pins[cat.pins.indexOf(r)]);
        mdl(mn, `.model ${mn} ${m.pol > 0 ? 'NMOS' : 'PMOS'}(Level=1 Vto=${m.Vto} Kp=${m.K} Lambda=${m.lambda})`);
        L.push(`${p.name} ${ord.join(' ')} ${ord[2]} ${mn}`); break;
      }
      case 'OPAMP': {
        const m = cat.model, sn = 'OA_' + tag;
        subckts.set(sn, [`.subckt ${sn} inp inn vp vn out`, `B1 x 0 V=limit((V(vp)+V(vn))/2 + ${m.A0}*(V(inp)-V(inn)), V(vn)+${m.headLo}, V(vp)-${m.headHi})`, `R1 x y 1k`, `C1 y 0 {1/(2*pi*1k*${sp(m.GBW / m.A0)})}`, `E1 out 0 y 0 1`, `.ends ${sn}`].join('\n'));
        for (const [k, u] of cat.units.entries()) L.push(`X${p.name}${String.fromCharCode(65 + k)} ${pins[u.inp]} ${pins[u.inn]} ${pins[cat.vp]} ${pins[cat.vn]} ${pins[u.out]} ${sn}`);
        break;
      }
      case 'REG': {
        const m = cat.model, sn = 'REG_' + tag, r = role => pins[cat.pins.indexOf(role)];
        if (m.kind === 'adj') {
          subckts.set(sn, [`.subckt ${sn} in adj out`, `B1 out adj V=min(${m.Vref}, V(in,adj)-${m.Vdo})`, `I1 in adj ${sp(m.Iadj)}`, `.ends ${sn}`].join('\n'));
          L.push(`X${p.name} ${r('IN')} ${r('ADJ')} ${r('OUT')} ${sn}`);
        } else {
          subckts.set(sn, [`.subckt ${sn} in gnd out`, `B1 out gnd V=min(${m.Vreg}, max(V(in,gnd)-${m.Vdo}, 0))`, `I1 in gnd ${sp(m.Iq)}`, `.ends ${sn}`].join('\n'));
          L.push(`X${p.name} ${r('IN')} ${r('GND')} ${r('OUT')} ${sn}`);
        }
        break;
      }
      case 'VDC': L.push(`${p.name} ${a} ${b} DC ${sp(p.value)}${p.rint > 0 ? ' Rser=' + sp(p.rint) : ''}${p.iLimit > 0 ? ' ; current limit ' + sp(p.iLimit) + 'A' : ''}`); break;
      case 'VAC': L.push(`${p.name} ${a} ${b} SINE(0 ${sp(p.value * Math.SQRT2)} ${sp(freq)}) AC ${sp(p.value)} ${p.phase || 0}${p.rint > 0 ? ' Rser=' + sp(p.rint) : ''}`); break;
    }
  }
  for (const s of models.values()) L.push(s);
  for (const s of subckts.values()) L.push(s);
  L.push(mode === 'AC' ? '.ac dec 50 1 1Meg' : '.op');
  L.push('.end');
  return L.join('\n');
}

/* ---------- sample circuits ----------
   Each step is [part, hole, hole, props]. Chips take their anchor hole and null.
   about: what the circuit shows; expect: what the readings should say; try: what to change next. */
const W = { red: '#d23b3b', blue: '#2b63c4', yellow: '#e3a514', green: '#2a9455', black: '#2b2f33' };
const SAMPLE_CIRCUITS = {
  basics: {
    label: 'LED, divider and RC filter', topic: 'DC basics', mode: 'DC', probe: 'L9',
    about: 'Three small circuits on one 9 V supply. Top left: an LED with a 470 Ω current-limiting resistor. Top right: a 10 kΩ / 4.7 kΩ voltage divider. Bottom: a 1 kΩ / 100 nF RC low-pass filter driven by a 1 V AC source.',
    expect: 'The LED draws about (9 − 1.9) / 470 ≈ 15 mA. The divider gives 9 × 4.7 / 14.7 ≈ 2.88 V. The filter corner is 1 / (2π·1 k·100 n) ≈ 1.59 kHz.',
    try: 'Switch to AC and read the −3 dB point on the Bode plot. Change the LED resistor until the LED is near 10 mA.',
    steps: [['V-IDEAL', 'TP1', 'TN1', { value: 9 }], ['GND', 'TN2'],
      ['wire', 'TP3', 'a3', { color: W.red }], ['R-CF', 'b3', 'b7', { value: 470 }], ['LED-red', 'c7', 'c9'], ['wire', 'a9', 'TN9', { color: W.black }],
      ['wire', 'TP13', 'a13', { color: W.red }], ['R-CF', 'b13', 'b18', { value: 10000 }], ['R-CF', 'c18', 'c23', { value: 4700 }], ['wire', 'a23', 'TN23', { color: W.black }],
      ['wire', 'TN29', 'BN29', { color: W.black }],
      ['VAC-IDEAL', 'h3', 'BN3', { value: 1 }], ['R-CF', 'g3', 'g9', { value: 1000 }], ['C-X7R', 'j9', 'BN9', { value: 100e-9 }]]
  },
  divider: {
    label: 'Loaded voltage divider', topic: 'DC basics', mode: 'DC', probe: 'U5',
    about: 'Two 10 kΩ resistors split 12 V in half, but only while nothing draws current from the midpoint. The slide switch connects a 10 kΩ load across the bottom resistor.',
    expect: 'Switch open: 6.00 V at the midpoint (column 5). Switch closed: the load is in parallel with R2, so the bottom leg is 5 kΩ and the midpoint falls to 12 × 5 / 15 = 4.00 V.',
    try: 'Click the switch to flip it. Then make R1 and R2 1 kΩ: the loaded voltage now barely moves, which is why dividers should be about 10× stiffer than their load (or buffered).',
    steps: [['V-IDEAL', 'TP1', 'TN1', { value: 12 }], ['GND', 'TN2'],
      ['R-CF', 'TP5', 'a5', { value: 10000 }], ['R-CF', 'b5', 'b10', { value: 10000 }], ['wire', 'a10', 'TN10', { color: W.black }],
      ['SW-SLIDE', 'd5', 'd14', { closed: false }], ['R-CF', 'b14', 'b19', { value: 10000 }], ['wire', 'a19', 'TN19', { color: W.black }]]
  },
  twosource: {
    label: 'Two sources: superposition and KCL', topic: 'DC basics', mode: 'DC', probe: 'U5',
    about: 'A 12 V and a 5 V source feed one node through 1 kΩ and 2.2 kΩ, with 3.3 kΩ to ground. It is the classic node-voltage / superposition exercise. The 5 V source sits on the bottom rails, and a black jumper ties both grounds together.',
    expect: 'Node voltage (column 5): (12/1k + 5/2.2k) / (1/1k + 1/2.2k + 1/3.3k) ≈ 8.12 V. The 5 V source is absorbing power here (negative power out), because the node sits above 5 V.',
    try: 'Superposition: set the 5 V source to 0 and note the node voltage, then restore it and set the 12 V source to 0. The two results add up to 8.12 V.',
    steps: [['V-IDEAL', 'TP1', 'TN1', { value: 12 }], ['GND', 'TN2'], ['V-IDEAL', 'BP1', 'BN1', { value: 5 }], ['wire', 'TN29', 'BN29', { color: W.black }],
      ['R-MF', 'TP5', 'a5', { value: 1000 }], ['wire', 'e5', 'f5', { color: W.yellow }], ['R-MF', 'j5', 'BP5', { value: 2200 }],
      ['R-MF', 'c5', 'c10', { value: 3300 }], ['wire', 'a10', 'TN10', { color: W.black }]]
  },
  bridge: {
    label: 'Wheatstone bridge', topic: 'DC basics', mode: 'DC', probe: 'U6',
    about: 'Two dividers side by side: 1 kΩ / 1 kΩ on the left (column 6), and 1 kΩ over a trimmer wired as a variable resistor on the right (column 12). The 100 Ω resistor between them stands in for a meter. The trimmer\'s wiper is jumpered to one end so it acts as a variable resistor, which is why the wiring check notes those two pins are tied together.',
    expect: 'With the trimmer at 30% (3 kΩ) the bridge is unbalanced: column 6 sits near 5.9 V and column 12 near 6.1 V, and about 1.9 mA flows through the meter. At 10% (1 kΩ) both sides read 5.00 V and the meter current is zero.',
    try: 'Select the trimmer (RV1) and drag the wiper slider to 10%. Watch the meter current go to zero. That null is how bridges measure an unknown resistance.',
    steps: [['V-IDEAL', 'TP1', 'TN1', { value: 10 }], ['GND', 'TN2'],
      ['R-MF', 'TP6', 'a6', { value: 1000 }], ['R-MF', 'b6', 'b2', { value: 1000 }], ['wire', 'a2', 'TN3', { color: W.black }],
      ['R-MF', 'TP12', 'a12', { value: 1000 }], ['POT-3386', 'c12', null, { pos: 0.3, value: 1e4 }], ['wire', 'd13', 'd14', { color: W.yellow }], ['wire', 'a14', 'TN14', { color: W.black }],
      ['R-MF', 'e6', 'e12', { value: 100 }]]
  },
  highpass: {
    label: 'RC high-pass filter', topic: 'AC', mode: 'AC', freq: 1000, probe: 'L8',
    about: 'A 100 nF film capacitor in series with a 1.6 kΩ resistor to ground. The output is taken across the resistor, so low frequencies are blocked and high frequencies pass.',
    expect: 'Corner frequency 1 / (2π·1.6 k·100 n) ≈ 995 Hz. At 1 kHz the output is about 0.71 V rms (−3 dB) with a +45° phase lead.',
    try: 'Read the Bode plot: −20 dB per decade below the corner. Set the frequency to 100 Hz and 10 kHz and compare the output with 1/√(1 + (fc/f)²).',
    steps: [['GND', 'BN2'], ['VAC-IDEAL', 'h3', 'BN3', { value: 1 }], ['C-FILM', 'g3', 'g8', { value: 100e-9 }], ['R-MF', 'h8', 'BN8', { value: 1600 }]]
  },
  rlc: {
    label: 'Series RLC resonance', topic: 'AC', mode: 'AC', freq: 5033, probe: 'L13',
    about: 'A 10 mH inductor, 100 nF capacitor and 100 Ω resistor in series across a 1 V source. At resonance the inductor and capacitor reactances cancel, leaving only the resistor.',
    expect: 'f₀ = 1 / (2π√(LC)) ≈ 5.03 kHz. There the current is 1 V / 100 Ω = 10 mA in phase with the source. The voltage across L and across C is each about 3.2 V, Q times the source (Q = √(L/C) / R ≈ 3.2).',
    try: 'Look at the peak on the Bode plot (probe across R). Raise R to 330 Ω: the peak gets wider (lower Q) but stays at the same frequency.',
    steps: [['GND', 'BN2'], ['VAC-IDEAL', 'h3', 'BN3', { value: 1 }], ['L-IDEAL', 'g3', 'g8', { value: 10e-3 }], ['C-FILM', 'h8', 'h13', { value: 100e-9 }], ['R-MF', 'i13', 'BN13', { value: 100 }]]
  },
  zener: {
    label: 'Zener reference (1N4733A)', topic: 'Diodes', mode: 'DC', probe: 'U6',
    about: 'A 5.1 V Zener diode, reverse-biased through 150 Ω from 12 V, holds column 6 near 5.1 V. A 10 kΩ trimmer across it taps off a lower adjustable voltage.',
    expect: 'About (12 − 5.1) / 150 ≈ 46 mA flows, near the 49 mA test current. The Zener dissipates about 0.23 W of its 1 W rating, and the trimmer wiper sits at half of 5.1 V.',
    try: 'Change the supply between 9 V and 15 V. The Zener voltage moves only about 0.3 V while the 150 Ω resistor takes up the rest. That is line regulation.',
    steps: [['V-BENCH', 'TP1', 'TN1', { value: 12, iLimit: 1 }], ['GND', 'TN2'],
      ['R-MO-1', 'TP4', 'a4', { value: 150 }], ['wire', 'b4', 'b6', { color: W.yellow }],
      ['D-1N4733A', 'TN7', 'c6'], ['POT-3386', 'c10'], ['wire', 'd6', 'a10', { color: W.yellow }], ['wire', 'a12', 'TN12', { color: W.black }]]
  },
  transistor: {
    label: 'Transistor switch (2N3904 + LED)', topic: 'Transistors', mode: 'DC', probe: 'U12',
    about: 'The slide switch feeds 9 V through 10 kΩ into the base of a 2N3904. The transistor sinks the LED current from its collector to ground.',
    expect: 'Base current ≈ (9 − 0.75) / 10 k ≈ 0.83 mA, far more than the ~13 mA LED current needs at β ≈ 200, so the transistor saturates (Vce under 0.2 V, forced β around 15). That is what a switch should do.',
    try: 'Click the switch to turn the LED off. Raise the base resistor to 1 MΩ: the transistor leaves saturation and the LED dims, because now β limits the current.',
    steps: [['V-BENCH', 'TP1', 'TN1', { value: 9, iLimit: 1 }], ['GND', 'TN2'],
      ['Q-2N3904', 'c10'], ['wire', 'a10', 'TN10', { color: W.black }],
      ['SW-SLIDE', 'TP7', 'a7'], ['R-CF', 'b7', 'b11', { value: 10000 }],
      ['R-CF', 'TP15', 'a15', { value: 470 }], ['LED-blue', 'c15', 'd12']]
  },
  mosfet: {
    label: 'MOSFET low-side switch (2N7000)', topic: 'Transistors', mode: 'DC', probe: 'U12',
    about: 'A 2N7000 N-channel MOSFET switches an LED to ground. The gate is driven to 5 V by the slide switch, and a 100 kΩ pull-down holds it at 0 V when the switch is open.',
    expect: 'With the gate at 5 V the MOSFET is fully on (a few ohms), so the green LED gets about (5 − 2.1) / 220 ≈ 13 mA. Almost no gate current flows, unlike the BJT switch.',
    try: 'Open the switch: the pull-down turns the MOSFET off. Delete the pull-down and open the switch again: the gate floats, which is why real circuits always need one.',
    steps: [['V-BENCH', 'TP1', 'TN1', { value: 5, iLimit: 1 }], ['GND', 'TN2'],
      ['M-2N7000', 'c10'], ['wire', 'a10', 'TN10', { color: W.black }],
      ['SW-SLIDE', 'TP11', 'a11'], ['R-CF', 'b11', 'b6', { value: 100e3 }], ['wire', 'a6', 'TN6', { color: W.black }],
      ['R-CF', 'TP14', 'a14', { value: 220 }], ['LED-green', 'c14', 'd12']]
  },
  ce: {
    label: 'Common-emitter amplifier (2N3904)', topic: 'Transistors', mode: 'AC', freq: 1000, probe: 'U12',
    about: 'A voltage-divider-biased 2N3904 amplifier. 47 kΩ / 10 kΩ set the base near 2.1 V, the 1 kΩ emitter resistor sets about 1.4 mA, and 4.7 kΩ is the collector load. A 100 µF capacitor bypasses the emitter resistor at AC, and a 10 µF capacitor couples in the 5 mV signal.',
    expect: 'DC: Vb ≈ 2.05 V, Ve ≈ 1.4 V, Vc ≈ 5.6 V, in the active region. AC: gain ≈ −gm·Rc = −(Ic / 26 mV)·4.7 k ≈ −250 in theory; the readings show about −220 (≈ 1.1 V rms at the collector, phase near 180°) because the bias resistors and the generator\'s 50 Ω load the input.',
    try: 'Switch to DC to check the bias point. Then delete the bypass capacitor C1: the gain drops to about Rc / Re ≈ 4.7 (the readings show about 4.5), which is lower but much more predictable.',
    steps: [['V-BENCH', 'TP1', 'TN1', { value: 12, iLimit: 0.5 }], ['GND', 'TN2'],
      ['Q-2N3904', 'c10'], ['R-CF', 'TP11', 'a11', { value: 47e3 }], ['R-CF', 'e11', 'e5', { value: 10e3 }], ['wire', 'a5', 'TN5', { color: W.black }],
      ['R-CF', 'TP12', 'a12', { value: 4700 }], ['R-CF', 'd10', 'd7', { value: 1000 }], ['C-ELEC', 'b10', 'b7', { value: 100e-6 }], ['wire', 'a7', 'TN7', { color: W.black }],
      ['VAC-GEN', 'a17', 'TN17', { value: 0.005 }], ['C-ELEC', 'd11', 'd17', { value: 10e-6 }]]
  },
  noninv: {
    label: 'Non-inverting amplifier (LM358, single 12 V)', topic: 'Op-amps', mode: 'DC', probe: 'L10',
    about: 'An LM358 runs from a single 12 V supply and amplifies a 0.5 V DC input (the ideal source at column 17, standing in for a sensor, jumpered to the + input) with a gain of 1 + 9.1 k / 1 k = 10.1.',
    expect: 'Output (column 10, bottom) ≈ 5.05 V. The LM358 output can only reach about 1.5 V below its positive supply, so it clips near 10.5 V.',
    try: 'Raise the input source to 1.2 V: the output stops at about 10.5 V and the op-amp reading shows it clipped. Swap the part to an MCP6002 (rail-to-rail, but 6 V maximum) and see the supply warning.',
    steps: [['V-BENCH', 'TP1', 'TN1', { value: 12, iLimit: 0.5 }], ['GND', 'TN2'],
      ['U-LM358', 'f10'], ['wire', 'a10', 'TP10', { color: W.red }], ['wire', 'j13', 'BN13', { color: W.black }], ['wire', 'TN30', 'BN30', { color: W.black }],
      ['wire', 'h12', 'h17', { color: W.yellow }], ['V-IDEAL', 'j17', 'BN17', { value: 0.5 }], ['R-MF', 'j11', 'BN11', { value: 1000 }], ['R-MF', 'i10', 'i11', { value: 9100 }]]
  },
  opamp: {
    label: 'Inverting amplifier (TL072, ±12 V)', topic: 'Op-amps', mode: 'AC', freq: 1000, probe: 'L10',
    about: 'A TL072 on a split ±12 V supply: two bench supplies stacked, with their junction as ground. The 10 kΩ feedback resistor and 1 kΩ input resistor set the gain to −10. The function generator has a 50 Ω output.',
    expect: 'A 0.5 V rms input gives about 4.76 V rms out, at 180° (inverted). It is slightly under 5 V because the 50 Ω generator and the 1 kΩ input resistor form a divider. The TL072\'s 3 MHz GBW puts the −3 dB point near 280 kHz.',
    try: 'Read the corner on the Bode plot, then change the feedback resistor to 100 kΩ. The gain goes up 10×, and the bandwidth drops about 10×.',
    steps: [['V-BENCH', 'TP1', 'TN1', { value: 12, iLimit: 0.5 }], ['GND', 'TN2'], ['V-BENCH', 'TN4', 'BN4', { value: 12, iLimit: 0.5 }],
      ['U-TL072', 'f10'], ['wire', 'a10', 'TP10', { color: W.red }], ['wire', 'j13', 'BN13', { color: W.blue }], ['wire', 'h12', 'TN12', { color: W.black }],
      ['VAC-GEN', 'i7', 'TN7', { value: 0.5 }], ['R-MF', 'g7', 'g11', { value: 1000 }], ['R-MF', 'i10', 'i11', { value: 10000 }]]
  },
  regulator: {
    label: '5 V regulator from a 9 V battery (L7805)', topic: 'Power', mode: 'DC', probe: 'U7',
    about: 'An L7805 turns a 9 V battery into a steady 5 V. The 330 nF and 100 nF capacitors are the datasheet\'s input and output capacitors. The load is a green LED with 330 Ω plus a 10 k / 10 k divider.',
    expect: 'Output 5.00 V. About 7 mA flows, so the regulator dissipates (9 − 5) × 7 mA ≈ 30 mW, and the divider reads 2.5 V. The battery\'s 1.7 Ω internal resistance barely matters at this current.',
    try: 'Lower the battery voltage to 6.5 V: the 7805 needs about 2 V of headroom, so it drops out and the output follows the input. Swap in an LM1117-3.3 (low-dropout) for comparison.',
    steps: [['V-9V', 'TP1', 'TN1'], ['GND', 'TN2'],
      ['U-L7805', 'c5'], ['wire', 'TP5', 'a5', { color: W.red }], ['wire', 'a6', 'TN6', { color: W.black }],
      ['C-X7R', 'd5', 'TN4', { value: 330e-9 }], ['C-X7R', 'd7', 'TN8', { value: 100e-9 }],
      ['R-CF', 'b7', 'b12', { value: 330 }], ['LED-green', 'c12', 'c14'], ['wire', 'a14', 'TN14', { color: W.black }],
      ['R-CF', 'a7', 'a18', { value: 10000 }], ['R-CF', 'b18', 'TN18', { value: 10000 }]]
  },
  lm317: {
    label: 'Adjustable supply (LM317)', topic: 'Power', mode: 'DC', probe: 'U6',
    about: 'An LM317 holds 1.25 V between OUT and ADJ. The 240 Ω / 720 Ω pair scales that up: Vout = 1.25 × (1 + 720 / 240) ≈ 5.0 V. The load is a yellow LED through 330 Ω.',
    expect: 'Output (column 6) ≈ 5.04 V; the extra 0.04 V comes from the ~50 µA ADJ pin current flowing through 720 Ω. The divider and LED together draw over the LM317\'s 10 mA minimum load.',
    try: 'Change the 720 Ω resistor to 1.5 kΩ for about 9 V. Then take the input down toward the output to find the dropout point.',
    steps: [['V-BENCH', 'TP1', 'TN1', { value: 12, iLimit: 1 }], ['GND', 'TN2'],
      ['U-LM317', 'c5'], ['wire', 'TP7', 'a7', { color: W.red }],
      ['R-MF', 'b6', 'b5', { value: 240 }], ['R-MF', 'e5', 'TN5', { value: 720 }],
      ['R-CF', 'e6', 'e10', { value: 330 }], ['LED-yellow', 'd10', 'TN10']]
  }
};
const SAMPLE_NAME_PREFIX = { R: 'R', C: 'C', L: 'L', LED: 'D', D: 'D', VDC: 'V', VAC: 'V', SW: 'SW', POT: 'RV', BJT: 'Q', MOS: 'M', OPAMP: 'U', REG: 'U' };
function sampleParts(key) {
  const s = SAMPLE_CIRCUITS[key]; if (!s) return [];
  const parts = [], count = {};
  s.steps.forEach(([tool, a, b, props], k) => {
    const id = 's' + (k + 1);
    if (tool === 'wire') { parts.push(Object.assign({ id, type: 'wire', a, b, name: 'Jumper', color: W.blue }, props)); return; }
    if (tool === 'GND') { parts.push({ id, type: 'GND', a, b: null, name: 'GND' }); return; }
    const c = CATALOG_BY_ID[tool];
    const p = Object.assign({ id, type: c.type, model: c.id }, JSON.parse(JSON.stringify(c.defaults || {})), props || {});
    if (c.footprint) p.pins = footprintHoles(c.footprint, a); else { p.a = a; p.b = b; }
    const pre = SAMPLE_NAME_PREFIX[c.type];
    count[pre] = (count[pre] || 0) + 1;
    p.name = pre + count[pre];
    parts.push(p);
  });
  return parts;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    E_BASE, SERIES_TOL, POWER_RATINGS, LED_TYPES, CATALOG, CATALOG_BY_ID, catalogOf, snap, isInSeries, parseEng, fmtEng, rkm, colorBands, smdCode,
    capCodeEncode, capCodeDecode, baseNetOfHole, holesOfBaseNet, footprintHoles, leadsOf, csolve, cabs, cdeg, topology, analyze, sweep, spiceNetlist, SAMPLE_CIRCUITS, sampleParts
  };
}
