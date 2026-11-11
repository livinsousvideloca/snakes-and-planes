const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../app/engine.js');

const near = (z, want, tol = 1e-3) => assert.ok(Math.hypot(z[0] - want[0], z[1] - want[1]) <= tol * Math.max(1, Math.hypot(...want)), `${E.fmtRect(z)} != ${E.fmtRect(want)}`);
const P = (m, d) => E.polar(m, d);
const prob = k => E.HOMEWORK[0].problems.find(p => p.key === k);
const ans = (sol, n) => sol.steps[n - 1].answers.map(a => a.z);

test('reads answers typed in rectangular or polar form', () => {
  near(E.parsePhasor('30 + j40'), [30, 40]);
  near(E.parsePhasor('−32 − j24 V'), [-32, -24]);
  near(E.parsePhasor('3+4j'), [3, 4]);
  near(E.parsePhasor('-j6'), [0, -6]);
  near(E.parsePhasor('8'), [8, 0]);
  near(E.parsePhasor('50∠53.13°'), [30, 40], 1e-4);
  near(E.parsePhasor('2 < -53.13'), [1.2, -1.6], 1e-4);
  assert.equal(E.parsePhasor('fifty'), null);
  assert.equal(E.fmtRect([-32, -24], 'V'), '−32 − j24 V');
  assert.equal(E.fmtPolar(P(40, -143.13)), '40∠−143.13°');
  assert.ok(E.phasorMatches('2∠-53.1', P(2, -53.13)));
  assert.ok(!E.phasorMatches('2∠53.13', P(2, -53.13)));
});

test('circuit 1, series RLC: every ✔ line on the homework sheet', () => {
  const s = E.acTwoWays(prob('series').spec);
  const [zr, zl, zc] = ans(s, 1); near(zr, [30, 0]); near(zl, [0, 60]); near(zc, [0, -20]);
  near(ans(s, 2)[0], [30, 40]);
  near(ans(s, 3)[0], P(50, 53.13), 1e-4);
  near(ans(s, 4)[0], P(2, -53.13), 1e-4);
  const [vr, vl, vc] = ans(s, 5); near(vr, P(60, -53.13), 1e-4); near(vl, P(120, 36.87), 1e-4); near(vc, P(40, -143.13), 1e-4);
  const [r6, l6, c6] = ans(s, 6); near(r6, [36, -48]); near(l6, [96, 72]); near(c6, [-32, -24]);
  near(ans(s, 7)[0], [100, 0]);
  assert.match(s.steps[6].lines.join(' '), /KVL holds/);
});

test('circuit 2, parallel RC: product over sum and KCL', () => {
  const s = E.acTwoWays(prob('parallel').spec);
  near(ans(s, 2)[0], P(48, -90)); near(ans(s, 3)[0], [8, -6]);
  near(ans(s, 4)[0], P(4.8, -53.13), 1e-4); near(ans(s, 5)[0], P(5, 53.13), 1e-4);
  const [ir, ic] = ans(s, 6); near(ir, [3, 0]); near(ic, [0, 4]);
  near(ans(s, 7)[0], [3, 4]); near(ans(s, 8)[0], P(5, 53.13), 1e-4);
});

test('circuit 3, series-parallel: Zp first, then KVL and KCL', () => {
  const s = E.acTwoWays(prob('seriesparallel').spec);
  const [pr, sm, zp] = ans(s, 1); near(pr, P(300, 90)); near(sm, [20, 15]); near(zp, [7.2, 9.6]);
  near(ans(s, 2)[0], [12.8, 9.6]); near(ans(s, 3)[0], P(2, -36.87), 1e-4);
  near(ans(s, 4)[0], P(11.2, -36.87), 1e-4); near(ans(s, 5)[0], P(24, 16.26), 1e-4);
  const [i2, il] = ans(s, 6); near(i2, P(1.2, 16.26), 1e-4); near(il, P(1.6, -73.74), 1e-4);
  const k = ans(s, 7); near(k[0], [8.96, -6.72]); near(k[1], [23.04, 6.72]); near(k[2], [32, 0]);
  const c = ans(s, 8); near(c[0], [1.152, 0.336]); near(c[1], [0.448, -1.536]); near(c[2], [1.6, -1.2]);
});

test('the calculator input format and its limits', () => {
  const r = E.parseElements('R 30, XL=60, C20');
  assert.deepEqual(r.elements.map(e => [e.kind, e.ohms]), [['R', 30], ['L', 60], ['C', 20]]);
  assert.ok(E.parseElements('Q 5').error);
  assert.ok(E.acTwoWays({ vs: [10, 0], parallel: r.elements }).error); // three branches: combine two at a time
});

test('the homework circuits on the breadboard read the homework answers', () => {
  for (const key of ['hwseries', 'hwparallel', 'hwseriesparallel']) {
    const s = E.SAMPLE_CIRCUITS[key];
    const res = E.analyze(E.sampleParts(key), { mode: 'AC', freq: s.freq });
    assert.ok(res.ok, key + ': ' + res.errors.join(' '));
    assert.deepEqual(res.warnings, [], key);
    const rows = E.homeworkChecks(key, res);
    assert.ok(rows.length >= 4);
    for (const r of rows) assert.ok(r.ok, `${key} ${r.label}: board ${r.got && E.fmtPolar(r.got)} vs ${E.fmtPolar(r.want)}`);
  }
});

test('the DMM reads 3 A and 4 A in the parallel branches, and the VL that exceeds the source', () => {
  const parts = E.sampleParts('hwparallel').filter(p => !(p.type === 'wire' && p.a === 'g3'));
  const ir = E.meterMeasure(parts, { mode: 'AC', freq: 1000 }, { fn: 'a', shift: true, jack: 'A', red: 'f3', black: 'f7' });
  assert.ok(Math.abs(ir.value - 24 / 8.03) < 1e-3, String(ir.value)); // 3 A, less a little for the 0.03 Ω shunt
  const vl = E.meterMeasure(E.sampleParts('hwseries'), { mode: 'AC', freq: 1000 }, { fn: 'vac', jack: 'V', red: 'f10', black: 'f15' });
  assert.ok(Math.abs(vl.value - 120) < 0.1, String(vl.value));
});
