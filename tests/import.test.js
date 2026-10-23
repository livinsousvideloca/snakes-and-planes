const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../app/engine.js');

const close = (a, b, tol = 1e-3) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} != ${b}`);
const byName = (r, name) => r.parts.find(p => p.name === name);

test('reads SPICE numbers, where M is milli and Meg is mega', () => {
  for (const [s, v] of [['4.7k', 4700], ['1Meg', 1e6], ['1M', 1e-3], ['10u', 10e-6], ['100n', 100e-9], ['4k7', 4700], ['2.2kohm', 2200], ['12V', 12], ['1e3', 1000]]) close(E.spiceValue(s), v, 1e-9);
});

test('every sample exported to a netlist imports back with the same readings', () => {
  for (const [key, s] of Object.entries(E.SAMPLE_CIRCUITS)) {
    const orig = E.sampleParts(key);
    const r = E.importLTspice(E.spiceNetlist(orig, s.mode, s.freq || 1000));
    assert.ok(!r.error, key + ': ' + r.error);
    const a1 = E.analyze(orig, { mode: s.mode, freq: s.freq }), a2 = E.analyze(r.parts, { mode: s.mode, freq: s.freq });
    assert.ok(a2.ok, key + ': ' + a2.errors.join());
    for (const p of orig.filter(p => ['R', 'C', 'L', 'LED', 'D'].includes(p.type))) {
      const q = byName(r, p.name);
      assert.ok(q, `${key}: ${p.name} missing`);
      close(E.cabs(a2.parts[q.id].v), E.cabs(a1.parts[p.id].v), 2e-3);
    }
  }
});

test('LTspice schematic: series resistors from a .asc file', () => {
  const r = E.importLTspice(fs.readFileSync(path.join(__dirname, 'series.asc'), 'utf8'));
  assert.equal(r.kind, 'schematic');
  const a = E.analyze(r.parts);
  assert.ok(a.ok, a.errors.join());
  close(Math.abs(a.parts[byName(r, 'R1').id].i[0]), 1e-3);
  close(Math.abs(a.parts[byName(r, 'R3').id].v[0]), 2);
});

test('3-pin ideal op-amp becomes an LM1458 with ±12 V supplies', () => {
  const r = E.importLTspice('* inverting\nV1 IN 0 1\nR1 N002 IN 10k\nR2 OUT N002 20k\nXU1 0 N002 OUT opamp Aol=100K\n.lib opamp.sub\n.end');
  const a = E.analyze(r.parts);
  const u = r.parts.find(p => p.type === 'OPAMP');
  assert.equal(u.model, 'U-LM1458');
  close(a.parts[u.id].pinV[0][0], -2, 1e-2);
  assert.ok(r.notes.some(n => /±12 V/.test(n)));
});

test('AC source sets AC mode and frequency; unsupported parts are reported', () => {
  const r = E.importLTspice('* rc\nV1 in 0 SINE(0 1.414 1k) AC 1\nR1 in out 1k\nC1 out 0 100n\nQ1 c b e 2N3904\nI1 0 x 1m\n.ac dec 10 1 1Meg');
  assert.equal(r.mode, 'AC'); assert.equal(r.freq, 1000);
  assert.equal(r.notes.length, 2);
  const a = E.analyze(r.parts, { mode: 'AC', freq: 1000 });
  close(E.cabs(a.parts[byName(r, 'C1').id].v), 1 / Math.sqrt(1 + Math.pow(2 * Math.PI * 1000 * 1000 * 100e-9, 2)) * 1.414 / Math.SQRT2, 1e-3);
  assert.ok(E.importLTspice('hello world').error);
});
