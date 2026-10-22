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
    assert.ok(['R', 'C', 'L', 'POT', 'SW', 'VDC', 'VAC', 'D', 'LED', 'OPAMP'].includes(c.type), c.id);
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

test('LM358 non-inverting amplifier: gain 10 and clipping at V+ − 1.5 V', () => {
  const build = vin => {
    const u = chip('U-LM358', 'f10'); // 1OUT L10, 1IN− L11, 1IN+ L12, V− L13, V+ U10
    return [...supply(12), u, part('wire', 'a10', 'TP10'), part('wire', 'j13', 'BN13'), part('wire', 'TN30', 'BN30'),
      part('VDC', 'g12', 'BN12', { value: vin }), part('R', 'h11', 'BN11', { value: 1000 }), part('R', 'i10', 'i11', { value: 9000 })];
  };
  inRange(nv(E.analyze(build(0.5)), 'L10'), 4.99, 5.01, 'Vout');
  inRange(nv(E.analyze(build(2)), 'L10'), 10.4, 10.55, 'Vout clipped');
});

test('LM1458 inverting amplifier on ±12 V: AC gain 10 at 1 kHz, rolls off by 1 MHz', () => {
  const u = chip('U-LM1458', 'f10');
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
  assert.ok(E.cabs(r2.nodeV.get(r2.topo.find('L10'))) < 2);
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
  const d = fromCat('D-1N4001', 'TP4', 'TN4');
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
  const n = E.spiceNetlist([...supply(9), chip('U-LM358', 'f20'), fromCat('D-1N4148', 'a1', 'a3')], 'DC', 1000);
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

test('every sample circuit solves and matches its write-up', () => {
  const ref = {
    basics: ['U18', 2.85, 2.9], series: ['U5', 7.49, 7.51], seriesparallel: ['U5', 7.99, 8.01], divider: ['U5', 5.99, 6.01],
    twosource: ['U5', 8.1, 8.14], bridge: ['U12', 6.0, 6.2], noninv: ['L10', 5.04, 5.06], opamp: ['L10', -0.01, 0.01],
    highpass: null, rlc: null
  };
  for (const [key, s] of Object.entries(E.SAMPLE_CIRCUITS)) {
    assert.ok(s.label && s.about && s.expect && s.try, key);
    const parts = E.sampleParts(key);
    const dc = E.analyze(parts);
    assert.ok(dc.ok, key + ': ' + dc.errors.join());
    if (ref[key]) inRange(nv(dc, ref[key][0]), ref[key][1], ref[key][2], key);
    if (s.mode === 'AC') assert.ok(E.analyze(parts, { mode: 'AC', freq: s.freq }).ok, key + ' AC');
  }
  const ac = (key, base) => { const s = E.SAMPLE_CIRCUITS[key], r = E.analyze(E.sampleParts(key), { mode: 'AC', freq: s.freq }); return E.cabs(r.nodeV.get(r.topo.find(base))); };
  inRange(ac('highpass', 'L8'), 0.70, 0.72, 'high-pass at fc');
  inRange(ac('rlc', 'L13'), 0.99, 1.0, 'RLC at resonance');
  inRange(ac('opamp', 'L10'), 4.7, 4.8, 'inverting amp');
});
