const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../app/engine.js');

let id = 1;
const part = (type, a, b, props = {}) => Object.assign({ id: 'p' + id++, name: type + id, type, a, b }, props);
const chip = (model, anchor, props = {}) => {
  const c = E.CATALOG_BY_ID[model];
  return Object.assign({ id: 'p' + id++, name: 'U' + id, type: c.type, model, pins: E.footprintHoles(c.footprint, anchor) }, c.defaults || {}, props);
};
const fromCat = (model, a, b, props = {}) => { const c = E.CATALOG_BY_ID[model]; return Object.assign({ id: 'p' + id++, name: 'X' + id, type: c.type, model, a, b }, c.defaults || {}, props); };
const nv = (r, base) => r.nodeV.get(r.topo.find(base))[0];
const supply = v => [part('VDC', 'TP1', 'TN1', { value: v }), part('GND', 'TN2', null)];
const inRange = (x, lo, hi, what) => assert.ok(x >= lo && x <= hi, `${what}: ${x} not in [${lo}, ${hi}]`);

test('every catalog footprint fits and every catalog part has a type', () => {
  for (const c of E.CATALOG) {
    assert.ok(c.type && c.name && c.mpn, c.id);
    if (c.footprint) assert.equal(E.footprintHoles(c.footprint, c.footprint === 'dip8' ? 'f5' : 'c5').length, c.pins.length, c.id);
  }
});

test('1N4148 forward drop near 0.7 V at 4 mA', () => {
  const d = fromCat('D-1N4148', 'b5', 'TN5');
  const r = E.analyze([...supply(5), part('R', 'TP3', 'a5', { value: 1000 }), d]);
  assert.ok(r.ok, r.errors.join());
  inRange(r.parts[d.id].v[0], 0.62, 0.75, 'Vf');
});

test('1N4733A Zener regulates near 5.1 V', () => {
  const z = fromCat('D-1N4733A', 'TN5', 'b5');
  const r = E.analyze([...supply(12), part('R', 'TP3', 'a5', { value: 150 }), z]);
  inRange(nv(r, 'U5'), 4.9, 5.25, 'Vz');
});

test('2N3904 common emitter sits in the active region', () => {
  const q = chip('Q-2N3904', 'c10'); // E U10, B U11, C U12
  const rb = part('R', 'TP11', 'a11', { value: 470e3 }), rc = part('R', 'TP12', 'a12', { value: 1000 });
  const r = E.analyze([...supply(9), part('wire', 'a10', 'TN10'), rb, rc, q]);
  assert.ok(r.ok, r.errors.join());
  const [ie, ib, ic] = r.parts[q.id].pinI.map(z => z[0]);
  inRange(ic / ib, 150, 280, 'beta');
  inRange(nv(r, 'U12'), 2, 7, 'Vc');
  assert.ok(Math.abs(ie + ib + ic) < 1e-9);
});

test('2N3906 high-side switch saturates', () => {
  const q = chip('Q-2N3906', 'c10'); // E B C
  const r = E.analyze([...supply(5), part('wire', 'a10', 'TP10'), part('R', 'a11', 'TN11', { value: 10000 }), part('R', 'a12', 'TN12', { value: 1000 }), q]);
  inRange(nv(r, 'U12'), 4.8, 5, 'Vc');
});

test('LM358 non-inverting amplifier: gain 10 and clipping at V+ − 1.5 V', () => {
  const build = vin => {
    const u = chip('U-LM358', 'f10'); // 1OUT L10, 1IN− L11, 1IN+ L12, V− L13, V+ U10
    return [...supply(12), u, part('wire', 'a10', 'TP10'), part('wire', 'j13', 'BN13'), part('wire', 'TN30', 'BN30'),
      part('VDC', 'g12', 'BN12', { value: vin }), part('R', 'h11', 'BN11', { value: 1000 }), part('R', 'i10', 'i11', { value: 9000 })];
  };
  inRange(nv(E.analyze(build(0.5)), 'L10'), 4.99, 5.01, 'Vout');
  inRange(nv(E.analyze(build(2)), 'L10'), 10.4, 10.55, 'Vout clipped');
});

test('TL072 inverting amplifier: AC gain 10 at 1 kHz, rolls off by 1 MHz', () => {
  const u = chip('U-TL072', 'f10');
  const parts = [part('VDC', 'TP1', 'TN1', { value: 12 }), part('GND', 'TN2', null), part('VDC', 'TN5', 'BN5', { value: 12 }),
    u, part('wire', 'a10', 'TP10'), part('wire', 'j13', 'BN13'), part('wire', 'h12', 'TN12'),
    part('VAC', 'i8', 'TN8', { value: 1 }), part('R', 'g8', 'g11', { value: 1000 }), part('R', 'i10', 'i11', { value: 10000 })];
  const r1 = E.analyze(parts, { mode: 'AC', freq: 1000 });
  assert.ok(r1.ok, r1.errors.join());
  const v = r1.nodeV.get(r1.topo.find('L10'));
  inRange(E.cabs(v), 9.95, 10.05, '|gain|');
  inRange(Math.abs(E.cdeg(v)), 179, 180, 'phase');
  // each rail supplies about half the 1 mA output swing, not a circulating current
  inRange(E.cabs(r1.parts[parts[0].id].i), 0.3e-3, 0.7e-3, 'V+ rail AC current');
  const r2 = E.analyze(parts, { mode: 'AC', freq: 1e6 });
  assert.ok(E.cabs(r2.nodeV.get(r2.topo.find('L10'))) < 4);
});

test('L7805 regulates and drops out', () => {
  const build = vin => [...supply(vin), chip('U-L7805', 'c5'), part('wire', 'TP5', 'a5'), part('wire', 'a6', 'TN6'), part('R', 'b7', 'TN7', { value: 100 })];
  inRange(nv(E.analyze(build(9)), 'U7'), 4.98, 5.02, 'Vout');
  inRange(nv(E.analyze(build(6)), 'U7'), 3.9, 4.1, 'Vout in dropout');
});

test('LM317 with 240 Ω / 720 Ω gives about 5.04 V', () => {
  const r = E.analyze([...supply(12), chip('U-LM317', 'c5'), part('wire', 'TP7', 'a7'), part('R', 'b6', 'b5', { value: 240 }), part('R', 'c5', 'TN5', { value: 720 })]);
  inRange(nv(r, 'U6'), 5.02, 5.05, 'Vout');
});

test('2N7000 low-side switch turns an LED on and off', () => {
  const build = gate => {
    const m = chip('M-2N7000', 'c10'); // S U10, G U11, D U12
    const led = part('LED', 'c14', 'd12', { color: 'red' });
    return [[...supply(5), m, part('wire', 'a10', 'TN10'), part('wire', 'a11', gate), part('R', 'TP14', 'b14', { value: 220 }), led], led];
  };
  let [parts, led] = build('TP11');
  inRange(E.analyze(parts).parts[led.id].i[0], 0.005, 0.02, 'LED on');
  [parts, led] = build('TN11');
  assert.ok(E.analyze(parts).parts[led.id].i[0] < 1e-6);
});

test('potentiometer wiper divides', () => {
  const pot = chip('POT-3386', 'c5', { pos: 0.25 });
  const r = E.analyze([...supply(10), pot, part('wire', 'TP5', 'a5'), part('wire', 'a7', 'TN7')]);
  inRange(nv(r, 'U6'), 7.49, 7.51, 'wiper');
});

test('bench supply current limit and battery internal resistance', () => {
  const sup = fromCat('V-BENCH', 'TP1', 'TN1', { value: 5, iLimit: 0.1 });
  const r = E.analyze([sup, part('GND', 'TN2', null), part('R', 'TP3', 'TN3', { value: 10 })]);
  inRange(-r.parts[sup.id].i[0], 0.098, 0.1, 'limited current');
  const bat = fromCat('V-9V', 'TP1', 'TN1');
  const r2 = E.analyze([bat, part('GND', 'TN2', null), part('R', 'TP3', 'TN3', { value: 100 })]);
  inRange(nv(r2, 'TP'), 8.84, 8.86, 'battery terminal voltage');
});

test('hard case converges: 30 V supply straight into a rectifier at its current limit', () => {
  const sup = fromCat('V-BENCH', 'TP1', 'TN1', { value: 30, iLimit: 3 });
  const d = fromCat('D-1N4007', 'TP4', 'TN4');
  const r = E.analyze([sup, part('GND', 'TN2', null), d]);
  assert.ok(r.ok, r.errors.join());
  inRange(r.parts[d.id].i[0], 2.9, 3.001, 'diode current');
});

test('switch open and closed', () => {
  const sw = fromCat('SW-SLIDE', 'a5', 'a8');
  const parts = [...supply(5), part('wire', 'TP5', 'b5'), sw, part('R', 'b8', 'TN8', { value: 1000 })];
  inRange(nv(E.analyze(parts), 'U8'), 4.99, 5, 'closed');
  sw.closed = false;
  assert.ok(nv(E.analyze(parts), 'U8') < 1e-3);
});

test('netlist carries device models and subcircuits', () => {
  const n = E.spiceNetlist([...supply(9), chip('Q-2N3904', 'c10'), chip('U-LM358', 'f20'), fromCat('D-1N4148', 'a1', 'a3')], 'DC', 1000);
  assert.match(n, /^\.model Q2N3904_BB NPN\(/m);
  assert.match(n, /^\.subckt OA_LM358 /m);
  assert.match(n, /^XU\d+A /m);
  assert.match(n, /^\.model D1N4148_BB D\(/m);
});

test('random breadboard circuits never throw and almost always converge', () => {
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(rnd() * a.length)];
  const rows = 'abcdefghij'.split('').concat(['TP', 'TN', 'BP', 'BN']);
  const hole = () => pick(rows) + (1 + Math.floor(rnd() * 30));
  const lib = E.CATALOG.filter(c => c.cat !== 'Sources');
  let solved = 0, total = 0;
  for (let n = 0; n < 150; n++) {
    const parts = [...supply(5 + Math.floor(rnd() * 20)), part('wire', 'TN30', 'BN30'), part('wire', 'TP30', 'BP30')];
    for (let i = 0; i < 3 + Math.floor(rnd() * 8); i++) {
      const c = pick(lib);
      const p = Object.assign({ id: 'p' + id++, name: 'X' + id, type: c.type, model: c.id }, c.defaults || {});
      if (c.footprint) { p.pins = E.footprintHoles(c.footprint, c.footprint === 'dip8' ? 'f' + (1 + Math.floor(rnd() * 26)) : pick('abcdefghij'.split('')) + (1 + Math.floor(rnd() * 26))); if (!p.pins) continue; }
      else { p.a = hole(); p.b = hole(); }
      parts.push(p);
    }
    for (let i = 0; i < 4; i++) parts.push(part('wire', hole(), hole()));
    const r = E.analyze(parts, { mode: rnd() < 0.5 ? 'DC' : 'AC', freq: 1000 });
    if (r.errors.some(e => /converge/.test(e))) total++;
    else if (r.ok) { solved++; total++; }
  }
  assert.ok(solved / total >= 0.97, `solved ${solved} of ${total}`);
});
