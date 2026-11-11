const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../app/engine.js');

const close = (a, b, tol = 1e-3) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} != ${b}`);
const run = (key, sc, opts) => E.scopeMeasure(E.sampleParts(key), opts || { mode: 'AC', freq: E.SAMPLE_CIRCUITS[key].freq || 1000 }, sc);

test('two channels show amplitude and phase; the source is 141 V peak for 100 V rms', () => {
  const r = run('hwseries', { ch1: 'j3', ch2: 'j15' });
  const s1 = E.scopeStats(r.ch[0], 1000), s2 = E.scopeStats(r.ch[1], 1000);
  close(s1.vpp, 2 * 100 * Math.SQRT2); close(s1.vrms, 100); close(s1.freq, 1000);
  close(s2.vrms, 40, 2e-3);
  close(E.scopePhase(r.ch[0], r.ch[1]), -143.13, 1e-3);
  assert.equal(r.shorted, null);
});

test('series-parallel: Vp leads the source by 16.26°', () => {
  const r = run('hwseriesparallel', { ch1: 'j3', ch2: 'j8' });
  close(E.scopePhase(r.ch[0], r.ch[1]), 16.26, 1e-3);
  close(E.scopeStats(r.ch[1], 1000).vrms, 24, 2e-3);
});

test('the ground clip is earth: clipping it onto a node that is not ground shorts that node', () => {
  const r = run('hwseriesparallel', { ch1: 'j3', ch2: null, gnd: 'j8' });
  assert.equal(r.shorted, 'Col 8 f–j');
  assert.ok(r.notes[0].includes('MATH'));
  // with the parallel group shorted, the whole 32 V sits across R1
  close(E.scopeStats(r.ch[0], 1000).vrms, 32, 2e-3);
  const ok = run('hwseriesparallel', { ch1: 'j3', gnd: 'BN20' });
  assert.equal(ok.shorted, null);
});

test('DC circuits give flat traces at the node voltage; AC coupling removes them', () => {
  const r = run('series', { ch1: 'd10' }, { mode: 'DC' });
  close(r.ch[0].dc, 4.5 * 1e6 / (1e6 + 1500), 1e-6); // the 1 MΩ probe loads the 1.5 kΩ node a little
  const st = E.scopeStats(r.ch[0], 1000);
  assert.equal(st.vpp, 0); close(st.vavg, 4.493, 1e-3);
  assert.equal(E.scopeStats(r.ch[0], 1000, 'AC').vavg, 0);
});

test('autoscale picks 1-2-5 steps that fit the trace', () => {
  const r = run('hwseries', { ch1: 'j3' });
  const a = E.scopeAutoscale([E.scopeStats(r.ch[0], 1000)], 1000);
  assert.equal(a.vdiv, 50); // 141 V peak needs 50 V/div to stay on 3.5 divisions
  assert.equal(a.tdiv, 2e-4); // two 1 ms cycles across 10 divisions
});

test('instruments see the sine even when the readings panel is in DC, and an op-amp output clips at its rails', () => {
  const parts = E.sampleParts('opamp');
  assert.equal(E.instrumentOpts(parts, { freq: 1000 }).mode, parts.some(p => p.type === 'VAC') ? 'AC' : 'DC');
  const r = E.importLTspice('* inv\nV1 in 0 SINE(0 2.828 1k)\nR1 in n 1k\nR2 n out 10k\nXU1 0 n vcc vee out LM741\nVP vcc 0 12\nVN 0 vee 12');
  const u = r.parts.find(p => p.type === 'OPAMP');
  const sc = E.scopeMeasure(r.parts, E.instrumentOpts(r.parts, { freq: 1000 }), { ch1: u.pins[5], ch2: null, gnd: null });
  // 2 V rms × 10 would be 56 V peak to peak; the LM741 on ±12 V stops 2 V short of each rail
  assert.ok(E.scopeClips(sc.ch[0]));
  const st = E.scopeStats(sc.ch[0], 1000);
  close(st.vmax, 10, 1e-2); close(st.vmin, -10, 1e-2); close(st.vpp, 20, 1e-2);
  assert.ok(sc.notes.some(n => n.includes('clipping')));
});
