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

/* LED electrical presets: typical Vf at ~10–20 mA for 5 mm through-hole parts */
const LED_TYPES = {
  red:    { label: 'Red (625 nm)',     vf: 2.0, rs: 10, hex: '#ef3b2c' },
  orange: { label: 'Orange (605 nm)',  vf: 2.0, rs: 10, hex: '#ff8a1c' },
  yellow: { label: 'Yellow (590 nm)',  vf: 2.1, rs: 10, hex: '#ffd21c' },
  green:  { label: 'Green (525 nm)',   vf: 3.0, rs: 15, hex: '#3fdc5a' },
  blue:   { label: 'Blue (470 nm)',    vf: 3.1, rs: 15, hex: '#3a8bff' },
  white:  { label: 'White',            vf: 3.1, rs: 15, hex: '#f4f7ff' },
  ir:     { label: 'Infrared (940 nm)', vf: 1.3, rs: 5,  hex: '#7a3b5a' }
};

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

/* ----- complex linear solve (Gaussian elimination, partial pivot) ----- */
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
const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cdiv = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
const cabs = a => Math.hypot(a[0], a[1]);
const cdeg = a => Math.atan2(a[1], a[0]) * 180 / Math.PI;

const ELEMENT_TYPES = ['R', 'C', 'L', 'LED', 'VDC', 'VAC'];
const GMIN = 1e-12;

/* Topology: nets after wires, ground choice, structural problems */
function topology(parts) {
  const parent = new Map();
  const find = x => { if (!parent.has(x)) parent.set(x, x); let r = x; while (parent.get(r) !== r) r = parent.get(r); parent.set(x, r); return r; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(rb, ra); };
  for (const p of parts) { if (p.a) find(baseNetOfHole(p.a)); if (p.b) find(baseNetOfHole(p.b)); }
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
  for (const p of els) for (const k of [p.a, p.b]) { const r = find(baseNetOfHole(k)); used.add(r); leadCount.set(r, (leadCount.get(r) || 0) + 1); }
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

/* Modified nodal analysis. mode 'DC' or 'AC' (phasors in rms at freq). */
function solveMNA(topo, mode, omega, ledOn) {
  const { find, gnd, used, els } = topo;
  const idx = new Map(); let n = 0;
  for (const r of used) if (r !== gnd) idx.set(r, n++);
  const node = k => { const r = find(baseNetOfHole(k)); return r === gnd ? -1 : idx.get(r); };
  const vs = [];
  for (const p of els) {
    if (p.type === 'VDC' || p.type === 'VAC') vs.push(p);
    else if (p.type === 'L' && mode === 'DC' && !(p.dcr > 0)) vs.push(p);
  }
  const N = n + vs.length;
  const A = Array.from({ length: N }, () => Array.from({ length: N }, () => [0, 0]));
  const b = Array.from({ length: N }, () => [0, 0]);
  const addA = (i, j, y) => { if (i < 0 || j < 0) return; A[i][j][0] += y[0]; A[i][j][1] += y[1]; };
  const stampY = (i, j, y) => { addA(i, i, y); addA(j, j, y); addA(i, j, [-y[0], -y[1]]); addA(j, i, [-y[0], -y[1]]); };
  for (let i = 0; i < n; i++) A[i][i][0] += GMIN;
  const admit = {};
  for (const p of els) {
    const i = node(p.a), j = node(p.b);
    let y = null;
    if (p.type === 'R') y = [1 / p.value, 0];
    else if (p.type === 'C') y = mode === 'DC' ? [0, 0] : [0, omega * p.value];
    else if (p.type === 'L') {
      if (p.dcr > 0) y = mode === 'DC' ? [1 / p.dcr, 0] : cdiv([1, 0], [p.dcr, omega * p.value]);
      else if (mode === 'AC') y = [0, -1 / (omega * p.value)];
    } else if (p.type === 'LED') {
      const t = LED_TYPES[p.color] || LED_TYPES.red;
      if (ledOn[p.id]) {
        const G = 1 / t.rs; y = [G, 0];
        if (mode === 'DC') { if (i >= 0) b[i][0] += G * t.vf; if (j >= 0) b[j][0] -= G * t.vf; }
      } else y = [1e-9, 0];
    }
    if (y) { stampY(i, j, y); admit[p.id] = y; }
  }
  vs.forEach((p, k) => {
    const m = n + k, i = node(p.a), j = node(p.b);
    if (i >= 0) { A[i][m][0] += 1; A[m][i][0] += 1; }
    if (j >= 0) { A[j][m][0] -= 1; A[m][j][0] -= 1; }
    let v = [0, 0];
    if (p.type === 'VDC' && mode === 'DC') v = [p.value, 0];
    if (p.type === 'VAC' && mode === 'AC') { const ph = (p.phase || 0) * Math.PI / 180; v = [p.value * Math.cos(ph), p.value * Math.sin(ph)]; }
    b[m] = v;
  });
  const x = N ? csolve(A, b) : [];
  if (!x || x.some(z => !isFinite(z[0]) || !isFinite(z[1]))) return null;
  const V = k => { const i = node(k); return i < 0 ? [0, 0] : x[i]; };
  const out = { nodeV: new Map(), parts: {} };
  for (const [r, i] of idx) out.nodeV.set(r, x[i]);
  out.nodeV.set(gnd, [0, 0]);
  for (const p of els) {
    const va = V(p.a), vb = V(p.b), v = [va[0] - vb[0], va[1] - vb[1]];
    let i;
    const k = vs.indexOf(p);
    if (k >= 0) i = x[n + k];
    else if (p.type === 'LED' && ledOn[p.id] && mode === 'DC') { const t = LED_TYPES[p.color] || LED_TYPES.red; i = [(v[0] - t.vf) / t.rs, 0]; }
    else i = admit[p.id] ? cmul(admit[p.id], v) : [0, 0];
    out.parts[p.id] = { v, i };
  }
  return out;
}

function analyze(parts, opts = {}) {
  const mode = opts.mode || 'DC';
  const freq = opts.freq || 1000;
  const topo = topology(parts);
  const res = { ok: true, mode, freq, errors: [], warnings: [], topo, parts: {}, nodeV: new Map() };
  if (!topo.els.length) { res.empty = true; return res; }
  // structural checks
  const vsU = new Map();
  const vf = x => { if (!vsU.has(x)) vsU.set(x, x); let r = x; while (vsU.get(r) !== r) r = vsU.get(r); return r; };
  for (const p of topo.els) {
    const ra = topo.find(baseNetOfHole(p.a)), rb = topo.find(baseNetOfHole(p.b));
    const isV = p.type === 'VDC' || p.type === 'VAC' || (p.type === 'L' && !(p.dcr > 0));
    if (ra === rb) {
      if (p.type === 'VDC' || p.type === 'VAC') res.errors.push(`${p.name} is shorted: both leads land on the same connected strip.`);
      else res.warnings.push(`${p.name} is shorted out: both leads are on the same connected strip, so no current flows through it.`);
      continue;
    }
    if (isV && (p.type !== 'L' || mode === 'DC')) {
      const a = vf(ra), b2 = vf(rb);
      if (a === b2) res.errors.push(`${p.name} closes a loop of sources and inductors with no resistance (in DC an inductor is a short).`);
      else vsU.set(b2, a);
    }
    for (const k of [p.a, p.b]) {
      const r = topo.find(baseNetOfHole(k));
      if (topo.leadCount.get(r) === 1 && r !== topo.gnd) res.warnings.push(`${p.name} has a lead in ${netName(r, topo)} that connects to nothing else.`);
    }
  }
  if (!topo.els.some(p => p.type === 'VDC' || p.type === 'VAC')) res.warnings.push('Add a DC supply or AC source to power the circuit.');
  if (res.errors.length) { res.ok = false; return res; }
  // DC operating point with LED state iteration
  const ledOn = {};
  for (const p of topo.els) if (p.type === 'LED') ledOn[p.id] = true;
  let dc = null;
  for (let it = 0; it < 40; it++) {
    dc = solveMNA(topo, 'DC', 0, ledOn);
    if (!dc) break;
    let changed = false;
    for (const p of topo.els) if (p.type === 'LED') {
      const t = LED_TYPES[p.color] || LED_TYPES.red, r = dc.parts[p.id];
      if (ledOn[p.id] && r.i[0] < 0) { ledOn[p.id] = false; changed = true; }
      else if (!ledOn[p.id] && r.v[0] > t.vf + 1e-9) { ledOn[p.id] = true; changed = true; }
    }
    if (!changed) break;
  }
  if (!dc) { res.ok = false; res.errors.push('The circuit has no unique solution. Check for sources wired in parallel or a supply shorted by a wire.'); return res; }
  res.ledOn = ledOn;
  res.dc = dc;
  let sol = dc;
  if (mode === 'AC') {
    sol = solveMNA(topo, 'AC', 2 * Math.PI * freq, ledOn);
    if (!sol) { res.ok = false; res.errors.push('The AC solution is singular at this frequency.'); return res; }
    if (!topo.els.some(p => p.type === 'VAC')) res.warnings.push('No AC source on the board, so every AC phasor is zero.');
  }
  res.nodeV = sol.nodeV;
  for (const p of topo.els) {
    const r = sol.parts[p.id];
    const P = r.v[0] * r.i[0] + r.v[1] * r.i[1]; // Re(V·I*) ; rms phasors in AC
    res.parts[p.id] = { v: r.v, i: r.i, p: P };
  }
  return res;
}

function sweep(parts, probeBase, f0 = 1, f1 = 1e6, ppd = 30) {
  const src = parts.find(p => p.type === 'VAC');
  if (!src) return null;
  const pts = [];
  const n = Math.round(Math.log10(f1 / f0) * ppd);
  const ref = [src.value * Math.cos((src.phase || 0) * Math.PI / 180), src.value * Math.sin((src.phase || 0) * Math.PI / 180)];
  for (let k = 0; k <= n; k++) {
    const f = f0 * Math.pow(10, k / ppd);
    const r = analyze(parts, { mode: 'AC', freq: f });
    if (!r.ok) return null;
    const root = r.topo.find(probeBase);
    const v = r.nodeV.get(root) || [0, 0];
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
    const nm = netName(r, topo);
    return nm.replace('Top + rail', 'RAIL_TP').replace('Top − rail', 'RAIL_TN').replace('Bottom + rail', 'RAIL_BP').replace('Bottom − rail', 'RAIL_BN')
      .replace(/^Col (\d+) a–e$/, 'C$1A').replace(/^Col (\d+) f–j$/, 'C$1F');
  };
  const sp = v => { const s = fmtEng(v, '', 4).replace(' ', '').replace('µ', 'u').replace('M', 'Meg'); return s; };
  const L = ['* Breadboard Bench export'];
  const models = new Set();
  for (const p of topo.els) {
    const a = name(p.a), b = name(p.b);
    if (p.type === 'R') L.push(`${p.name} ${a} ${b} ${sp(p.value)}`);
    else if (p.type === 'C') L.push(`${p.name} ${a} ${b} ${sp(p.value)}`);
    else if (p.type === 'L') L.push(`${p.name} ${a} ${b} ${sp(p.value)}${p.dcr > 0 ? ' Rser=' + sp(p.dcr) : ''}`);
    else if (p.type === 'LED') { const m = 'LED_' + (p.color || 'red').toUpperCase(); models.add(p.color || 'red'); L.push(`${p.name} ${a} ${b} ${m}`); }
    else if (p.type === 'VDC') L.push(`${p.name} ${a} ${b} DC ${sp(p.value)}`);
    else if (p.type === 'VAC') L.push(`${p.name} ${a} ${b} SINE(0 ${sp(p.value * Math.SQRT2)} ${sp(freq)}) AC ${sp(p.value)} ${p.phase || 0}`);
  }
  for (const c of models) {
    const t = LED_TYPES[c];
    const Is = 0.01 * Math.exp(-t.vf / (2 * 0.02585));
    L.push(`.model LED_${c.toUpperCase()} D(Is=${Is.toExponential(2)} N=2 Rs=${t.rs}) ; approx. Vf ${t.vf} V at 10 mA`);
  }
  L.push(mode === 'AC' ? '.ac dec 50 1 1Meg' : '.op');
  L.push('.end');
  return L.join('\n');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    E_BASE, SERIES_TOL, POWER_RATINGS, LED_TYPES, snap, isInSeries, parseEng, fmtEng, rkm, colorBands, smdCode,
    capCodeEncode, capCodeDecode, baseNetOfHole, holesOfBaseNet, csolve, cabs, cdeg, topology, analyze, sweep, spiceNetlist
  };
}
