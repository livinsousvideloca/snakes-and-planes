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
 * The parts an ELT 1206 lab bench uses: real, purchasable parts or clearly marked ideal models.
 * type selects the device model; footprint '3inline' or 'dip8' places by one click,
 * with pins listed in footprint order (left to right; DIP pin 1 bottom-left).
 */
const CATALOG = [
  // ---- Passives
  { id: 'R-CF', cat: 'Passives', type: 'R', name: 'Carbon film resistor', mpn: 'CF-25', pkg: 'Axial', spec: '¼ W · ±5% · E24', defaults: { value: 1000, tol: 5, pRating: 0.25 } },
  { id: 'C-X7R', cat: 'Passives', type: 'C', name: 'Ceramic capacitor', mpn: 'X7R', pkg: 'Radial', spec: '50 V · ±10% · 100 pF–1 µF', defaults: { value: 100e-9, vRating: 50, dielectric: 'X7R' } },
  { id: 'C-ELEC', cat: 'Passives', type: 'C', name: 'Electrolytic capacitor', mpn: 'Radial 105 °C', pkg: 'Radial can', spec: '25 V · ±20% · polarized · ESR 0.3 Ω', defaults: { value: 100e-6, vRating: 25, esr: 0.3, polarized: true } },
  { id: 'L-IDEAL', cat: 'Passives', type: 'L', name: 'Inductor', mpn: 'Model only', pkg: '—', spec: 'No winding resistance', defaults: { value: 10e-3, dcr: 0, iRating: 1 } },
  // ---- Controls
  { id: 'POT-3386', cat: 'Controls', type: 'POT', name: 'Potentiometer', mpn: 'Bourns 3386P', pkg: '3-pin, 2.54 mm', spec: 'Linear · ½ W', defaults: { value: 10000, pos: 0.5, pRating: 0.5 }, footprint: '3inline', pins: ['1', 'W', '3'] },
  { id: 'SW-SLIDE', cat: 'Controls', type: 'SW', name: 'Slide switch (SPST)', mpn: 'SS12D00', pkg: 'Through-hole', spec: '0.3 A at 50 V DC', defaults: { closed: true, iRating: 0.3, ron: 0.03 } },
  { id: 'SW-TACT', cat: 'Controls', type: 'SW', name: 'Push button', mpn: 'Omron B3F, 6 mm', pkg: 'Through-hole', spec: '50 mA at 12 V DC · momentary', defaults: { closed: false, iRating: 0.05, ron: 0.1, momentary: true } },
  // ---- Sources
  { id: 'V-IDEAL', cat: 'Sources', type: 'VDC', name: 'Ideal DC source', mpn: 'Model only', pkg: '—', spec: 'No internal resistance, no limit', defaults: { value: 5 } },
  { id: 'V-BENCH', cat: 'Sources', type: 'VDC', name: 'Bench supply', mpn: '0–30 V, 3 A', pkg: 'Clip leads', spec: 'Constant voltage with current limit', defaults: { value: 5, iLimit: 1 } },
  { id: 'V-9V', cat: 'Sources', type: 'VDC', name: '9 V battery', mpn: 'PP3 alkaline', pkg: 'Snap clip', spec: 'About 1.7 Ω internal resistance', defaults: { value: 9, rint: 1.7 } },
  { id: 'VAC-IDEAL', cat: 'Sources', type: 'VAC', name: 'Ideal AC source', mpn: 'Model only', pkg: '—', spec: 'Sine · rms amplitude', defaults: { value: 1, phase: 0 } },
  { id: 'VAC-GEN', cat: 'Sources', type: 'VAC', name: 'Function generator', mpn: '50 Ω output', pkg: 'BNC to clips', spec: 'Sine · rms amplitude', defaults: { value: 1, phase: 0, rint: 50 } },
  // ---- Diodes
  { id: 'D-1N4148', cat: 'Diodes', type: 'D', name: 'Small-signal diode', mpn: '1N4148', pkg: 'DO-35 glass', spec: '100 V · 300 mA', body: 'glass', model: { Is: 2.52e-9, N: 1.752, Rs: 0.568, BV: 100, IBV: 100e-6 }, rating: { ifMax: 0.3, vrMax: 100 } },
  { id: 'D-1N4001', cat: 'Diodes', type: 'D', name: 'Rectifier diode', mpn: '1N4001', pkg: 'DO-41', spec: '50 V · 1 A', body: 'black', model: { Is: 14.11e-9, N: 1.984, Rs: 0.0337, BV: 50, IBV: 5e-6 }, rating: { ifMax: 1, vrMax: 50 } },
  ...Object.entries(LED_TYPES).map(([k, t]) => ({ id: 'LED-' + k, cat: 'Diodes', type: 'LED', name: '5 mm LED, ' + t.label.split(' (')[0].toLowerCase(), mpn: 'Generic 5 mm', pkg: 'T-1¾', spec: `Vf ${t.vf} V at 20 mA · 20 mA max`, defaults: { color: k, ifMax: 0.02 } })),
  // ---- Op-amps (the LM1458 is the class part: dual, ±12 V, same pinout as the LM358)
  { id: 'U-LM1458', cat: 'Op-amps', type: 'OPAMP', name: 'Dual op-amp', mpn: 'LM1458', pkg: 'DIP-8', spec: '1 MHz · ±18 V max · ±12 V in class', footprint: 'dip8', units: [{ out: 0, inn: 1, inp: 2 }, { out: 6, inn: 5, inp: 4 }], vn: 3, vp: 7, pins: ['1OUT', '1IN−', '1IN+', 'V−', '2IN+', '2IN−', '2OUT', 'V+'], model: { A0: 2e5, GBW: 1e6, headLo: 1.5, headHi: 1.5, Ilim: 0.025, Iq: 0.0023, Ro: 75 }, rating: { vsMax: 36, vsMin: 10 } },
  { id: 'U-LM741', cat: 'Op-amps', type: 'OPAMP', name: 'Single op-amp', mpn: 'LM741', pkg: 'DIP-8', spec: '1 MHz · ±18 V max · classic', footprint: 'dip8', units: [{ out: 5, inn: 1, inp: 2 }], vn: 3, vp: 6, pins: ['NULL', 'IN−', 'IN+', 'V−', 'NULL', 'OUT', 'V+', 'NC'], model: { A0: 2e5, GBW: 1e6, headLo: 2, headHi: 2, Ilim: 0.025, Iq: 0.0017, Ro: 75 }, rating: { vsMax: 36, vsMin: 10 } },
  { id: 'U-LM358', cat: 'Op-amps', type: 'OPAMP', name: 'Dual single-supply op-amp', mpn: 'LM358', pkg: 'DIP-8', spec: '1 MHz · 3–32 V single supply · output swings to V−', footprint: 'dip8', units: [{ out: 0, inn: 1, inp: 2 }, { out: 6, inn: 5, inp: 4 }], vn: 3, vp: 7, pins: ['1OUT', '1IN−', '1IN+', 'V−', '2IN+', '2IN−', '2OUT', 'V+'], model: { A0: 1e5, GBW: 1e6, headLo: 0.02, headHi: 1.5, Ilim: 0.03, Iq: 0.0007, Ro: 50 }, rating: { vsMax: 32, vsMin: 3 } }
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

const ELEMENT_TYPES = ['R', 'C', 'L', 'LED', 'D', 'VDC', 'VAC', 'SW', 'POT', 'OPAMP'];
const GMIN = 1e-12;

/* ----- device equations (currents flowing INTO each pin) ----- */
const XMAX = 80;
const limexp = x => x < XMAX ? Math.exp(x) : Math.exp(XMAX) * (1 + x - XMAX);
const dlimexp = x => Math.exp(Math.min(x, XMAX));

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
function opampI(v, c, gs = 1) { // v = array of 8 pin voltages; gs scales the open-loop gain
  const m = c.model, I = new Array(8).fill(0), units = [];
  const vhi = v[c.vp] - m.headHi, vlo = v[c.vn] + m.headLo;
  const vc = (vhi + vlo) / 2, vh = Math.max((vhi - vlo) / 2, 0.01);
  const powered = 0.5 * (1 + Math.tanh((v[c.vp] - v[c.vn] - 1) / 0.1)); // an unpowered chip does not drive its output
  for (const u of c.units) {
    const T = vc + vh * Math.tanh(gs * m.A0 * (v[u.inp] - v[u.inn]) / vh);
    const io = powered * m.Ilim * Math.tanh((v[u.out] - T) / m.Ro / m.Ilim);
    const s = 0.5 * (1 + Math.tanh(-io / 1e-3));
    I[u.out] += io; I[c.vp] += -io * s; I[c.vn] += -io * (1 - s);
    units.push({ T, io });
  }
  const iq = m.Iq * 0.5 * (1 + Math.tanh((v[c.vp] - v[c.vn] - 1) / 0.3));
  I[c.vp] += iq; I[c.vn] -= iq;
  return I;
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
  if (p.type === 'OPAMP') {
    const inputs = new Set(cat.units.flatMap(u => [u.inp, u.inn]));
    // small-signal step: with ~1e5 open-loop gain a 1e-7 V input step swings the output across the supply-split knee
    const d = { pins: p.pins, acCols: inputs, fp: cat.model.GBW / cat.model.A0, hAC: 1e-11, gs: 1 };
    d.f = v => opampI(v, cat, d.gs);
    return d;
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
    if ((p.type === 'VDC' || (p.type === 'VAC' && p.dc)) && p.rint > 0 && !(p.iLimit > 0)) { const is = lam * (p.type === 'VDC' ? p.value : p.dc) / p.rint; if (i >= 0) b0[i] += is; if (j >= 0) b0[j] -= is; }
  }
  branches.forEach((p, k) => {
    const m = n + k, i = node(p.a), j = node(p.b);
    if (i >= 0) { A0[i * N + m] += 1; A0[m * N + i] += 1; }
    if (j >= 0) { A0[j * N + m] -= 1; A0[m * N + j] -= 1; }
    b0[m] = p.type === 'VDC' ? lam * p.value : p.type === 'VAC' ? lam * (p.dc || 0) : 0;
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
  // op-amp gain stepping: solve with a tiny open-loop gain, where feedback loops are tame, then raise it
  // to the real value. Followers and chains of op-amps converge this way when plain Newton swings rail to rail.
  const amps = ctx.devices.filter(d => d.part.type === 'OPAMP');
  if (amps.length) {
    // adaptive: a step that fails is retried from the last good point at half the size
    let xg = null, e = -6, step = 0.5, ok = false;
    for (let guard = 0; guard < 200; guard++) {
      amps.forEach(d => { d.gs = Math.pow(10, e); });
      const s = newtonDC(topo, ctx, 1, 0, xg, 150);
      if (s.ok) { xg = s.x; if (e >= 0) { ok = true; break; } e = Math.min(0, e + step); step = Math.min(0.5, step * 1.5); }
      else { if (!xg || step < 1 / 256) break; e -= step; step /= 2; e += step; }
    }
    amps.forEach(d => { d.gs = 1; });
    if (ok) return { x: xg, ok: true, method: 'op-amp gain stepping' };
  }
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
      if (mode === 'DC' && p.rint > 0 && (p.type === 'VDC' || p.type === 'VAC')) i = [(vab[0] - (p.type === 'VDC' ? p.value : p.dc || 0)) / p.rint, 0];
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
      // only pins sharing one physical strip; pins joined on purpose by a jumper (a follower) are fine
      leads.forEach((k, q) => { const r = baseNetOfHole(k); if (seen.has(r)) res.warnings.push(`${p.name}: pins ${seen.get(r)} and ${(catalogOf(p).pins || [])[q]} are on the same strip, so they are shorted together.`); else seen.set(r, (catalogOf(p).pins || [])[q]); });
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

/* SPICE netlist (LTspice-compatible) */
function spiceNetlist(parts, mode, freq) {
  const topo = topology(parts);
  const name = k => {
    const r = topo.find(baseNetOfHole(k));
    if (r === topo.gnd) return '0';
    return netName(r, topo).replace('Top + rail', 'RAIL_TP').replace('Top − rail', 'RAIL_TN').replace('Bottom + rail', 'RAIL_BP').replace('Bottom − rail', 'RAIL_BN')
      .replace(/^Col (\d+) a–e$/, 'C$1A').replace(/^Col (\d+) f–j$/, 'C$1F');
  };
  const sp = v => fmtEng(v, '', 4).replace(' ', '').replace('µ', 'u').replace('M', 'Meg').replace('−', '-');
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
      case 'OPAMP': {
        const m = cat.model, sn = 'OA_' + tag;
        subckts.set(sn, [`.subckt ${sn} inp inn vp vn out`, `B1 x 0 V=limit((V(vp)+V(vn))/2 + ${m.A0}*(V(inp)-V(inn)), V(vn)+${m.headLo}, V(vp)-${m.headHi})`, `R1 x y 1k`, `C1 y 0 {1/(2*pi*1k*${sp(m.GBW / m.A0)})}`, `E1 out 0 y 0 1`, `.ends ${sn}`].join('\n'));
        for (const [k, u] of cat.units.entries()) L.push(`X${p.name}${String.fromCharCode(65 + k)} ${pins[u.inp]} ${pins[u.inn]} ${pins[cat.vp]} ${pins[cat.vn]} ${pins[u.out]} ${sn}`);
        break;
      }
      case 'VDC': L.push(`${p.name} ${a} ${b} DC ${sp(p.value)}${p.rint > 0 ? ' Rser=' + sp(p.rint) : ''}${p.iLimit > 0 ? ' ; current limit ' + sp(p.iLimit) + 'A' : ''}`); break;
      case 'VAC': L.push(`${p.name} ${a} ${b} SINE(${p.dc ? sp(p.dc) : 0} ${sp(p.value * Math.SQRT2)} ${sp(freq)}) AC ${sp(p.value)} ${p.phase || 0}${p.rint > 0 ? ' Rser=' + sp(p.rint) : ''}`); break;
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
    label: 'LED, divider and RC filter', topic: 'Getting started', mode: 'DC',
    about: 'Three small circuits on one 9 V supply. Top left: an LED with a 470 Ω current-limiting resistor. Top right: a 10 kΩ / 4.7 kΩ voltage divider. Bottom: a 1 kΩ / 100 nF RC low-pass filter driven by a 1 V AC source.',
    expect: 'The LED draws about (9 − 1.9) / 470 ≈ 15 mA. The divider gives 9 × 4.7 / 14.7 ≈ 2.88 V. The filter corner is 1 / (2π·1 k·100 n) ≈ 1.59 kHz.',
    try: 'Switch to AC and set the frequency to 1.59k: the filter output (column 9, bottom) drops to 0.707 V at −45°. Change the LED resistor until the LED is near 10 mA.',
    steps: [['V-IDEAL', 'TP1', 'TN1', { value: 9 }], ['GND', 'TN2'],
      ['wire', 'TP3', 'a3', { color: W.red }], ['R-CF', 'b3', 'b7', { value: 470 }], ['LED-red', 'c7', 'c9'], ['wire', 'a9', 'TN9', { color: W.black }],
      ['wire', 'TP13', 'a13', { color: W.red }], ['R-CF', 'b13', 'b18', { value: 10000 }], ['R-CF', 'c18', 'c23', { value: 4700 }], ['wire', 'a23', 'TN23', { color: W.black }],
      ['wire', 'TN29', 'BN29', { color: W.black }],
      ['VAC-IDEAL', 'h3', 'BN3', { value: 1 }], ['R-CF', 'g3', 'g9', { value: 1000 }], ['C-X7R', 'j9', 'BN9', { value: 100e-9 }]]
  },
  series: {
    label: 'Series circuit and KVL', topic: 'Series and parallel', mode: 'DC',
    about: 'A 9 V source drives 1 kΩ, 2 kΩ and 3 kΩ in series (quiz question 4). Each resistor jumps from one column to the next, so the same current flows through all three.',
    expect: 'RT = 1k + 2k + 3k = 6 kΩ, so I = 9 / 6k = 1.5 mA. The drops are V1 = 1.5 V, V2 = 3.0 V and V3 = 4.5 V, which add back up to 9 V (KVL). Column 5 reads 7.5 V and column 10 reads 4.5 V.',
    try: 'Change R2 to 5 kΩ and predict the new current and drops before you look. Then hover each column: the voltage steps down by one resistor drop at a time.',
    steps: [['V-IDEAL', 'TP1', 'TN1', { value: 9 }], ['GND', 'TN2'],
      ['R-CF', 'TP5', 'a5', { value: 1000 }], ['R-CF', 'b5', 'b10', { value: 2000 }], ['R-CF', 'c10', 'c15', { value: 3000 }], ['wire', 'a15', 'TN15', { color: W.black }]]
  },
  seriesparallel: {
    label: 'Series-parallel circuit', topic: 'Series and parallel', mode: 'DC',
    about: 'A 12 V source drives R1 = 1 kΩ in series with R2 = 3 kΩ and R3 = 6 kΩ in parallel (quiz question 5). R2 and R3 both start at column 5 and both end on the − rail.',
    expect: 'R2 ∥ R3 = (3k × 6k) / (3k + 6k) = 2 kΩ, so RT = 3 kΩ and IT = 4 mA. V1 = 4 V, which leaves 8 V across the parallel pair (column 5). I2 = 8 / 3k ≈ 2.67 mA and I3 = 8 / 6k ≈ 1.33 mA, which add back to 4 mA (KCL).',
    try: 'Delete R3 and predict the new total current. Then put it back and make it 3 kΩ: two equal resistors in parallel give half of one.',
    steps: [['V-IDEAL', 'TP1', 'TN1', { value: 12 }], ['GND', 'TN2'],
      ['R-CF', 'TP5', 'a5', { value: 1000 }], ['R-CF', 'b5', 'b10', { value: 3000 }], ['wire', 'a10', 'TN10', { color: W.black }],
      ['R-CF', 'c5', 'c14', { value: 6000 }], ['wire', 'a14', 'TN14', { color: W.black }]]
  },
  divider: {
    label: 'Loaded voltage divider', topic: 'Series and parallel', mode: 'DC',
    about: 'Two 10 kΩ resistors split 12 V in half, but only while nothing draws current from the midpoint. The slide switch connects a 10 kΩ load across the bottom resistor.',
    expect: 'Switch open: 6.00 V at the midpoint (column 5). Switch closed: the load is in parallel with R2, so the bottom leg is 5 kΩ and the midpoint falls to 12 × 5 / 15 = 4.00 V.',
    try: 'Click the switch to flip it. Then make R1 and R2 1 kΩ: the loaded voltage now barely moves, which is why dividers should be about 10× stiffer than their load (or buffered with an op-amp).',
    steps: [['V-IDEAL', 'TP1', 'TN1', { value: 12 }], ['GND', 'TN2'],
      ['R-CF', 'TP5', 'a5', { value: 10000 }], ['R-CF', 'b5', 'b10', { value: 10000 }], ['wire', 'a10', 'TN10', { color: W.black }],
      ['SW-SLIDE', 'd5', 'd14', { closed: false }], ['R-CF', 'b14', 'b19', { value: 10000 }], ['wire', 'a19', 'TN19', { color: W.black }]]
  },
  twosource: {
    label: 'Two sources: superposition and KCL', topic: "Kirchhoff's laws", mode: 'DC',
    about: 'A 12 V and a 5 V source feed one node through 1 kΩ and 2.2 kΩ, with 3.3 kΩ to ground. It is the classic node-voltage / superposition exercise. The 5 V source sits on the bottom rails, and a black jumper ties both grounds together.',
    expect: 'Node voltage (column 5): (12/1k + 5/2.2k) / (1/1k + 1/2.2k + 1/3.3k) ≈ 8.12 V. The 5 V source is absorbing power here (negative power out), because the node sits above 5 V.',
    try: 'Superposition: set the 5 V source to 0 and note the node voltage, then restore it and set the 12 V source to 0. The two results add up to 8.12 V.',
    steps: [['V-IDEAL', 'TP1', 'TN1', { value: 12 }], ['GND', 'TN2'], ['V-IDEAL', 'BP1', 'BN1', { value: 5 }], ['wire', 'TN29', 'BN29', { color: W.black }],
      ['R-CF', 'TP5', 'a5', { value: 1000 }], ['wire', 'e5', 'f5', { color: W.yellow }], ['R-CF', 'j5', 'BP5', { value: 2200 }],
      ['R-CF', 'c5', 'c10', { value: 3300 }], ['wire', 'a10', 'TN10', { color: W.black }]]
  },
  bridge: {
    label: 'Wheatstone bridge', topic: "Kirchhoff's laws", mode: 'DC',
    about: 'Two dividers side by side: 1 kΩ / 1 kΩ on the left (column 6), and 1 kΩ over a potentiometer wired as a variable resistor on the right (column 12). The 100 Ω resistor between them stands in for a meter. The pot\'s wiper is jumpered to one end so it acts as a variable resistor.',
    expect: 'With the pot at 30% (3 kΩ) the bridge is unbalanced: column 6 sits near 5.9 V and column 12 near 6.1 V, and about 1.9 mA flows through the meter. At 10% (1 kΩ) both sides read 5.00 V and the meter current is zero.',
    try: 'Select the pot (RV1) and drag the wiper slider to 10%. Watch the meter current go to zero. That null is how bridges measure an unknown resistance.',
    steps: [['V-IDEAL', 'TP1', 'TN1', { value: 10 }], ['GND', 'TN2'],
      ['R-CF', 'TP6', 'a6', { value: 1000 }], ['R-CF', 'b6', 'b2', { value: 1000 }], ['wire', 'a2', 'TN3', { color: W.black }],
      ['R-CF', 'TP12', 'a12', { value: 1000 }], ['POT-3386', 'c12', null, { pos: 0.3, value: 1e4 }], ['wire', 'd13', 'd14', { color: W.yellow }], ['wire', 'a14', 'TN14', { color: W.black }],
      ['R-CF', 'e6', 'e12', { value: 100 }]]
  },
  highpass: {
    label: 'RC high-pass filter', topic: 'AC circuits', mode: 'AC', freq: 1000,
    about: 'A 100 nF capacitor in series with a 1.6 kΩ resistor to ground. The output is taken across the resistor. The capacitor\'s reactance XC = 1/(2πfC) is large at low frequency, so low frequencies are blocked and high frequencies pass.',
    expect: 'At 1 kHz, XC = 1 / (2π·1k·100n) ≈ 1.59 kΩ, almost equal to R. Z = 1.6k − j1.59k ≈ 2.26 kΩ ∠ −44.8°, so the output (column 8, bottom) is about 0.71 V rms with a +45° phase lead.',
    try: 'Set the frequency to 100 Hz and then 10 kHz. Work out XC and Z at each one, then check the output against Vout = Vin × R / |Z|.',
    steps: [['GND', 'BN2'], ['VAC-IDEAL', 'h3', 'BN3', { value: 1 }], ['C-X7R', 'g3', 'g8', { value: 100e-9 }], ['R-CF', 'h8', 'BN8', { value: 1600 }]]
  },
  rlc: {
    label: 'Series RLC resonance', topic: 'AC circuits', mode: 'AC', freq: 5033,
    about: 'A 10 mH inductor, 100 nF capacitor and 100 Ω resistor in series across a 1 V source. At resonance the inductor and capacitor reactances cancel, leaving only the resistor.',
    expect: 'f₀ = 1 / (2π√(LC)) ≈ 5.03 kHz, where XL = XC ≈ 316 Ω. The current is 1 V / 100 Ω = 10 mA in phase with the source, so column 13 (across R) reads 1 V. The voltage across L and across C is each about 3.2 V, more than the source.',
    try: 'Change the frequency to 4k and 6k: XL and XC no longer cancel, so |Z| rises and the current falls on both sides of resonance. Raise R to 330 Ω and compare.',
    steps: [['GND', 'BN2'], ['VAC-IDEAL', 'h3', 'BN3', { value: 1 }], ['L-IDEAL', 'g3', 'g8', { value: 10e-3 }], ['C-X7R', 'h8', 'h13', { value: 100e-9 }], ['R-CF', 'i13', 'BN13', { value: 100 }]]
  },
  noninv: {
    label: 'Non-inverting amplifier (LM358, single 12 V)', topic: 'Op-amps', mode: 'DC',
    about: 'An LM358 runs from a single 12 V supply and amplifies a 0.5 V DC input (the ideal source at column 17, jumpered to the + input) with a gain of Av = 1 + Rf/Rg = 1 + 9.1k / 1k = 10.1.',
    expect: 'Output (column 10, bottom) = 10.1 × 0.5 ≈ 5.05 V. The LM358 output can only reach about 1.5 V below its positive supply, so it clips near 10.5 V.',
    try: 'Raise the input source to 1.2 V: 10.1 × 1.2 would be 12.1 V, past the rail, so the output stops near 10.5 V and the op-amp reading shows it clipped.',
    steps: [['V-BENCH', 'TP1', 'TN1', { value: 12, iLimit: 0.5 }], ['GND', 'TN2'],
      ['U-LM358', 'f10'], ['wire', 'a10', 'TP10', { color: W.red }], ['wire', 'j13', 'BN13', { color: W.black }], ['wire', 'TN30', 'BN30', { color: W.black }],
      ['wire', 'h12', 'h17', { color: W.yellow }], ['V-IDEAL', 'j17', 'BN17', { value: 0.5 }], ['R-CF', 'j11', 'BN11', { value: 1000 }], ['R-CF', 'i10', 'i11', { value: 9100 }]]
  },
  opamp: {
    label: 'Inverting amplifier (LM1458, ±12 V)', topic: 'Op-amps', mode: 'AC', freq: 1000,
    about: 'An LM1458 on a split ±12 V supply, like the lab station: two bench supplies stacked, with their junction as ground. The 10 kΩ feedback resistor and 1 kΩ input resistor set the gain to Av = −Rf/Rin = −10. The function generator has a 50 Ω output.',
    expect: 'A 0.5 V rms input gives about 4.76 V rms out (column 10, bottom), at 180° (inverted). It is slightly under 5 V because the 50 Ω generator and the 1 kΩ input resistor form a divider: the real gain is −10k / 1.05k ≈ −9.5.',
    try: 'Change the feedback resistor to 20 kΩ and predict the output before you look. AC readings are small-signal, so they never show clipping: check yourself that the output peak (rms × 1.414) stays inside about ±10.5 V.',
    steps: [['V-BENCH', 'TP1', 'TN1', { value: 12, iLimit: 0.5 }], ['GND', 'TN2'], ['V-BENCH', 'TN4', 'BN4', { value: 12, iLimit: 0.5 }],
      ['U-LM1458', 'f10'], ['wire', 'a10', 'TP10', { color: W.red }], ['wire', 'j13', 'BN13', { color: W.blue }], ['wire', 'h12', 'TN12', { color: W.black }],
      ['VAC-GEN', 'i7', 'TN7', { value: 0.5 }], ['R-CF', 'g7', 'g11', { value: 1000 }], ['R-CF', 'i10', 'i11', { value: 10000 }]]
  },
  adder: {
    label: 'Op-amp adder (midterm practical, 2 × LM1458)', topic: 'Op-amps', mode: 'DC',
    about: 'The midterm practical. V1 (the DC supply, 1 V) and V2 (the 3 kΩ / 1 kΩ divider on +12 V, 3 V) each go through a buffer in U1, so the divider is not loaded. U2A is a summing amplifier (R6, R7 in, R8 feedback, all 10 kΩ) and U2B an inverter (R9, R10) that flips the sign back. Both chips run from ±12 V: V+ on pin 8, V− on pin 4. The bottom + rail is tied to ground here, so pins on the lower half can reach 0 V.',
    expect: 'V2 = 12 × 1k / (3k + 1k) = 3 V. Buffers: VA = 1 V (U1 pin 1), VB = 3 V (U1 pin 7). VSUM = −(R8/R6 × VA + R8/R7 × VB) = −4 V at U2 pin 1, and VOUT = −(R10/R9) × VSUM = +4 V at U2 pin 7.',
    try: 'Step V1 through 0, 1, 2 and 3.5 V and check VOUT = V1 + 3. Then do part 5: make R8 20 kΩ so VOUT = 2(V1 + V2). At V1 = 1 V that is 8 V, but at 3.5 V the summer would need −13 V, past what an LM1458 can reach on ±12 V, so it clips near −10.4 V and VOUT stops near +10.4 V.',
    steps: [['V-BENCH', 'TP1', 'TN1', { value: 12, iLimit: 0.5, name: 'VCC' }], ['GND', 'TN2'], ['V-BENCH', 'TN3', 'BN3', { value: 12, iLimit: 0.5, name: 'VEE' }],
      ['wire', 'TN30', 'BP30', { color: W.black }],
      // U1: two buffers. V+ (pin 8) to +12 V, V− (pin 4) to −12 V
      ['U-LM1458', 'f8'], ['wire', 'a8', 'TP8', { color: W.red }], ['wire', 'j11', 'BN11', { color: W.blue }],
      ['V-BENCH', 'a5', 'TN5', { value: 1, iLimit: 0.5, name: 'V1' }], ['wire', 'd5', 'h10', { color: W.yellow }], ['wire', 'g8', 'g9', { color: W.green }],
      ['R-CF', 'TP13', 'a13', { value: 3000, name: 'R1' }], ['R-CF', 'c13', 'TN15', { value: 1000, name: 'R2' }], ['wire', 'd13', 'd11', { color: W.yellow }], ['wire', 'd9', 'd10', { color: W.green }],
      // U2: summing amp (pins 1–3) and inverter (pins 5–7)
      ['U-LM1458', 'f20'], ['wire', 'a20', 'TP20', { color: W.red }], ['wire', 'j23', 'BN23', { color: W.blue }],
      ['R-CF', 'i8', 'i16', { value: 10000, name: 'R6' }], ['R-CF', 'b9', 'b16', { value: 10000, name: 'R7' }], ['wire', 'e16', 'f16', { color: W.green }],
      ['R-CF', 'j16', 'j20', { value: 10000, name: 'R8' }], ['wire', 'h16', 'h21', { color: W.green }], ['wire', 'j22', 'BP22', { color: W.black }],
      ['R-CF', 'i20', 'i26', { value: 10000, name: 'R9' }], ['wire', 'f26', 'e26', { color: W.green }], ['wire', 'a26', 'a22', { color: W.green }],
      ['R-CF', 'c26', 'c21', { value: 10000, name: 'R10' }], ['wire', 'b23', 'TN23', { color: W.black }]]
  }
};
const SAMPLE_NAME_PREFIX = { R: 'R', C: 'C', L: 'L', LED: 'D', D: 'D', VDC: 'V', VAC: 'V', SW: 'SW', POT: 'RV', OPAMP: 'U' };
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
    if (!(props && props.name)) p.name = pre + count[pre];
    parts.push(p);
  });
  return parts;
}

/* ---------- LTspice import ----------
   A netlist (View → SPICE Netlist, or a .net / .cir file) or a schematic (.asc) becomes a list of
   elements, and layoutCircuit() places those on the breadboard: ground and supplies on the rails,
   every other node on its own column strip, op-amps as DIP-8 chips across the center channel. */

/* SPICE number: 4.7k, 1Meg, 10u, 100n, 2m (milli), 4k7; trailing units are ignored */
function spiceValue(s) {
  const m = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(meg|mil|[tgkmunpfµμ\ufffd])?(\d*)/i.exec(String(s));
  if (!m) return NaN;
  const mult = { t: 1e12, g: 1e9, meg: 1e6, k: 1e3, m: 1e-3, mil: 25.4e-6, u: 1e-6, 'µ': 1e-6, 'μ': 1e-6, '\ufffd': 1e-6, n: 1e-9, p: 1e-12, f: 1e-15 }[(m[2] || '').toLowerCase()] || 1;
  const num = m[3] && m[2] && !/[.e]/i.test(m[1]) ? parseFloat(m[1] + '.' + m[3]) : parseFloat(m[1]);
  return num * mult;
}
const isGroundNode = n => /^(0|gnd)$/i.test(n);

/* One element line (already joined and stripped of comments) → element, or { skip: reason } */
function parseElementLine(line) {
  const t = line.trim().split(/\s+/), name = t[0], k = name[0].toUpperCase();
  const params = {};
  for (const tok of t) { const m = /^(\w+)=(.+)$/.exec(tok); if (m) params[m[1].toLowerCase()] = m[2]; }
  const node = n => isGroundNode(n) ? '0' : n;
  if ('RCL'.includes(k)) {
    if (t.length < 4) return { skip: `${name}: needs two nodes and a value` };
    const value = spiceValue(t[3].replace(/^\{|\}$/g, ''));
    if (!(value > 0)) return { skip: `${name}: value "${t[3]}" is not a number this tool can use` };
    return { kind: k, name, nodes: [node(t[1]), node(t[2])], value, rser: params.rser ? spiceValue(params.rser) : 0 };
  }
  if (k === 'V') {
    if (t.length < 4) return { skip: `${name}: needs two nodes and a value` };
    const rest = t.slice(3).join(' ');
    const el = { kind: 'V', name, nodes: [node(t[1]), node(t[2])], rser: params.rser ? spiceValue(params.rser) : 0 };
    const sine = /sin(?:e)?\s*\(([^)]*)\)/i.exec(rest), ac = /\bac\s+([^\s]+)(?:\s+([^\s=]+))?/i.exec(rest);
    if (sine) {
      // SINE(offset amplitude freq delay damping phase): amplitude is the peak, so rms = peak / √2
      const a = sine[1].trim().split(/[\s,]+/).map(spiceValue);
      Object.assign(el, { ac: true, value: (a[1] || 0) / Math.SQRT2, freq: a[2] > 0 ? a[2] : null, phase: a[5] || 0, dc: a[0] || 0 });
      if (ac && isFinite(spiceValue(ac[1]))) Object.assign(el, { value: spiceValue(ac[1]), phase: ac[2] ? spiceValue(ac[2]) || 0 : 0 });
    } else if (ac) {
      const d = /^(?:dc\s+)?([^\s]+)\s+ac\b/i.exec(rest);
      Object.assign(el, { ac: true, value: spiceValue(ac[1]), phase: ac[2] ? spiceValue(ac[2]) || 0 : 0, freq: null, dc: d && isFinite(spiceValue(d[1])) ? spiceValue(d[1]) : 0 });
    }
    else if (/pulse|pwl|exp|sffm/i.test(rest)) return { skip: `${name}: ${rest.split('(')[0].trim()} sources are not supported; use a DC or SINE source` };
    else {
      const d = /^(?:dc\s+)?([^\s]+)/i.exec(rest);
      el.value = d ? spiceValue(d[1]) : NaN;
    }
    if (!isFinite(el.value)) return { skip: `${name}: could not read the source value "${rest}"` };
    return el;
  }
  if (k === 'D') {
    if (t.length < 4) return { skip: `${name}: needs two nodes and a model` };
    return { kind: 'D', name, nodes: [node(t[1]), node(t[2])], model: t[3] };
  }
  if (k === 'X') {
    const pos = t.slice(1).filter(x => !x.includes('='));
    const sub = pos.pop(), nodes = pos.map(node);
    if (nodes.length !== 5 && nodes.length !== 3) return { skip: `${name}: subcircuit ${sub} has ${nodes.length} pins; only op-amps (3 or 5 pins) are supported` };
    return { kind: 'X', name, nodes, model: sub };
  }
  const what = { I: 'current sources', Q: 'transistors', M: 'MOSFETs', J: 'JFETs', E: 'controlled sources', F: 'controlled sources', G: 'controlled sources', H: 'controlled sources', B: 'behavioral sources', S: 'voltage-controlled switches', K: 'coupled inductors', T: 'transmission lines' }[k];
  return { skip: `${name}: ${what || 'this kind of element'} ${what ? 'are' : 'is'} not part of this course's parts, so it was left out` };
}

/* .param R=1k C=100n → { r: '1k', c: '100n' }; {R} in a value is then replaced by 1k */
function spiceParams(lines) {
  const params = {};
  for (const l of lines) {
    const m = /^\s*!?\s*\.param\s+(.*)$/i.exec(l);
    if (m) for (const q of m[1].matchAll(/(\w+)\s*=\s*([^\s;]+)/g)) params[q[1].toLowerCase()] = q[2].replace(/^\{|\}$/g, '');
  }
  return params;
}
function applyParams(line, params) {
  return line.replace(/\{\s*(\w+)\s*\}/g, (m, k) => params[k.toLowerCase()] !== undefined ? params[k.toLowerCase()] : m);
}
/* Bytes of a file saved by LTspice → text. LTspice XVII writes UTF-16, older versions Windows-1252
   (where µ is a single byte that is not valid UTF-8), newer ones UTF-8. */
function decodeSpiceFile(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b.length > 1 && ((b[0] === 0xff && b[1] === 0xfe) || (b[1] === 0 && b[0] !== 0))) return new TextDecoder('utf-16le').decode(b);
  if (b.length > 1 && ((b[0] === 0xfe && b[1] === 0xff) || (b[0] === 0 && b[1] !== 0))) return new TextDecoder('utf-16be').decode(b);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(b); } catch (e) { return new TextDecoder('windows-1252').decode(b); }
}

/* SPICE netlist text → { elements, notes, analysis } */
function parseNetlist(text) {
  const raw = String(text).replace(/\r/g, '').split('\n');
  const lines = [];
  for (const l of raw) {
    if (/^\s*\+/.test(l) && lines.length) lines[lines.length - 1] += ' ' + l.replace(/^\s*\+/, '');
    else lines.push(l);
  }
  const elements = [], notes = [];
  let inSub = false, analysis = null;
  const params = spiceParams(lines);
  lines.forEach((l, i) => {
    const s = applyParams(l.replace(/;.*$/, '').trim(), params);
    if (!s || s[0] === '*') return;
    if (/^\.subckt\b/i.test(s)) { inSub = true; return; }
    if (/^\.ends\b/i.test(s)) { inSub = false; return; }
    if (inSub) return;
    if (s[0] === '.') { if (/^\.(ac|tran|op)\b/i.test(s)) analysis = s.slice(1, 3).toLowerCase() === 'ac' ? 'ac' : s.slice(1, 3).toLowerCase(); return; }
    const el = parseElementLine(s);
    if (el.skip) { if (i > 0 || elements.length) notes.push(el.skip); }
    else elements.push(el);
  });
  return { elements, notes, analysis };
}

/* LTspice schematic (.asc) → netlist elements. Pin offsets are for the standard symbols at R0;
   a pin that lands on no wire means the symbol is not one of these, and is reported. */
const ASC_PINS = {
  res: ['R', [[16, 16], [16, 96]]], res2: ['R', [[16, 16], [16, 96]]],
  cap: ['C', [[16, 0], [16, 64]]], polcap: ['C', [[16, 0], [16, 64]]],
  ind: ['L', [[16, 16], [16, 96]]], ind2: ['L', [[16, 16], [16, 96]]],
  voltage: ['V', [[0, 16], [0, 96]]], battery: ['V', [[0, 16], [0, 96]]], cell: ['V', [[0, 16], [0, 96]]], signal: ['V', [[0, 16], [0, 96]]],
  europeanresistor: ['R', [[16, 16], [16, 96]]], europeancap: ['C', [[16, 0], [16, 64]]], europeanpolcap: ['C', [[16, 0], [16, 64]]],
  diode: ['D', [[16, 0], [16, 64]]], led: ['D', [[16, 0], [16, 64]]], schottky: ['D', [[16, 0], [16, 64]]], zener: ['D', [[16, 0], [16, 64]]],
  opamp: ['X', [[-32, 80], [-32, 48], [32, 64]]],
  opamp2: ['X', [[-32, 80], [-32, 48], [0, 32], [0, 96], [32, 64]]]
};
const ASC_TWO_PIN = [[[16, 16], [16, 96]], [[16, 0], [16, 64]], [[0, 16], [0, 96]], [[0, 0], [0, 80]], [[0, 0], [0, 64]], [[16, 0], [16, 80]]];
function ascTransform(rot, x, y) {
  switch (rot) {
    case 'R90': return [-y, x]; case 'R180': return [-x, -y]; case 'R270': return [y, -x];
    case 'M0': return [-x, y]; case 'M90': return [-y, -x]; case 'M180': return [x, -y]; case 'M270': return [y, x];
    default: return [x, y];
  }
}
function parseAsc(text) {
  const wires = [], flags = [], syms = [], notes = [];
  let analysis = null;
  const ascLines = String(text).replace(/\r/g, '').split('\n');
  // .param directives sit in TEXT lines, several to a line when separated by \n
  const params = spiceParams(ascLines.filter(l => /^TEXT\b/.test(l.trim())).flatMap(l => l.slice(l.indexOf('!') + 1).split('\\n')));
  for (const l of ascLines) {
    const t = l.trim().split(/\s+/);
    if (t[0] === 'WIRE') wires.push(t.slice(1, 5).map(Number));
    else if (t[0] === 'FLAG') flags.push({ x: +t[1], y: +t[2], name: t[3] });
    else if (t[0] === 'SYMBOL') syms.push({ sym: t[1], x: +t[2], y: +t[3], rot: t[4] || 'R0', attr: {} });
    else if (t[0] === 'SYMATTR' && syms.length) syms[syms.length - 1].attr[t[1]] = l.trim().split(/\s+/).slice(2).join(' ');
    else if (t[0] === 'TEXT') { const m = /!\.(ac|tran|op)\b/i.exec(l); if (m) analysis = m[1].toLowerCase(); }
  }
  // connectivity: wire ends join, a point on a wire's span joins that wire, flags with one name join
  const parent = new Map();
  const key = (x, y) => x + ',' + y;
  const find = k => { if (!parent.has(k)) parent.set(k, k); let r = k; while (parent.get(r) !== r) r = parent.get(r); parent.set(k, r); return r; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(rb, ra); };
  const pts = [];
  for (const [x1, y1, x2, y2] of wires) { union(key(x1, y1), key(x2, y2)); pts.push([x1, y1], [x2, y2]); }
  const pinsOf = s => {
    const base = s.sym.split(/[\\/]/).pop().toLowerCase();
    const def = ASC_PINS[base] || (/opamp|^(lt|lm|ad|op|tl|ne|mcp)\d/.test(base) && /opamps/i.test(s.sym) ? ASC_PINS.opamp2 : null);
    if (!def) return null;
    const at = set => set.map(([px, py]) => { const [dx, dy] = ascTransform(s.rot, px, py); return [s.x + dx, s.y + dy]; });
    // a two-lead symbol drawn with other pin positions than the standard one: use the layout whose pins both sit on a wire or flag
    const onNet = ([x, y]) => flags.some(f => f.x === x && f.y === y) || wires.some(([x1, y1, x2, y2]) => (x - x1) * (y2 - y1) === (y - y1) * (x2 - x1) && x >= Math.min(x1, x2) && x <= Math.max(x1, x2) && y >= Math.min(y1, y2) && y <= Math.max(y1, y2));
    let pins = at(def[1]);
    if (def[1].length === 2 && !pins.every(onNet)) { const alt = ASC_TWO_PIN.map(at).find(q => q.every(onNet)); if (alt) pins = alt; }
    return { kind: def[0], pins };
  };
  const placed = [];
  for (const s of syms) {
    const name = s.attr.InstName || s.sym;
    const p = pinsOf(s);
    if (!p) { notes.push(`${name}: the LTspice symbol "${s.sym}" is not one this tool knows, so it was left out. Pasting the netlist (View → SPICE Netlist) works for any op-amp.`); continue; }
    placed.push(Object.assign({ name }, s, p));
    for (const q of p.pins) pts.push(q);
  }
  for (const f of flags) pts.push([f.x, f.y]);
  for (const [x1, y1, x2, y2] of wires) for (const [x, y] of pts) {
    const on = (x - x1) * (y2 - y1) === (y - y1) * (x2 - x1) && x >= Math.min(x1, x2) && x <= Math.max(x1, x2) && y >= Math.min(y1, y2) && y <= Math.max(y1, y2);
    if (on) union(key(x, y), key(x1, y1));
  }
  const byName = {};
  for (const f of flags) { const k = key(f.x, f.y); find(k); if (byName[f.name]) union(byName[f.name], k); else byName[f.name] = k; }
  const label = new Map();
  for (const f of flags) label.set(find(key(f.x, f.y)), isGroundNode(f.name) ? '0' : f.name);
  // how many things touch each point, so a pin sitting in empty space can be reported
  const touches = new Map();
  for (const [x, y] of pts) touches.set(key(x, y), (touches.get(key(x, y)) || 0) + 1);
  const wireRoots = new Set(wires.flatMap(([x1, y1]) => [find(key(x1, y1))]));
  let n = 1;
  const netOf = (x, y) => { const r = find(key(x, y)); if (!label.has(r)) label.set(r, 'N' + String(n++).padStart(3, '0')); return label.get(r); };
  const elements = [];
  for (const s of placed) {
    const loose = s.pins.filter(([x, y]) => touches.get(key(x, y)) === 1 && !wireRoots.has(find(key(x, y))));
    if (loose.length === s.pins.length) { notes.push(`${s.name}: none of its pins touch a wire, so it was left out (its symbol may be drawn differently from the standard one).`); continue; }
    if (loose.length) notes.push(`${s.name}: ${loose.length} pin${loose.length > 1 ? 's' : ''} not connected to anything.`);
    const nodes = s.pins.map(([x, y]) => netOf(x, y));
    const prefix = s.name[0].toUpperCase() === s.kind ? '' : s.kind;
    const val = [s.attr.Value || '', s.attr.Value2 || '', s.attr.SpiceLine || ''].join(' ').trim();
    const line = s.kind === 'X' ? `${prefix}${s.name} ${nodes.join(' ')} ${s.attr.Value || s.sym.split(/[\\/]/).pop()}`
      : s.kind === 'D' ? `${prefix}${s.name} ${nodes.join(' ')} ${/led/i.test(s.sym) ? 'LED' : (s.attr.Value || 'D')}`
      : `${prefix}${s.name} ${nodes.join(' ')} ${val}`;
    const el = parseElementLine(applyParams(line, params));
    if (el.skip) notes.push(el.skip); else elements.push(el);
  }
  return { elements, notes, analysis };
}

/* Elements → breadboard parts, laid out the way a student would build it:
   - ground is the top − rail (and the bottom − rail, tied by a jumper once it is needed); the positive
     supply is the top + rail and the negative supply the bottom + rail;
   - every other node gets a column strip; parts lie flat along a row between two strips about four
     columns apart, or stand between a strip and the rail above or below it;
   - op-amps become DIP-8 chips across the center channel, with each pin's strip as that node's home.
   The finished board is checked against the netlist: every lead must land on its node and no two
   nodes may touch. Returns { parts, notes, mode, freq, netNames } or throws. */
function layoutCircuit(elements) {
  const notes = [], parts = [], leads = [];
  const els = elements.map(e => Object.assign({}, e, { nodes: e.nodes.slice() }));
  let id = 0;
  const names = new Set();
  const uniq = nm => { let n = nm, k = 2; while (names.has(n)) n = nm + '_' + k++; names.add(n); return n; };
  const addPart = p => { p.id = 'p' + (++id); parts.push(p); return p; };
  const ops = els.filter(e => e.kind === 'X');
  const srcs = els.filter(e => e.kind === 'V' && !e.ac);
  const supplyNode = sign => {
    for (const v of srcs) {
      const [a, b] = v.nodes;
      if (b === '0' && a !== '0' && Math.sign(v.value) === sign) return a;
      if (a === '0' && b !== '0' && Math.sign(v.value) === -sign) return b;
    }
    return null;
  };
  // with op-amps, their supply pins name the rails; otherwise the first DC source to ground does
  let vpNet = supplyNode(1), vnNet = supplyNode(-1);
  if (ops.some(o => o.nodes.length === 3)) {
    els.push({ kind: 'V', name: 'VCC', nodes: ['V+', '0'], value: 12 }, { kind: 'V', name: 'VEE', nodes: ['0', 'V−'], value: 12 });
    notes.push('The LTspice op-amp has no supply pins, so it was placed as an LM1458 with ±12 V supplies (VCC and VEE) added.');
    for (const o of ops) if (o.nodes.length === 3) o.nodes = [o.nodes[0], o.nodes[1], 'V+', 'V−', o.nodes[2]];
  }
  if (ops.length) { vpNet = ops[0].nodes[2] === '0' ? null : ops[0].nodes[2]; vnNet = ops[0].nodes[3] === '0' ? null : ops[0].nodes[3]; }
  if (vnNet === vpNet) vnNet = null;

  /* ---- rails ---- */
  const railNet = { TP: vpNet, TN: '0', BN: '0', BP: vnNet || vpNet };
  // columns 30 and 29 are kept for the jumpers that tie the bottom rails to the top ones
  const railUsed = { TP: new Set([29]), TN: new Set([30]), BN: new Set([30]), BP: new Set([29]) };
  const tied = {};
  const onRails = net => net === '0' || (net !== null && (net === vpNet || net === vnNet));
  const color = net => net === '0' ? '#2b2f33' : net === vnNet ? '#2b63c4' : net === vpNet ? '#d23b3b' : '#e3a514';
  const wire = (a, b, net) => { addPart({ type: 'wire', a, b, name: 'Jumper', color: color(net) }); leads.push([a, net], [b, net]); };
  const railFor = (net, top) => (top ? ['TP', 'TN'] : ['BN', 'BP']).find(r => railNet[r] === net) || null;
  const takeRail = (r, c) => {
    if (r === 'BN' && !tied.BN) { tied.BN = true; wire('TN30', 'BN30', '0'); }
    if (r === 'BP' && railNet.BP === vpNet && !tied.BP) { tied.BP = true; wire('TP29', 'BP29', vpNet); }
    railUsed[r].add(c);
    return r + c;
  };
  const railCol = (r, c, offs) => { for (const o of offs) { const cc = c + o; if (cc >= 1 && cc <= COLS && !railUsed[r].has(cc)) return cc; } return null; };
  const SPREAD = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 8, -8, 10, -10, 14, -14, 18, -18, 22, -22, 26, -26, 29, -29];

  /* ---- column strips: 'U5' is a–e of column 5, 'L5' is f–j ---- */
  const strips = new Map(), netStrips = new Map(), chipCols = new Set(), rowSpans = {};
  const need = new Map(); // leads still to place on each node
  for (const e of els) if (e.kind !== 'X' && e.nodes[0] !== e.nodes[1]) for (const n of e.nodes) need.set(n, (need.get(n) || 0) + 1);
  const colOf = k => +k.slice(1);
  const addStrip = (k, net, taken) => {
    strips.set(k, { net, free: (k[0] === 'U' ? 'abcde' : 'fghij').split('').filter(r => r !== taken) });
    if (net !== null) { if (!netStrips.has(net)) netStrips.set(net, []); netStrips.get(net).push(k); }
  };
  const take = (k, row, net) => { const s = strips.get(k); s.free = s.free.filter(r => r !== row); const h = row + colOf(k); leads.push([h, net]); return h; };
  const spanFree = (row, c1, c2) => { const lo = Math.min(c1, c2), hi = Math.max(c1, c2); return !(rowSpans[row] || []).some(([a, b]) => Math.max(a, lo) < Math.min(b, hi)); };
  const addSpan = (row, c1, c2) => { (rowSpans[row] = rowSpans[row] || []).push([Math.min(c1, c2), Math.max(c1, c2)]); };
  const totalFree = net => (netStrips.get(net) || []).reduce((t, k) => t + strips.get(k).free.length, 0);
  const inward = k => k[0] === 'U' ? 'edcba' : 'fghij'; // rows from the center channel outward
  const PART_ROWS = { U: 'bcdea', L: 'ihgfj' };          // rows a and j are kept for the rails as long as possible
  // the free strip nearest a wanted column; avoid is a column to stay at least two away from
  const freeStrip = (half, want, avoid) => {
    let best = null, bs = Infinity;
    for (const h of [half, half === 'U' ? 'L' : 'U']) {
      for (let c = 1; c <= COLS; c++) {
        const k = h + c;
        if (strips.has(k) || chipCols.has(c)) continue;
        const s = Math.abs(c - want) + (avoid && Math.abs(c - avoid) < 2 ? 12 : 0) + (c < 2 || c > 28 ? 0.5 : 0);
        if (s < bs) { bs = s; best = k; }
      }
      if (best) return best;
    }
    throw new Error('This circuit has more nodes than a half-size breadboard can hold.');
  };
  // a jumper between two strips of one node
  const link = (k0, k1, net) => {
    const s0 = strips.get(k0), s1 = strips.get(k1), c0 = colOf(k0), c1 = colOf(k1);
    let r0, r1;
    if (k0[0] === k1[0]) {
      const common = inward(k0).split('').filter(r => s0.free.includes(r) && s1.free.includes(r));
      r0 = r1 = common.find(r => spanFree(r, c0, c1)) || common[0];
      if (r0) addSpan(r0, c0, c1);
    }
    if (!r0) { r0 = inward(k0).split('').find(r => s0.free.includes(r)); r1 = inward(k1).split('').find(r => s1.free.includes(r)); }
    wire(take(k0, r0, net), take(k1, r1, net), net);
    leads.length -= 2; // take() already recorded both ends
  };
  // give a node one more strip, linked to one it already has
  const extend = (net, half, want, avoid) => {
    const from = netStrips.get(net).filter(k => strips.get(k).free.length).sort((a, b) => strips.get(b).free.length - strips.get(a).free.length)[0];
    if (!from) throw new Error(`Node ${net} has more connections than its strips can hold.`);
    half = half || from[0];
    const across = (half === 'U' ? 'U' : 'L') + colOf(from);
    const k = half !== from[0] && want === undefined && !strips.has(across) && !chipCols.has(colOf(from)) ? across : freeStrip(half, want === undefined ? colOf(from) : want, avoid);
    addStrip(k, net);
    link(from, k, net);
    return k;
  };
  // keep one hole in hand for the jumper to the node's next strip
  const ensure = net => {
    if (!(netStrips.get(net) || []).length) return;
    const f = totalFree(net);
    if (f === 0) throw new Error(`Node ${net} has more connections than its strips can hold.`);
    if (f === 1 && need.get(net) > 1) extend(net);
  };
  const used = net => need.set(net, (need.get(net) || 1) - 1);
  let cursor = 5;
  const freshStrip = (net, half) => { const k = freeStrip(half, cursor); cursor = Math.min(28, colOf(k) + 4); addStrip(k, net); return k; };

  /* ---- chips ---- */
  const chips = [];
  for (const o of ops) {
    const m = /741/.test(o.model) ? 'U-LM741' : /358/.test(o.model) ? 'U-LM358' : 'U-LM1458';
    const c = CATALOG_BY_ID[m];
    const open = chips.find(ch => ch.m === m && ch.units.length < c.units.length && ch.vp === o.nodes[2] && ch.vn === o.nodes[3]);
    if (open) open.units.push(o); else chips.push({ m, units: [o], vp: o.nodes[2], vn: o.nodes[3] });
  }
  if (chips.length > 4) throw new Error('More than four op-amp chips will not fit on a half-size breadboard.');
  const chipAt = [[], [14], [9, 20], [6, 14, 22], [4, 11, 18, 25]][chips.length];
  chips.forEach((ch, i) => { for (let c = chipAt[i]; c <= chipAt[i] + 3; c++) chipCols.add(c); });
  chips.forEach((ch, i) => {
    const col = chipAt[i], cat = CATALOG_BY_ID[ch.m], pins = footprintHoles('dip8', 'f' + col);
    const pinNet = new Array(8).fill(null);
    pinNet[cat.vp] = ch.vp; pinNet[cat.vn] = ch.vn;
    ch.units.forEach((o, k) => { const u = cat.units[k]; pinNet[u.inp] = o.nodes[0]; pinNet[u.inn] = o.nodes[1]; pinNet[u.out] = o.nodes[4]; });
    addPart(Object.assign({ type: 'OPAMP', model: ch.m, name: uniq(ch.units[0].name.replace(/^X/i, '').replace(/[A-Z]$/, '') || 'U' + (i + 1)), pins }, JSON.parse(JSON.stringify(cat.defaults || {}))));
    pins.forEach((h, k) => {
      const net = pinNet[k], top = h[0] === 'e', sk = (top ? 'U' : 'L') + parseHole(h).c, c = colOf(sk);
      if (net === null) { addStrip(sk, null, h[0]); return; }
      leads.push([h, net]);
      if (onRails(net)) {
        // a supply pin: a jumper straight to the rail on its side of the board
        addStrip(sk, null, h[0]);
        strips.get(sk).net = net;
        let r = railFor(net, top), from = top ? 'a' : 'j';
        if (!r) r = railFor(net, !top);
        const cc = railCol(r, c, SPREAD);
        strips.get(sk).free = strips.get(sk).free.filter(x => x !== from);
        wire(from + c, takeRail(r, cc), net);
        return;
      }
      const prev = (netStrips.get(net) || []).slice(-1)[0];
      addStrip(sk, net, h[0]);
      if (prev) link(prev, sk, net);
    });
  });

  /* ---- two-lead parts ---- */
  // a lead on a strip node and the other on a rail: stand the part between the strip and the rail
  const toRail = (net, rail) => {
    if (!(netStrips.get(net) || []).length) freshStrip(net, railFor(rail, true) ? 'U' : 'L');
    ensure(net);
    for (let pass = 0; pass < 2; pass++) {
      let best = null;
      for (const k of netStrips.get(net)) {
        const s = strips.get(k), top = k[0] === 'U', c = colOf(k), r = railFor(rail, top);
        if (!s.free.length || !r) continue;
        const rows = top ? 'abcde' : 'jihgf';
        let cand;
        if (s.free.includes(rows[0]) && !railUsed[r].has(c)) cand = { cost: 0, k, row: rows[0], r, c };
        else {
          const row = rows.split('').find(x => s.free.includes(x)), cc = railCol(r, c, [2, -2, 3, -3, 1, -1, 4, -4, 5, -5, 0].concat(SPREAD));
          if (cc !== null) cand = { cost: 5 + rows.indexOf(row) + Math.abs(cc - c) * 0.2, k, row, r, c: cc };
        }
        if (cand && (!best || cand.cost < best.cost)) best = cand;
      }
      // no room on this side, or the rail is on the other side of the board: carry the node across the channel
      if (pass === 0 && (!best || best.cost > 4)) {
        const ks = netStrips.get(net), half = ks.some(k => k[0] === 'U' && railFor(rail, false)) ? 'L' : ks.some(k => k[0] === 'L' && railFor(rail, true)) ? 'U' : null;
        const have = half && ks.some(k => k[0] === half && strips.get(k).free.length);
        if (half && !have && totalFree(net) >= 1) { extend(net, half); continue; }
      }
      if (!best) throw new Error(`Could not reach a rail from node ${net}.`);
      return [take(best.k, best.row, net), takeRail(best.r, best.c)];
    }
  };
  const pairCost = (k1, k2) => {
    const s1 = strips.get(k1), s2 = strips.get(k2), c1 = colOf(k1), c2 = colOf(k2), d = Math.abs(c1 - c2);
    if (k1[0] === k2[0]) {
      const pref = PART_ROWS[k1[0]].split('');
      const common = pref.filter(r => s1.free.includes(r) && s2.free.includes(r));
      const clear = common.find(r => spanFree(r, c1, c2));
      const base = d < 2 ? 20 : d <= 6 ? Math.abs(d - 4) * 0.5 : 1 + (d - 6) * 1.5;
      if (clear) return { cost: base, k1, k2, r1: clear, r2: clear };
      if (common.length) return { cost: base + 3, k1, k2, r1: common[0], r2: common[0] };
      return { cost: base + 6, k1, k2, r1: pref.find(r => s1.free.includes(r)), r2: pref.find(r => s2.free.includes(r)) };
    }
    let overChip = false;
    for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) if (chipCols.has(c)) overChip = true;
    return { cost: 5 + d * 0.75 + (overChip ? 25 : 0), k1, k2, r1: inward(k1).split('').find(r => s1.free.includes(r)), r2: inward(k2).split('').find(r => s2.free.includes(r)) };
  };
  const bestPair = (n1, n2) => {
    let best = null;
    for (const k1 of netStrips.get(n1)) for (const k2 of netStrips.get(n2)) {
      if (!strips.get(k1).free.length || !strips.get(k2).free.length) continue;
      const c = pairCost(k1, k2);
      if (!best || c.cost < best.cost) best = c;
    }
    return best;
  };
  // both leads on strip nodes: lie the part along a row
  const between = (n1, n2) => {
    const has = n => (netStrips.get(n) || []).length > 0;
    if (!has(n1) && !has(n2)) freshStrip(n1, 'U');
    ensure(n1); ensure(n2);
    for (const [a, b] of [[n1, n2], [n2, n1]]) if (has(a) && !has(b)) {
      // the new node goes about four columns from the best strip of the one already on the board
      const k = netStrips.get(a).filter(x => strips.get(x).free.length).sort((x, y) => strips.get(y).free.length - strips.get(x).free.length)[0];
      const c = colOf(k), right = freeStrip(k[0], c + 4, c), left = freeStrip(k[0], c - 4, c);
      const score = x => (x[0] === k[0] ? 0 : 10) + Math.abs(Math.abs(colOf(x) - c) - 4);
      const pick = score(right) <= score(left) ? right : left;
      addStrip(pick, b);
      cursor = Math.max(cursor, Math.min(28, colOf(pick) + 4));
    }
    let best = bestPair(n1, n2);
    // an awkward fit (neighbouring columns, across a chip, no shared row): give one node a new strip beside the other
    if (!best || best.cost >= 8) {
      for (const [a, b] of [[n1, n2], [n2, n1]]) {
        if (totalFree(b) < 1) continue;
        const k = netStrips.get(a).filter(x => strips.get(x).free.length).sort((x, y) => strips.get(y).free.length - strips.get(x).free.length)[0];
        if (!k) continue;
        const c = colOf(k);
        extend(b, k[0], c + (c <= 15 ? 4 : -4), c);
        break;
      }
      best = bestPair(n1, n2);
    }
    if (!best) throw new Error(`Could not place a part between nodes ${n1} and ${n2}.`);
    if (best.r1 === best.r2) addSpan(best.r1, colOf(best.k1), colOf(best.k2));
    return [take(best.k1, best.r1, n1), take(best.k2, best.r2, n2)];
  };

  // supplies between rails first, then always the part with the most nodes already on the board,
  // so each new strip lands next to what it connects to
  const rest = els.filter(e => e.kind !== 'X'), two = [], known = new Set();
  while (rest.length) {
    const sc = e => (e.kind === 'V' && onRails(e.nodes[0]) && onRails(e.nodes[1]) ? 10 : 0) + e.nodes.reduce((t, n) => t + (onRails(n) ? 1 : netStrips.has(n) ? 2 : known.has(n) ? 2 : 0), 0) + (e.kind === 'V' ? 0.5 : 0);
    let bi = 0; rest.forEach((e, i) => { if (sc(e) > sc(rest[bi])) bi = i; });
    const e = rest.splice(bi, 1)[0]; e.nodes.forEach(n => known.add(n)); two.push(e);
  }
  let srcCol = 1;
  for (const e of two) {
    const [n1, n2] = e.nodes;
    if (n1 === n2) { notes.push(`${e.name}: both ends are on the same node, so it was left out.`); continue; }
    let a, b;
    if (onRails(n1) && onRails(n2)) {
      // rail to rail: on the top pair when both nodes are there, otherwise the bottom pair, otherwise across the board
      const side = [true, false].find(t => railFor(n1, t) && railFor(n2, t));
      const r1 = side === undefined ? railFor(n1, true) || railFor(n1, false) : railFor(n1, side), r2 = side === undefined ? railFor(n2, true) || railFor(n2, false) : railFor(n2, side);
      let c = srcCol; while (c < COLS && (railUsed[r1].has(c) || railUsed[r2].has(c))) c++;
      srcCol = c + (e.kind === 'V' ? 3 : 2);
      a = takeRail(r1, c); b = takeRail(r2, c);
    } else if (onRails(n1)) { [b, a] = toRail(n2, n1); used(n2); }
    else if (onRails(n2)) { [a, b] = toRail(n1, n2); used(n1); }
    else { [a, b] = between(n1, n2); used(n1); used(n2); }
    leads.push([a, n1], [b, n2]);
    const p = { name: uniq(e.name) };
    if (e.kind === 'R') Object.assign(p, { type: 'R', model: 'R-CF' }, CATALOG_BY_ID['R-CF'].defaults, { value: e.value });
    else if (e.kind === 'C') Object.assign(p, { type: 'C', model: 'C-X7R' }, CATALOG_BY_ID['C-X7R'].defaults, { value: e.value }, e.rser ? { esr: e.rser } : {});
    else if (e.kind === 'L') Object.assign(p, { type: 'L', model: 'L-IDEAL' }, CATALOG_BY_ID['L-IDEAL'].defaults, { value: e.value, dcr: e.rser || 0 });
    else if (e.kind === 'D') {
      const led = /led/i.test(e.model);
      const col = led ? (Object.keys(LED_TYPES).find(c => new RegExp(c, 'i').test(e.model)) || 'red') : null;
      const m = led ? 'LED-' + col : /400\d/.test(e.model) ? 'D-1N4001' : 'D-1N4148';
      Object.assign(p, { type: CATALOG_BY_ID[m].type, model: m }, JSON.parse(JSON.stringify(CATALOG_BY_ID[m].defaults || {})));
      if (!led && !/4148|400\d/.test(e.model)) notes.push(`${e.name}: diode model ${e.model} was placed as a 1N4148.`);
    } else if (e.ac) Object.assign(p, { type: 'VAC', model: e.rser > 0 ? 'VAC-GEN' : 'VAC-IDEAL', value: e.value, phase: e.phase || 0 }, e.rser > 0 ? { rint: e.rser } : {}, e.dc ? { dc: e.dc } : {});
    else Object.assign(p, { type: 'VDC', model: 'V-IDEAL', value: e.value }, e.rser > 0 ? { rint: e.rser } : {});
    addPart(Object.assign(p, { a, b }));
  }
  addPart({ type: 'GND', a: 'TN' + railCol('TN', 28, SPREAD), b: null, name: 'GND' });

  /* ---- check the board against the netlist ---- */
  const topo = topology(parts), rootNode = new Map(), nodeRoot = new Map();
  for (const [h, net] of leads) {
    const r = topo.find(baseNetOfHole(h));
    if ((rootNode.has(r) && rootNode.get(r) !== net) || (nodeRoot.has(net) && nodeRoot.get(net) !== r)) throw new Error(`The layout did not come out right around node ${net}, so the board was not built. Please report this netlist.`);
    rootNode.set(r, net); nodeRoot.set(net, r);
  }
  // which LTspice node each strip and rail carries, for the bench to show
  const netNames = {};
  for (const b of topo.parent.keys()) { const n = rootNode.get(topo.find(b)); if (n !== undefined) netNames[b] = n; }
  const acSrc = els.find(e => e.kind === 'V' && e.ac);
  return { parts, notes, mode: acSrc ? 'AC' : 'DC', freq: (acSrc && acSrc.freq) || null, netNames };
}

/* Text of a netlist or .asc file → board, or { error } */
function importLTspice(text) {
  const asc = /^\s*Version\s+\d/m.test(text) && /^\s*SHEET\b/m.test(text);
  const parsed = asc ? parseAsc(text) : parseNetlist(text);
  if (!parsed.elements.length) return { error: asc ? 'No parts this tool knows were found in the schematic.' : 'No circuit elements were found. Paste the netlist from LTspice (View → SPICE Netlist), or open a .asc, .net or .cir file.', notes: parsed.notes };
  try {
    const r = layoutCircuit(parsed.elements);
    r.notes = parsed.notes.concat(r.notes);
    r.kind = asc ? 'schematic' : 'netlist';
    r.count = parsed.elements.length;
    return r;
  } catch (e) { return { error: e.message, notes: parsed.notes }; }
}

/* ----- virtual multimeter: a 6000-count true-RMS handheld laid out like the Fluke 87V ----- */
const METER = {
  vin: 10e6,                               // V and mV input resistance
  shunt: { A: 0.03, mA: 1.8, uA: 100 },    // burden voltage: 30 mV/A, 1.8 mV/mA, 100 µV/µA
  fuse: { A: 11, mA: 0.44 },               // fuse ratings: 11 A and 440 mA
  ohmV: 0.4,                               // Ω test voltage, low enough that diodes stay off
  diodeV: 3.2, diodeI: 1e-3,               // diode test: about 1 mA, open-circuit reads OL
  capF: 1000, beep: 25                     // capacitance test frequency; continuity beeps below 25 Ω
};
// [range max, unit, display scale, decimals]: 6000 counts, so 5.999 V on the 6 V range
const METER_RANGES = {
  V: [[6, 'V', 1, 3], [60, 'V', 1, 2], [600, 'V', 1, 1], [1000, 'V', 1, 0]],
  mV: [[0.6, 'mV', 1e3, 1]],
  ohm: [[600, 'Ω', 1, 1], [6e3, 'kΩ', 1e-3, 3], [60e3, 'kΩ', 1e-3, 2], [600e3, 'kΩ', 1e-3, 1], [6e6, 'MΩ', 1e-6, 3], [50e6, 'MΩ', 1e-6, 2]],
  diode: [[3, 'V', 1, 3]],
  cap: [[10e-9, 'nF', 1e9, 2], [100e-9, 'nF', 1e9, 1], [1e-6, 'µF', 1e6, 3], [10e-6, 'µF', 1e6, 2], [100e-6, 'µF', 1e6, 1], [10e-3, 'µF', 1e6, 0]],
  mA: [[0.06, 'mA', 1e3, 2], [0.4, 'mA', 1e3, 1]],
  A: [[6, 'A', 1, 3], [10, 'A', 1, 2]],
  uA: [[600e-6, 'µA', 1e6, 1], [6000e-6, 'µA', 1e6, 0]]
};
/* What the meter shows for a value. range: index for manual ranging, or null for auto */
function meterDisplay(kind, value, range = null) {
  const R = METER_RANGES[kind];
  if (!R) return null;
  if (!isFinite(value) && !(value === Infinity)) return { text: '----', unit: R[0][1], range: 0, frac: 0, ol: false };
  const a = Math.abs(value);
  let k = range;
  // autorange: the lowest range where the rounded reading still fits the 6000 counts
  if (k === null || k === undefined) { k = R.findIndex(([max, , sc, d]) => +(a * sc).toFixed(d) < max * sc); if (k < 0) k = R.length - 1; }
  k = Math.min(k, R.length - 1);
  const [max, unit, scale, dec] = R[k];
  if (!(+(a * scale).toFixed(dec) < max * scale) && !(kind === 'V' && k === R.length - 1 && a <= 1000)) return { text: 'OL', unit, range: k, frac: 1, ol: true, neg: false };
  const text = (a * scale).toFixed(dec);
  return { text, unit, range: k, frac: a / max, ol: false, neg: value < 0 && +text !== 0 };
}
function nodeVolt(res, hole, ac) {
  const r = res.topo.find(baseNetOfHole(hole));
  if (ac) return res.nodeV.get(r) || [0, 0];
  return res.dc ? res.dc.nodeV.get(r) || 0 : 0;
}
/* the board with the supplies switched off, for Ω, diode and capacitance tests */
function unpowered(parts) {
  return parts.filter(p => !['VDC', 'VAC', 'GND'].includes(p.type))
    .map(p => p.type === 'L' && !(p.dcr > 0) ? Object.assign({}, p, { dcr: 0.05 }) : p);
}
/*
 * m: { fn: off|vac|vdc|mv|ohm|diode|a|ua, shift (yellow button), red, black (holes), jack: V|mA|A, fuses: { mA, A } (true = blown) }
 * Returns { kind, value, ac, hz, beep, lead, blow, notes }. value is in SI units; Infinity means open (OL).
 */
function meterMeasure(parts, opts, m) {
  const mode = opts.mode || 'DC', freq = opts.freq || 1000;
  const out = { kind: null, value: 0, ac: false, hz: 0, beep: false, lead: false, blow: null, notes: [] };
  if (!m || m.fn === 'off') { out.kind = 'off'; return out; }
  const jack = m.jack || 'V', fuses = m.fuses || {};
  const isCurrent = m.fn === 'a' || m.fn === 'ua';
  const probes = m.red && m.black;
  out.lead = jack !== 'V' && !isCurrent;
  const powered = parts.some(p => p.type === 'VDC' || p.type === 'VAC');
  const same = probes && (() => { const t = topology(parts); return t.find(baseNetOfHole(m.red)) === t.find(baseNetOfHole(m.black)); })();

  // Ω, continuity, diode and capacitance: the meter drives the circuit with the supplies off
  if (m.fn === 'ohm' || m.fn === 'diode') {
    const cap = m.fn === 'diode' && m.shift;
    out.kind = m.fn === 'ohm' ? 'ohm' : cap ? 'cap' : 'diode';
    if (powered) out.notes.push('Readings in this position are taken with the supplies switched off. On the bench, turn the power off first: a live circuit gives a wrong reading.');
    if (!probes) { out.value = out.kind === 'cap' ? 0 : Infinity; return out; }
    if (same) { out.value = 0; out.beep = out.kind === 'ohm' && m.shift || out.kind === 'diode'; return out; }
    const base = unpowered(parts), gnd = { id: '__mg', type: 'GND', a: m.black, b: null, name: 'GND' };
    if (out.kind === 'cap') {
      const src = { id: '__mt', type: 'VAC', model: 'VAC-IDEAL', a: m.red, b: m.black, value: 1, phase: 0, name: 'meter' };
      const r = analyze(base.concat([src, gnd]), { mode: 'AC', freq: METER.capF });
      if (!r.ok) { out.value = NaN; return out; }
      const i = r.parts.__mt.i, w = 2 * Math.PI * METER.capF; // i flows into the + terminal, so the circuit draws −i
      out.value = Math.max(0, -i[1] / w);
      return out;
    }
    if (out.kind === 'diode') {
      const src = { id: '__mt', type: 'VDC', model: 'V-BENCH', a: m.red, b: m.black, value: METER.diodeV, iLimit: METER.diodeI, name: 'meter' };
      const r = analyze(base.concat([src, gnd]), { mode: 'DC' });
      if (!r.ok) { out.value = NaN; return out; }
      out.value = nodeVolt(r, m.red, false);
      out.beep = out.value < 0.1;
      return out;
    }
    const src = { id: '__mt', type: 'VDC', model: 'V-IDEAL', a: m.red, b: m.black, value: METER.ohmV, name: 'meter' };
    const r = analyze(base.concat([src, gnd]), { mode: 'DC' });
    if (!r.ok) { out.value = NaN; return out; }
    const i = Math.abs(r.parts.__mt.i[0]);
    out.value = i < METER.ohmV / 1e9 ? Infinity : METER.ohmV / i;
    out.beep = !!m.shift && out.value < METER.beep;
    return out;
  }

  // volts and amps: the meter sits across the probes as 10 MΩ, or as a current shunt when the red lead is in A or mA
  if (isCurrent) {
    out.kind = jack === 'A' ? 'A' : m.fn === 'ua' ? 'uA' : 'mA';
    if (m.fn === 'ua' && jack === 'A') out.kind = 'uA';
    out.ac = !!m.shift;
    if (jack === 'V') out.notes.push('The red lead is in the V jack, so no current flows through the meter. Move it to mA/µA or A.');
  } else {
    out.kind = m.fn === 'mv' ? 'mV' : 'V';
    out.ac = m.fn === 'vac' || (m.fn === 'mv' && !!m.shift);
  }
  if (!probes) return out;
  const useJack = jack === 'A' ? 'A' : jack === 'mA' ? (m.fn === 'ua' ? 'uA' : 'mA') : null;
  if (useJack && m.fn === 'ua' && jack === 'A') return out; // µA position only reads the mA/µA jack
  const fuseKey = jack === 'A' ? 'A' : 'mA';
  if (useJack && fuses[fuseKey]) { out.notes.push(`The ${fuseKey === 'A' ? '11 A' : '440 mA'} fuse is blown, so this jack is open.`); if (!isCurrent) return out; out.value = 0; return out; }
  if (!useJack && isCurrent) return out;
  const rm = useJack ? METER.shunt[useJack] : METER.vin;
  const meterR = { id: '__mr', type: 'R', model: 'R-CF', a: m.red, b: m.black, value: rm, name: 'meter' };
  const r = analyze(parts.concat([meterR]), { mode, freq });
  if (!r.ok) { out.value = NaN; out.notes.push(...r.errors); return out; }
  const vdc = nodeVolt(r, m.red, false) - nodeVolt(r, m.black, false);
  let vac = 0;
  if (mode === 'AC') { const a = nodeVolt(r, m.red, true), b = nodeVolt(r, m.black, true); vac = Math.hypot(a[0] - b[0], a[1] - b[1]); }
  const scale = useJack ? 1 / rm : 1;
  const dc = vdc * scale, acm = vac * scale;
  out.dcPart = dc; out.acPart = acm;
  if (useJack) {
    const peak = Math.abs(dc) + acm * Math.SQRT2;
    if (peak > METER.fuse[fuseKey]) {
      out.blow = fuseKey;
      out.notes.push(`${fmtEng(peak, 'A')} through the ${fuseKey === 'A' ? 'A' : 'mA/µA'} jack blew the ${fuseKey === 'A' ? '11 A' : '440 mA'} fuse.`);
      out.value = 0; return out;
    }
  }
  if (out.lead) { out.value = 0; return out; }
  out.value = out.ac ? acm : dc;
  const thr = useJack ? 1e-5 : 0.01;
  if (mode === 'AC' && acm > thr) out.hz = freq;
  return out;
}

/* ----- AC circuits two ways: combine impedances (Method 1), then check with KVL / KCL (Method 2) -----
   Elements are { name, kind: 'R'|'L'|'C', ohms } with ohms = R, XL or XC. Add and subtract in rectangular
   form, multiply and divide in polar form, as in the course homework. */
const cadd = (...zs) => zs.reduce((s, z) => [s[0] + z[0], s[1] + z[1]], [0, 0]);
const polar = (m, deg) => [m * Math.cos(deg * Math.PI / 180), m * Math.sin(deg * Math.PI / 180)];
const zOf = e => e.kind === 'R' ? [e.ohms, 0] : e.kind === 'L' ? [0, e.ohms] : [0, -e.ohms];
// 4 significant figures for magnitudes, 2 decimals for angles; tiny parts round to 0
const n4 = x => { const t = String(+(+x).toPrecision(4)); return t.startsWith('-') ? '−' + t.slice(1) : t; };
const a2 = x => { const t = String(+(+x).toFixed(2)); return t === '-0' ? '0' : t.startsWith('-') ? '−' + t.slice(1) : t; };
function clean(z) { const s = Math.max(cabs(z), 1e-30); return z.map(x => Math.abs(x) < s * 1e-9 ? 0 : x); }
function fmtRect(z, unit = '') { const [a, b] = clean(z); return `${n4(a)} ${b < 0 ? '−' : '+'} j${n4(Math.abs(b))}${unit ? ' ' + unit : ''}`; }
function fmtPolar(z, unit = '') { const c = clean(z), m = cabs(c); return `${n4(m)}∠${a2(m ? cdeg(c) : 0)}°${unit ? ' ' + unit : ''}`; }
/* "30 + j40", "-32-j24", "3+4j", "50∠53.13", "50<53.13°", "2 @ -53.13", "12 /_ 53.13" → [re, im]; null if not a number */
function parsePhasor(s) {
  const t = String(s).replace(/[−–]/g, '-').replace(/\s+/g, '').replace(/[Ωº°]|ohms?|deg|[VA]$/gi, '');
  if (!t) return null;
  let m = /^([+-]?[\d.]+(?:e[+-]?\d+)?)(?:∠|<|@|\/_|angle)([+-]?[\d.]+(?:e[+-]?\d+)?)$/i.exec(t);
  if (m) return isFinite(+m[1]) && isFinite(+m[2]) ? polar(+m[1], +m[2]) : null;
  const num = '[\\d.]+(?:e[+-]?\\d+)?';
  m = new RegExp(`^([+-]?${num})?(?:([+-])j(${num})?|([+-])(${num})?j)?$`, 'i').exec(t);
  if (m && (m[1] || m[2] || m[4])) {
    const re = m[1] ? +m[1] : 0;
    const im = m[2] ? (m[2] === '-' ? -1 : 1) * (m[3] ? +m[3] : 1) : m[4] ? (m[4] === '-' ? -1 : 1) * (m[5] ? +m[5] : 1) : 0;
    return isFinite(re) && isFinite(im) ? [re, im] : null;
  }
  m = new RegExp(`^([+-]?)j(${num})?$`, 'i').exec(t);
  if (m) return [0, (m[1] === '-' ? -1 : 1) * (m[2] ? +m[2] : 1)];
  return null;
}
/* does a typed answer match? 1% of the magnitude, or 0.01 for answers near zero */
function phasorMatches(typed, want, tol = 0.01) {
  const z = typeof typed === 'string' ? parsePhasor(typed) : typed;
  if (!z) return false;
  return Math.hypot(z[0] - want[0], z[1] - want[1]) <= Math.max(tol * cabs(want), 0.01);
}
/* "R30, XL 60, C=20" → elements; L/XL are inductive reactance, C/XC capacitive (in ohms) */
function parseElements(text, prefix = '') {
  const out = [], seen = {};
  for (const tok of String(text).split(/[,;\n]+/).map(s => s.trim()).filter(Boolean)) {
    const m = /^(XL|XC|R|L|C)(?:\d+(?=[\s=:]))?\s*[=:]?\s*(.+)$/i.exec(tok);
    const v = m && parseEng(m[2].replace(/\s*(Ω|ohms?)$/i, ''));
    if (!m || !(v > 0)) return { error: `Could not read "${tok}". Write each part as R 30, XL 60 or XC 20 (ohms).` };
    const kind = m[1].toUpperCase().replace('X', '');
    seen[kind] = (seen[kind] || 0) + 1;
    out.push({ name: kind + prefix + (seen[kind] > 1 ? seen[kind] : ''), kind, ohms: v });
  }
  return { elements: out };
}

/*
 * spec: { vs: [mag, deg], series: [elements], parallel: [two elements] }
 * Series only: series RLC. Parallel only: two branches across the source. Both: series parts, then the parallel group Zp.
 * Returns { kind, ZT, I, steps: [{ n, method, ask, lines, answers: [{ label, z, unit, form }] }], parts: { name: { z, v, i } } }
 */
function acTwoWays(spec) {
  const S = spec.series || [], Pl = spec.parallel || [];
  const Vs = polar(spec.vs[0], spec.vs[1] || 0), vsT = fmtPolar(Vs, 'V');
  if (!S.length && !Pl.length) return { error: 'Add at least one part.' };
  if (Pl.length && Pl.length !== 2) return { error: 'The parallel group needs exactly two branches. Combine branches two at a time with product over sum.' };
  const kind = !Pl.length ? 'series' : !S.length ? 'parallel' : 'seriesparallel';
  const steps = [], parts = {};
  const step = (method, ask, lines, answers) => steps.push({ n: steps.length + 1, method, ask, lines, answers });
  const A = (label, z, unit, form) => ({ label, z: clean(z), unit, form });
  const sub = e => e.name.replace(/^([RLC])/, 'Z$1');
  const rectAll = (list, unit) => list.map(e => A(sub(e), zOf(e), unit, 'rect'));
  const and = xs => xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1];
  const zLines = list => list.map(e => `${e.kind} = ${n4(e.ohms)} Ω → ${sub(e)} = ${fmtRect(zOf(e), 'Ω')}`);
  if (kind === 'series') {
    const Z = S.map(zOf), ZT = cadd(...Z), I = cdiv(Vs, ZT);
    step(1, `Write ${and(S.map(sub))} in rectangular form.`, zLines(S), rectAll(S, 'Ω'));
    step(1, 'Add them to get ZT in rectangular form.', [`ZT = ${S.map(e => '(' + fmtRect(zOf(e)) + ')').join(' + ')} = ${fmtRect(ZT, 'Ω')}`], [A('ZT', ZT, 'Ω', 'rect')]);
    step(1, 'Convert ZT to polar form.', [`|ZT| = √(${n4(ZT[0])}² + ${n4(ZT[1])}²) = ${n4(cabs(ZT))} Ω`, `θ = tan⁻¹(${n4(ZT[1])} / ${n4(ZT[0])}) = ${a2(cdeg(ZT))}°`, `ZT = ${fmtPolar(ZT, 'Ω')}`], [A('ZT', ZT, 'Ω', 'polar')]);
    step(1, 'Find the current: I = Vs / ZT.', [`I = ${vsT} / ${fmtPolar(ZT, 'Ω')} = ${fmtPolar(I, 'A')}`, 'Divide the magnitudes, subtract the angles.'], [A('I', I, 'A', 'polar')]);
    const Vk = S.map(e => cmul(I, zOf(e)));
    S.forEach((e, k) => { parts[e.name] = { z: zOf(e), v: Vk[k], i: I }; });
    step(2, `The current is the same in every part. Find ${and(S.map(e => 'V' + e.name + ' = I × ' + sub(e)))} in polar form.`,
      S.map((e, k) => `V${e.name} = ${fmtPolar(I, 'A')} × ${fmtPolar(zOf(e), 'Ω')} = ${fmtPolar(Vk[k], 'V')}`), S.map((e, k) => A('V' + e.name, Vk[k], 'V', 'polar')));
    step(2, 'Convert each voltage to rectangular form.', S.map((e, k) => `V${e.name} = ${fmtRect(Vk[k], 'V')}`), S.map((e, k) => A('V' + e.name, Vk[k], 'V', 'rect')));
    const sum = cadd(...Vk);
    step(2, `Add them. Does the total equal Vs = ${vsT}?`, [`${S.map(e => 'V' + e.name).join(' + ')} = ${fmtRect(sum, 'V')} = ${fmtPolar(sum, 'V')}`, phasorMatches(sum, Vs, 1e-6) ? '✔ KVL holds' : '✘ KVL does not hold: recheck the steps'], [A('Sum', sum, 'V', 'rect')]);
    return { kind, ZT, I, Vs, steps, parts };
  }
  const [b1, b2] = Pl, z1 = zOf(b1), z2 = zOf(b2), prod = cmul(z1, z2), sum = cadd(z1, z2), Zp = cdiv(prod, sum);
  if (kind === 'parallel') {
    const ZT = Zp, IT = cdiv(Vs, ZT);
    step(1, `Write ${sub(b1)} and ${sub(b2)} in rectangular and polar form.`, Pl.map(e => `${sub(e)} = ${fmtRect(zOf(e))} = ${fmtPolar(zOf(e), 'Ω')}`), Pl.map(e => A(sub(e), zOf(e), 'Ω', 'both')));
    step(1, `Product (top): multiply ${sub(b1)} × ${sub(b2)} in polar form.`, [`${fmtPolar(z1)} × ${fmtPolar(z2)} = ${fmtPolar(prod)}`, 'Multiply the magnitudes, add the angles.'], [A(`${sub(b1)} × ${sub(b2)}`, prod, '', 'polar')]);
    step(1, `Sum (bottom): add ${sub(b1)} + ${sub(b2)} in rectangular form, then convert to polar.`, [`(${fmtRect(z1)}) + (${fmtRect(z2)}) = ${fmtRect(sum)} = ${fmtPolar(sum)}`], [A(`${sub(b1)} + ${sub(b2)}`, sum, '', 'polar')]);
    step(1, 'Divide product by sum to get ZT in polar form.', [`ZT = ${fmtPolar(prod)} / ${fmtPolar(sum)} = ${fmtPolar(ZT, 'Ω')}`], [A('ZT', ZT, 'Ω', 'polar')]);
    step(1, 'Find the total current: IT = Vs / ZT.', [`IT = ${vsT} / ${fmtPolar(ZT, 'Ω')} = ${fmtPolar(IT, 'A')}`], [A('IT', IT, 'A', 'polar')]);
    const I1 = cdiv(Vs, z1), I2 = cdiv(Vs, z2), Isum = cadd(I1, I2);
    parts[b1.name] = { z: z1, v: Vs, i: I1 }; parts[b2.name] = { z: z2, v: Vs, i: I2 };
    step(2, `Every branch has the full ${n4(spec.vs[0])} V. Find I${b1.name} = Vs / ${sub(b1)} and I${b2.name} = Vs / ${sub(b2)} in polar form.`,
      [`I${b1.name} = ${vsT} / ${fmtPolar(z1, 'Ω')} = ${fmtPolar(I1, 'A')}`, `I${b2.name} = ${vsT} / ${fmtPolar(z2, 'Ω')} = ${fmtPolar(I2, 'A')}`], [A('I' + b1.name, I1, 'A', 'polar'), A('I' + b2.name, I2, 'A', 'polar')]);
    step(2, 'Convert both to rectangular form and add them to get IT.', [`I${b1.name} = ${fmtRect(I1, 'A')}, I${b2.name} = ${fmtRect(I2, 'A')}`, `IT = ${fmtRect(Isum, 'A')}`], [A('IT', Isum, 'A', 'rect')]);
    step(2, 'Convert IT to polar form. Does it match Method 1?', [`IT = ${fmtPolar(Isum, 'A')}`, phasorMatches(Isum, IT, 1e-6) ? '✔ KCL matches Method 1' : '✘ KCL does not match: recheck the steps'], [A('IT', Isum, 'A', 'polar')]);
    return { kind, ZT, I: IT, Vs, steps, parts };
  }
  // series-parallel: the parallel group first, then the series parts
  const ZT = cadd(...S.map(zOf), Zp), I = cdiv(Vs, ZT);
  step(1, `Find Zp = (${sub(b1)} × ${sub(b2)}) / (${sub(b1)} + ${sub(b2)}). Give it in polar and rectangular form.`,
    [`${sub(b1)} × ${sub(b2)} = ${fmtPolar(z1)} × ${fmtPolar(z2)} = ${fmtPolar(prod)}`, `${sub(b1)} + ${sub(b2)} = ${fmtRect(sum)} = ${fmtPolar(sum)}`, `Zp = ${fmtPolar(prod)} / ${fmtPolar(sum)} = ${fmtPolar(Zp, 'Ω')} = ${fmtRect(Zp, 'Ω')}`],
    [A(`${sub(b1)} × ${sub(b2)}`, prod, '', 'polar'), A(`${sub(b1)} + ${sub(b2)}`, sum, '', 'polar'), A('Zp', Zp, 'Ω', 'both')]);
  step(1, `Add ${and(S.map(e => e.name))} in series: ZT = ${S.map(sub).join(' + ')} + Zp. Give it in rectangular and polar form.`,
    [`ZT = ${S.map(e => '(' + fmtRect(zOf(e)) + ')').join(' + ')} + (${fmtRect(Zp)}) = ${fmtRect(ZT, 'Ω')} = ${fmtPolar(ZT, 'Ω')}`], [A('ZT', ZT, 'Ω', 'both')]);
  step(1, 'Find the source current: I = Vs / ZT.', [`I = ${vsT} / ${fmtPolar(ZT, 'Ω')} = ${fmtPolar(I, 'A')}`], [A('I', I, 'A', 'polar')]);
  const Vk = S.map(e => cmul(I, zOf(e)));
  S.forEach((e, k) => { parts[e.name] = { z: zOf(e), v: Vk[k], i: I }; });
  step(1, `Find the voltage across ${and(S.map(e => e.name))}: ${and(S.map(e => 'V' + e.name + ' = I × ' + sub(e)))}.`,
    S.map((e, k) => `V${e.name} = ${fmtPolar(I, 'A')} × ${fmtPolar(zOf(e), 'Ω')} = ${fmtPolar(Vk[k], 'V')}`), S.map((e, k) => A('V' + e.name, Vk[k], 'V', 'polar')));
  const Vp = cmul(I, Zp);
  step(1, 'Find the voltage across the parallel group: Vp = I × Zp.', [`Vp = ${fmtPolar(I, 'A')} × ${fmtPolar(Zp, 'Ω')} = ${fmtPolar(Vp, 'V')}`], [A('Vp', Vp, 'V', 'polar')]);
  const I1 = cdiv(Vp, z1), I2 = cdiv(Vp, z2);
  parts[b1.name] = { z: z1, v: Vp, i: I1 }; parts[b2.name] = { z: z2, v: Vp, i: I2 };
  step(1, `Vp is across both ${b1.name} and ${b2.name}. Find I${b1.name} = Vp / ${sub(b1)} and I${b2.name} = Vp / ${sub(b2)}.`,
    [`I${b1.name} = ${fmtPolar(Vp, 'V')} / ${fmtPolar(z1, 'Ω')} = ${fmtPolar(I1, 'A')}`, `I${b2.name} = ${fmtPolar(Vp, 'V')} / ${fmtPolar(z2, 'Ω')} = ${fmtPolar(I2, 'A')}`], [A('I' + b1.name, I1, 'A', 'polar'), A('I' + b2.name, I2, 'A', 'polar')]);
  const kvl = cadd(...Vk, Vp);
  step(2, `KVL around the loop: convert ${S.map(e => 'V' + e.name).join(', ')} and Vp to rectangular form and add them. Do you get Vs?`,
    [...S.map((e, k) => `V${e.name} = ${fmtRect(Vk[k], 'V')}`), `Vp = ${fmtRect(Vp, 'V')}`, `Sum = ${fmtRect(kvl, 'V')} ${phasorMatches(kvl, Vs, 1e-6) ? '✔' : '✘'}`],
    [...S.map((e, k) => A('V' + e.name, Vk[k], 'V', 'rect')), A('Vp', Vp, 'V', 'rect'), A('Sum', kvl, 'V', 'rect')]);
  const kcl = cadd(I1, I2);
  step(2, `KCL at the top node: convert I${b1.name} and I${b2.name} to rectangular form and add them. Do you get I?`,
    [`I${b1.name} = ${fmtRect(I1, 'A')}, I${b2.name} = ${fmtRect(I2, 'A')}`, `Sum = ${fmtRect(kcl, 'A')} = ${fmtPolar(kcl, 'A')} ${phasorMatches(kcl, I, 1e-6) ? '✔' : '✘'}`],
    [A('I' + b1.name, I1, 'A', 'rect'), A('I' + b2.name, I2, 'A', 'rect'), A('Sum', kcl, 'A', 'rect')]);
  return { kind, ZT, I, Vs, Zp, Vp, steps, parts };
}

/* The course homework "Solving AC Circuits Two Ways": three circuits, each solved by combining impedances and checked with KVL / KCL */
const HOMEWORK = [{
  id: 'ac2ways', title: 'Solving AC circuits two ways', topic: 'Combining impedances, and KVL / KCL with complex numbers',
  intro: 'Solve each circuit two ways. Method 1 combines the impedances into one. Method 2 uses KVL or KCL. Both methods must give the same answer, so the second method checks the first.',
  method1: ['Write every part as an impedance in rectangular form: R → R + j0, L → 0 + jXL, C → 0 − jXC.', 'Combine them. Series: add in rectangular form. Parallel: ZT = (Z1 × Z2) / (Z1 + Z2).', 'Convert ZT to polar form: |Z| = √(a² + b²), θ = tan⁻¹(b / a).', 'Find the total current: IT = Vs / ZT (divide in polar: divide magnitudes, subtract angles).', 'Work back to each part: V = I × Z (multiply magnitudes, add angles) or I = V / Z.'],
  method2: ['Series parts: the same current flows through every part. Find each part\'s voltage, convert each to rectangular form, and add them. KVL says they must add up to Vs: Vs = V1 + V2 + V3.', 'Parallel parts: every branch has the same voltage. Find each branch current (I = V / Z), convert each to rectangular form, and add them. KCL says they must add up to the total: IT = I1 + I2.', 'Add and subtract in rectangular form. Multiply and divide in polar form.'],
  problems: [
    { key: 'series', title: 'Circuit 1: Series RLC', sample: 'hwseries',
      spec: { vs: [100, 0], series: [{ name: 'R', kind: 'R', ohms: 30 }, { name: 'L', kind: 'L', ohms: 60 }, { name: 'C', kind: 'C', ohms: 20 }] },
      think: { q: 'VL is 120 V, more than the 100 V source. How can a part have more voltage than the source?',
        a: 'VL and VC point in opposite directions (VL at +36.87°, VC at −143.13°: 180° apart), so they partly cancel. Only their difference, 120 − 40 = 80 V, adds to VR at right angles: √(60² + 80²) = 100 V. A single part can exceed the source as long as the phasor sum still equals Vs. At resonance the effect is even bigger.' } },
    { key: 'parallel', title: 'Circuit 2: Parallel RC', sample: 'hwparallel',
      spec: { vs: [24, 0], parallel: [{ name: 'R', kind: 'R', ohms: 8 }, { name: 'C', kind: 'C', ohms: 6 }] },
      think: { q: 'A DMM would read 3 A and 4 A in the branches. Why is the total 5 A and not 7 A?',
        a: 'The DMM shows only magnitudes. IR is at 0° and IC is at +90°, so they add at right angles like the sides of a triangle: √(3² + 4²) = 5 A. They would only add to 7 A if they were in phase. KCL holds for the phasors, not for the meter readings.' } },
    { key: 'seriesparallel', title: 'Circuit 3: Series-parallel', sample: 'hwseriesparallel',
      spec: { vs: [32, 0], series: [{ name: 'R1', kind: 'R', ohms: 5.6 }], parallel: [{ name: 'R2', kind: 'R', ohms: 20 }, { name: 'L', kind: 'L', ohms: 15 }] },
      think: { q: 'For a series-parallel circuit, why do you have to combine the parallel group first?',
        a: 'R1 is in series with the whole group, not with R2 or L alone: the current through R1 splits between them. Only after the group is one impedance, Zp, is there a single chain of series parts that you can add. Working from the far end back toward the source always reduces the circuit one step at a time.' } }
  ]
}];

/* the homework circuits on the breadboard at 1 kHz: L = XL / (2πf), C = 1 / (2πf·XC).
   Textbook voltages and currents are far above real ¼ W parts, so these get ratings to match. */
const HW_F = 1000;
const hwL = x => x / (2 * Math.PI * HW_F), hwC = x => 1 / (2 * Math.PI * HW_F * x);
const HW_RATED = { pRating: 500, iRating: 10, vRating: 250 };
Object.assign(SAMPLE_CIRCUITS, {
  hwseries: {
    label: 'Homework: series RLC (two ways)', topic: 'AC homework', mode: 'AC', freq: HW_F, homework: ['ac2ways', 'series'],
    about: 'Circuit 1 from the homework: Vs = 100∠0° V across R = 30 Ω, XL = 60 Ω and XC = 20 Ω in series. The board runs at 1 kHz, so L = 60 / (2π·1k) = 9.55 mH and C = 1 / (2π·1k·20) = 7.96 µF. The yellow jumper from the source to R is where a DMM goes to read the current.',
    expect: 'ZT = 30 + j40 = 50∠53.13° Ω, so I = 2∠−53.13° A. VR = 60 V, VL = 120 V and VC = 40 V on the DMM, and the phasors add back to 100∠0° V. The scope shows CH1 on the source (141 V peak) and CH2 across C, which lags the source by 143°.',
    try: 'Change the frequency to 500 Hz: XL halves and XC doubles, so the answers no longer match the homework. Then find the resonant frequency where XL = XC and watch VR rise to the full 100 V. To read the current, delete the yellow jumper, set the meter to A~ with the red lead in A, and put the probes on columns 3 and 5.',
    scope: { ch1: 'j3', ch2: 'j15', gnd: null },
    checks: [['I', 'R', 'i'], ['VR', 'R', 'v'], ['VL', 'L', 'v'], ['VC', 'C', 'v']],
    steps: [['GND', 'BN2'], ['VAC-IDEAL', 'h3', 'BN3', { value: 100 }], ['wire', 'g3', 'g5', { color: W.yellow }],
      ['R-CF', 'h5', 'h10', Object.assign({ value: 30, name: 'R' }, HW_RATED)], ['L-IDEAL', 'g10', 'g15', Object.assign({ value: hwL(60), name: 'L' }, HW_RATED)], ['C-X7R', 'h15', 'BN15', Object.assign({ value: hwC(20), name: 'C' }, HW_RATED)]]
  },
  hwparallel: {
    label: 'Homework: parallel RC (two ways)', topic: 'AC homework', mode: 'AC', freq: HW_F, homework: ['ac2ways', 'parallel'],
    about: 'Circuit 2 from the homework: Vs = 24∠0° V across R = 8 Ω in parallel with XC = 6 Ω. At 1 kHz, C = 1 / (2π·1k·6) = 26.5 µF. Each branch is fed through its own jumper (yellow to R, green to C), so you can swap either jumper for the DMM and read that branch current.',
    expect: 'ZT = 4.8∠−53.13° Ω and IT = 5∠53.13° A. The branches carry IR = 3∠0° A and IC = 4∠90° A: the DMM reads 3 A and 4 A, but they add as phasors to 5 A, not 7 A.',
    try: 'Delete the yellow jumper, set the meter to A~ with the red lead in A, and probe columns 3 and 7 to read IR = 3 A. Put it back and do the same with the green jumper (columns 3 and 12) for IC. Then double C: IC doubles and the total current swings closer to +90°.',
    scope: { ch1: 'j3', ch2: null, gnd: null },
    checks: [['IT', 'Vs', 'i', -1], ['IR', 'R', 'i'], ['IC', 'C', 'i'], ['V across both', 'R', 'v']],
    steps: [['GND', 'BN2'], ['VAC-IDEAL', 'h3', 'BN3', { value: 24, name: 'Vs' }], ['wire', 'g3', 'g7', { color: W.yellow }], ['R-CF', 'h7', 'BN7', Object.assign({ value: 8, name: 'R' }, HW_RATED)],
      ['wire', 'i3', 'i12', { color: W.green }], ['C-X7R', 'h12', 'BN12', Object.assign({ value: hwC(6), name: 'C' }, HW_RATED)]]
  },
  hwseriesparallel: {
    label: 'Homework: series-parallel (two ways)', topic: 'AC homework', mode: 'AC', freq: HW_F, homework: ['ac2ways', 'seriesparallel'],
    about: 'Circuit 3 from the homework: Vs = 32∠0° V, R1 = 5.6 Ω in series with R2 = 20 Ω in parallel with XL = 15 Ω. At 1 kHz, L = 15 / (2π·1k) = 2.39 mH. Column 8 is the top node of the parallel group; R2 and L each hang from it through a jumper.',
    expect: 'Zp = 12∠53.13° Ω, ZT = 16∠36.87° Ω and I = 2∠−36.87° A. VR1 = 11.2 V and Vp = 24 V (11.2 + 24 is not 32: they are 53° apart). IR2 = 1.2 A and IL = 1.6 A. The scope has CH1 on the source and CH2 on column 8: Vp leads the source by 16.26°.',
    try: 'Measure VR1 with the DMM across columns 3 and 8. To see it on the scope you would clip the ground lead to column 8, which shorts L and R2 to ground through the scope. Try it with the ground clip, then use MATH (CH1 − CH2) instead.',
    scope: { ch1: 'j3', ch2: 'j8', gnd: null },
    checks: [['I', 'R1', 'i'], ['VR1', 'R1', 'v'], ['Vp', 'R2', 'v'], ['IR2', 'R2', 'i'], ['IL', 'L', 'i']],
    steps: [['GND', 'BN2'], ['VAC-IDEAL', 'h3', 'BN3', { value: 32 }], ['R-CF', 'g3', 'g8', Object.assign({ value: 5.6, name: 'R1' }, HW_RATED)],
      ['wire', 'h8', 'h12', { color: W.yellow }], ['R-CF', 'i12', 'BN12', Object.assign({ value: 20, name: 'R2' }, HW_RATED)],
      ['wire', 'i8', 'i17', { color: W.green }], ['L-IDEAL', 'h17', 'BN17', Object.assign({ value: hwL(15), name: 'L' }, HW_RATED)]]
  }
});
/* expected-vs-board for a homework sample: the homework answer next to what the solved board reads */
function homeworkChecks(key, res) {
  const s = SAMPLE_CIRCUITS[key];
  if (!s || !s.homework || !res || !res.ok || res.mode !== 'AC') return null;
  const set = HOMEWORK.find(h => h.id === s.homework[0]), prob = set && set.problems.find(p => p.key === s.homework[1]);
  if (!prob) return null;
  const sol = acTwoWays(prob.spec);
  return s.checks.map(([label, name, q, sign = 1]) => {
    const p = res.topo.els.find(x => x.name === name), r = p && res.parts[p.id];
    const want = name === 'Vs' ? (q === 'i' ? sol.I : sol.Vs) : sol.parts[name] && sol.parts[name][q];
    const got = r && r[q] ? [sign * r[q][0], sign * r[q][1]] : null;
    return { label, want, got, ok: !!(got && want && phasorMatches(got, want)) };
  });
}

/* ----- virtual oscilloscope: two channels, 1 MΩ inputs, ground clip tied to earth like a bench scope -----
   The circuit's ground is earth too (through the generator or supply), so clipping the ground lead onto any
   other node shorts that node to ground. Traces come from the DC operating point plus the AC phasor:
   v(t) = Vdc + √2·|V|·cos(ωt + θ). */
const SCOPE = { rin: 1e6, vdiv: [0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100], tdiv: [] };
for (const e of [-7, -6, -5, -4, -3, -2, -1, 0]) for (const m of [1, 2, 5]) SCOPE.tdiv.push(+(m * Math.pow(10, e)).toPrecision(1));
/* sc: { ch1, ch2, gnd } holes (null = not clipped on). Returns { ch: [{ dc, ph } | null, ...], freq, ac, notes, shorted } */
function scopeMeasure(parts, opts, sc) {
  const mode = opts.mode || 'DC', freq = opts.freq || 1000;
  const out = { ch: [null, null], freq, ac: mode === 'AC', notes: [], shorted: null };
  if (!sc || (!sc.ch1 && !sc.ch2)) return out;
  if (!parts.some(p => p.type === 'VDC' || p.type === 'VAC')) return out;
  const topo = topology(parts);
  const extra = [];
  let ref = null; // hole at circuit ground, for the earth connection
  const g = parts.find(p => p.type === 'GND');
  if (g) ref = g.a; else { const s = topo.els.find(p => p.type === 'VDC') || topo.els.find(p => p.type === 'VAC'); if (s) ref = s.b; }
  if (sc.gnd && ref && topo.find(baseNetOfHole(sc.gnd)) !== topo.find(baseNetOfHole(ref))) {
    out.shorted = netName(topo.find(baseNetOfHole(sc.gnd)), topo);
    out.notes.push(`The ground clip is tied to earth, and so is the circuit's ground. Clipping it onto ${out.shorted} shorts that node to ground through the scope and changes the circuit. To look across a part that isn't grounded, put CH1 and CH2 on its two ends and use MATH (CH1 − CH2).`);
    extra.push({ id: '__sg', type: 'wire', a: sc.gnd, b: ref, name: 'scope ground' });
  }
  const clip = sc.gnd || ref;
  ['ch1', 'ch2'].forEach((k, q) => { if (sc[k]) extra.push({ id: '__si' + q, type: 'R', model: 'R-CF', a: sc[k], b: clip, value: SCOPE.rin, name: 'scope ' + k.toUpperCase() }); });
  // an inductor shorted out by the ground clip would stop the DC solve, so give ideal ones a 1 µΩ winding
  const base = parts.map(p => p.type === 'L' && !(p.dcr > 0) ? Object.assign({}, p, { dcr: 1e-6 }) : p);
  const r = analyze(base.concat(extra), { mode, freq });
  if (!r.ok) { out.notes.push(...r.errors); return out; }
  ['ch1', 'ch2'].forEach((k, q) => {
    if (!sc[k]) return;
    const dc = nodeVolt(r, sc[k], false) - nodeVolt(r, clip, false);
    let ph = [0, 0];
    if (mode === 'AC') { const a = nodeVolt(r, sc[k], true), b = nodeVolt(r, clip, true); ph = [a[0] - b[0], a[1] - b[1]]; }
    out.ch[q] = { dc, ph };
    // a tip on an op-amp output: the real waveform cannot pass the chip's output swing limits
    const root = r.topo.find(baseNetOfHole(sc[k]));
    if (clip === ref || !sc.gnd) for (const p of r.topo.els) {
      if (p.type !== 'OPAMP') continue;
      const c = catalogOf(p), pv = r.dc.parts[p.id] && r.dc.parts[p.id].pinV;
      if (pv && c.units.some(u => r.topo.find(baseNetOfHole(p.pins[u.out])) === root) && pv[c.vp][0] - pv[c.vn][0] > 1) {
        out.ch[q].clip = [pv[c.vn][0] + c.model.headLo, pv[c.vp][0] - c.model.headHi];
        if (scopeClips(out.ch[q]) && !out.notes.some(n => n.includes('clipping'))) out.notes.push(`${p.name} is clipping: its output cannot swing past ${fmtEng(out.ch[q].clip[0], 'V')} and ${fmtEng(out.ch[q].clip[1], 'V')}, so the top or bottom of the sine is flattened. Lower the input or the gain.`);
      }
    }
  });
  return out;
}
/* The instruments read the board itself, whatever analysis the readings panel shows: with an AC
   source on the board they see its sine wave riding on the DC levels. */
function instrumentOpts(parts, opts = {}) {
  return { mode: parts.some(p => p.type === 'VAC') ? 'AC' : 'DC', freq: opts.freq || 1000 };
}
/* one sample of a trace: the sine on its DC level, flattened where an op-amp output runs into its rails */
function scopeSample(t, wt, coupling = 'DC') {
  let v = t.dc + Math.SQRT2 * cabs(t.ph) * Math.cos(wt + cdeg(t.ph) * Math.PI / 180);
  if (t.clip) v = Math.max(t.clip[0], Math.min(t.clip[1], v));
  return coupling === 'AC' ? v - scopeMean(t) : v;
}
function scopeClips(t) { const pk = Math.SQRT2 * cabs(t.ph); return !!t.clip && (t.dc + pk > t.clip[1] + 1e-9 || t.dc - pk < t.clip[0] - 1e-9); }
function scopeMean(t) {
  if (!scopeClips(t)) return t.clip ? Math.max(t.clip[0], Math.min(t.clip[1], t.dc)) : t.dc;
  let s = 0; for (let k = 0; k < 360; k++) s += scopeSample(t, k * Math.PI / 180);
  return s / 360;
}
/* what the scope's measure menu shows for a trace: AC coupling drops the DC part */
function scopeStats(t, freq, coupling = 'DC') {
  if (!t) return null;
  if (scopeClips(t)) {
    let mx = -Infinity, mn = Infinity, sq = 0;
    for (let k = 0; k < 360; k++) { const v = scopeSample(t, k * Math.PI / 180, coupling); mx = Math.max(mx, v); mn = Math.min(mn, v); sq += v * v; }
    return { vpp: mx - mn, vmax: mx, vmin: mn, vavg: coupling === 'AC' ? 0 : scopeMean(t), vrms: Math.sqrt(sq / 360), freq, period: 1 / freq, deg: cdeg(t.ph), clipped: true };
  }
  const dc = coupling === 'AC' ? 0 : scopeMean(t), pk = Math.SQRT2 * cabs(t.ph), ac = cabs(t.ph) > 1e-9;
  return { vpp: 2 * pk, vmax: dc + pk, vmin: dc - pk, vavg: dc, vrms: Math.hypot(dc, cabs(t.ph)), freq: ac ? freq : 0, period: ac ? 1 / freq : 0, deg: cdeg(t.ph) };
}
/* phase of CH2 relative to CH1, in (−180°, 180°]; positive means CH2 leads */
function scopePhase(a, b) {
  if (!a || !b || cabs(a.ph) < 1e-9 || cabs(b.ph) < 1e-9) return null;
  let d = cdeg(b.ph) - cdeg(a.ph);
  while (d <= -180) d += 360;
  while (d > 180) d -= 360;
  return d;
}
/* smallest 1-2-5 step that fits: V/div for about 6 divisions peak to peak, s/div for about 2 cycles across 10 divisions */
function scopeAutoscale(st, freq) {
  const span = Math.max(0, ...st.filter(Boolean).map(s => Math.max(Math.abs(s.vmax), Math.abs(s.vmin), s.vpp / 2)));
  const vdiv = SCOPE.vdiv.find(v => v * 3.5 >= span) || SCOPE.vdiv[SCOPE.vdiv.length - 1];
  const tdiv = SCOPE.tdiv.find(t => t * 10 >= 2 / freq) || SCOPE.tdiv[SCOPE.tdiv.length - 1];
  return { vdiv, tdiv };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    E_BASE, SERIES_TOL, POWER_RATINGS, LED_TYPES, CATALOG, CATALOG_BY_ID, catalogOf, snap, isInSeries, parseEng, fmtEng, rkm, colorBands, smdCode,
    capCodeEncode, capCodeDecode, baseNetOfHole, holesOfBaseNet, footprintHoles, leadsOf, csolve, cabs, cdeg, topology, analyze, spiceNetlist, SAMPLE_CIRCUITS, sampleParts,
    spiceValue, parseNetlist, parseAsc, layoutCircuit, importLTspice, decodeSpiceFile, instrumentOpts, METER, METER_RANGES, meterDisplay, meterMeasure,
    cadd, polar, fmtRect, fmtPolar, parsePhasor, phasorMatches, parseElements, acTwoWays, HOMEWORK, homeworkChecks, SCOPE, scopeMeasure, scopeStats, scopePhase, scopeAutoscale, scopeSample, scopeClips, parseHole
  };
}
