const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../app/engine.js');

const close = (a, b, tol = 1e-3) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} != ${b}`);
const read = (key, m, opts) => E.meterMeasure(E.sampleParts(key), opts || { mode: E.SAMPLE_CIRCUITS[key].mode, freq: E.SAMPLE_CIRCUITS[key].freq }, Object.assign({ jack: 'V' }, m));

test('autoranges with 6000 counts and shows OL past the top range', () => {
  const d = (k, v, r) => E.meterDisplay(k, v, r);
  assert.equal(d('V', 4.4993).text, '4.499');
  assert.equal(d('V', 5.9996).text, '6.00');
  assert.equal(d('V', 12.003).text, '12.00');
  assert.equal(d('V', 12, 0).ol, true);
  assert.equal(d('V', 1200).ol, true);
  assert.equal(d('ohm', Infinity).ol, true);
  assert.equal(d('ohm', 2000).text + d('ohm', 2000).unit, '2.000kΩ');
  assert.equal(d('cap', 47e-9).text + d('cap', 47e-9).unit, '47.0nF');
  assert.equal(d('mA', 0.0015).text, '1.50');
});

test('DC and AC volts, with the 10 MΩ input across the probes', () => {
  close(read('series', { fn: 'vdc', red: 'd10', black: 'TN20' }).value, 4.5, 1e-3);
  assert.equal(read('series', { fn: 'vac', red: 'd10', black: 'TN20' }).value, 0); // AC-coupled: no AC on a DC circuit
  const hp = read('highpass', { fn: 'vac', red: 'i8', black: 'BN20' });
  close(hp.value, 0.709, 2e-3);
  assert.equal(hp.hz, 1000);
});

test('Ω reads one resistor in circuit with the supply off; open probes read OL; continuity beeps', () => {
  const r = read('series', { fn: 'ohm', red: 'd5', black: 'd10' });
  close(r.value, 2000);
  assert.ok(r.notes.length); // reminder that the supply is off for the reading
  assert.equal(read('series', { fn: 'ohm', red: 'd25', black: 'd27' }).value, Infinity);
  assert.equal(read('series', { fn: 'ohm', shift: true, red: 'b15', black: 'TN25' }).beep, true);
  close(read('adder', { fn: 'ohm', red: 'g8', black: 'g16' }).value, 10000);
});

test('diode test reads the LED forward drop one way and OL the other', () => {
  const f = read('basics', { fn: 'diode', red: 'd7', black: 'd9' }).value;
  assert.ok(f > 1.4 && f < 2.1, String(f));
  assert.equal(E.meterDisplay('diode', read('basics', { fn: 'diode', red: 'd9', black: 'd7' }).value).ol, true);
});

test('capacitance on the yellow button of the diode position', () => {
  close(read('highpass', { fn: 'diode', shift: true, red: 'h3', black: 'i8' }).value, 100e-9, 1e-6);
});

test('current: the meter in series reads the loop current, with burden; a short through mA blows the fuse', () => {
  const broken = E.sampleParts('series').filter(p => !(p.type === 'wire' && p.a === 'a15'));
  const m = (o) => E.meterMeasure(broken, { mode: 'DC' }, Object.assign({ red: 'd15', black: 'TN16' }, o));
  close(m({ fn: 'a', jack: 'mA' }).value, 9 / 6001.8, 1e-6);
  close(m({ fn: 'ua', jack: 'mA' }).value, 9 / 6100, 1e-6); // 100 Ω burden on µA
  assert.equal(m({ fn: 'a', jack: 'V' }).value, 0);
  assert.equal(m({ fn: 'a', jack: 'mA', fuses: { mA: true } }).value, 0);
  const s = read('series', { fn: 'a', jack: 'mA', red: 'TP3', black: 'TN3' });
  assert.equal(s.blow, 'mA');
  // V position with the red lead left in mA: LEAd alert, and across the supply it still blows the fuse
  const l = read('series', { fn: 'vdc', jack: 'mA', red: 'TP3', black: 'TN3' });
  assert.equal(l.lead, true); assert.equal(l.blow, 'mA');
});

test('the meter reads the op-amp adder output', () => {
  close(read('adder', { fn: 'vdc', red: 'a21', black: 'TN28' }).value, 4, 1e-3);
});
