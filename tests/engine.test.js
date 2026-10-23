const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../app/engine.js');

const close = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} != ${b}`);
let id = 1;
const part = (type, a, b, props = {}) => Object.assign({ id: 'p' + id++, name: type + id, type, a, b }, props);

test('E96 matches the IEC 60063 table', () => {
  const std = [1.00, 1.02, 1.05, 1.07, 1.10, 1.13, 1.15, 1.18, 1.21, 1.24, 1.27, 1.30, 1.33, 1.37, 1.40, 1.43, 1.47, 1.50, 1.54, 1.58, 1.62, 1.65, 1.69, 1.74, 1.78, 1.82, 1.87, 1.91, 1.96, 2.00, 2.05, 2.10, 2.15, 2.21, 2.26, 2.32, 2.37, 2.43, 2.49, 2.55, 2.61, 2.67, 2.74, 2.80, 2.87, 2.94, 3.01, 3.09, 3.16, 3.24, 3.32, 3.40, 3.48, 3.57, 3.65, 3.74, 3.83, 3.92, 4.02, 4.12, 4.22, 4.32, 4.42, 4.53, 4.64, 4.75, 4.87, 4.99, 5.11, 5.23, 5.36, 5.49, 5.62, 5.76, 5.90, 6.04, 6.19, 6.34, 6.49, 6.65, 6.81, 6.98, 7.15, 7.32, 7.50, 7.68, 7.87, 8.06, 8.25, 8.45, 8.66, 8.87, 9.09, 9.31, 9.53, 9.76];
  assert.deepEqual(E.E_BASE.E96, std);
  assert.equal(E.E_BASE.E192[185], 9.20);
});

test('parses engineering and RKM notation', () => {
  for (const [s, v] of [['4k7', 4700], ['2R2', 2.2], ['10u', 10e-6], ['100n', 100e-9], ['1meg', 1e6], ['1M', 1e6], ['1m', 1e-3], ['1kHz', 1e3], ['470Ω', 470]]) close(E.parseEng(s), v);
  assert.ok(Number.isNaN(E.parseEng('abc')));
});

test('snaps to series values', () => {
  assert.equal(E.snap(3400, 'E24'), 3300);
  assert.equal(E.snap(87, 'E24', 'up'), 91);
  assert.equal(E.snap(1234, 'E96'), 1240);
});

test('marking codes follow IEC 60062', () => {
  assert.equal(E.rkm(4700), '4k7');
  assert.equal(E.rkm(0.47), 'R47');
  assert.deepEqual(E.colorBands(4700, 5).map(b => b.n), ['yellow', 'violet', 'red', 'gold']);
  assert.deepEqual(E.colorBands(1210, 1).map(b => b.n), ['brown', 'red', 'brown', 'brown', 'brown']);
  assert.equal(E.smdCode(1210, 'E96'), '09B (EIA-96)');
  assert.equal(E.capCodeEncode(100e-9), '104');
  close(E.capCodeDecode('104'), 100e-9);
});

test('DC divider and LED branch', () => {
  const parts = [
    part('VDC', 'TP1', 'TN1', { value: 9 }), part('GND', 'TN2', null),
    part('wire', 'TP3', 'a3'), part('R', 'b3', 'b7', { value: 470 }), part('LED', 'c7', 'c9', { color: 'red' }), part('wire', 'a9', 'TN9'),
    part('wire', 'TP13', 'a13'), part('R', 'b13', 'b18', { value: 10000 }), part('R', 'c18', 'c23', { value: 4700 }), part('wire', 'a23', 'TN23')
  ];
  const r = E.analyze(parts, { mode: 'DC' });
  assert.ok(r.ok);
  const vOut = r.nodeV.get(r.topo.find('U18'))[0];
  close(vOut, 9 * 4.7 / 14.7, 1e-6);
  const led = parts.find(p => p.type === 'LED');
  const i = r.parts[led.id].i[0];
  assert.ok(i > 0.014 && i < 0.0155, `LED current ${i}`);
});

test('RC low-pass is 0.707 at -45 degrees at its cutoff', () => {
  const parts = [part('VAC', 'h3', 'BN3', { value: 1, phase: 0 }), part('R', 'g3', 'g9', { value: 1000 }), part('C', 'j9', 'BN9', { value: 100e-9 })];
  const fc = 1 / (2 * Math.PI * 1000 * 100e-9);
  const r = E.analyze(parts, { mode: 'AC', freq: fc });
  const v = r.nodeV.get(r.topo.find('L9'));
  close(E.cabs(v), Math.SQRT1_2, 1e-6);
  close(E.cdeg(v), -45, 1e-5);
});

test('reports shorted and parallel sources', () => {
  assert.match(E.analyze([part('VDC', 'a1', 'b1', { value: 5 })]).errors[0], /shorted/);
  assert.equal(E.analyze([part('VDC', 'TP1', 'TN1', { value: 5 }), part('VDC', 'TP2', 'TN2', { value: 3 })]).ok, false);
});

test('reverse-biased LED stays off', () => {
  const led = part('LED', 'TN4', 'b2', { color: 'red' });
  const r = E.analyze([part('VDC', 'TP1', 'TN1', { value: 5 }), part('R', 'TP2', 'a2', { value: 330 }), led]);
  assert.ok(Math.abs(r.parts[led.id].i[0]) < 1e-6);
});

test('netlist is LTspice-shaped', () => {
  const n = E.spiceNetlist([part('VDC', 'TP1', 'TN1', { value: 9, name: 'V1' }), part('R', 'TP2', 'TN2', { value: 4700, name: 'R1' })], 'DC', 1000);
  assert.match(n, /^V1 RAIL_TP 0 DC 9$/m);
  assert.match(n, /^R1 RAIL_TP 0 4\.7k$/m);
  assert.match(n, /^\.op$/m);
});
