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

// every lead of every imported part must sit on its netlist node, and no two nodes may touch
function checkBoard(text, r) {
  const topo = E.topology(r.parts), parsed = E.parseNetlist(text), r2n = new Map(), n2r = new Map(), holes = new Set();
  for (const p of r.parts) for (const h of E.leadsOf(p)) { assert.ok(E.parseHole(h), `bad hole ${h}`); assert.ok(!holes.has(h), `hole ${h} used twice`); holes.add(h); }
  for (const e of parsed.elements) {
    if (e.kind === 'X' || e.nodes[0] === e.nodes[1]) continue;
    const p = r.parts.find(x => x.name === e.name);
    assert.ok(p, `${e.name} missing`);
    [p.a, p.b].forEach((h, q) => {
      const root = topo.find(E.baseNetOfHole(h)), nd = e.nodes[q];
      assert.ok(!(r2n.has(root) && r2n.get(root) !== nd) && !(n2r.has(nd) && n2r.get(nd) !== root), `${e.name} is on the wrong node`);
      r2n.set(root, nd); n2r.set(nd, root);
    });
  }
}

test('random netlists always land on the board with the netlist\'s connections', () => {
  let seed = 7;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296, pick = a => a[Math.floor(rnd() * a.length)];
  for (let t = 0; t < 400; t++) {
    const nn = 2 + Math.floor(rnd() * 9), nodes = ['0'], L = ['* fuzz'];
    for (let i = 1; i <= nn; i++) nodes.push('N' + i);
    const nops = rnd() < 0.4 ? 1 + Math.floor(rnd() * 3) : 0;
    if (nops) { L.push('VP vcc 0 12'); if (rnd() < 0.7) L.push('VN 0 vee 12'); }
    const vee = L.some(x => x.startsWith('VN')) ? 'vee' : '0';
    L.push(rnd() < 0.5 ? `V1 ${nodes[1]} 0 ${1 + Math.floor(rnd() * 9)}` : `V1 ${nodes[1]} 0 SINE(0 1 1k) AC 1`);
    const ne = nn + Math.floor(rnd() * 10);
    for (let i = 0; i < ne; i++) { const k = pick(['R', 'R', 'R', 'C', 'L', 'D']); L.push(`${k}${i + 1} ${pick(nodes)} ${pick(nodes.concat(nops ? ['vcc'] : []))} ${k === 'D' ? '1N4148' : k === 'R' ? '1k' : k === 'C' ? '100n' : '10m'}`); }
    for (let i = 0; i < nops; i++) L.push(`XU${i + 1} ${pick(nodes)} ${pick(nodes)} vcc ${vee} ${pick(nodes)} ${pick(['LM741', 'LM1458', 'LM358'])}`);
    const text = L.join('\n'), r = E.importLTspice(text);
    assert.ok(!r.error, r.error + '\n' + text);
    checkBoard(text, r);
  }
});

test('a simple circuit comes out tidy: parts lie along a row or stand on a rail', () => {
  const text = '* divider\nV1 N001 0 12\nR1 N001 N002 2k\nR2 N002 0 4k\nR3 N002 N003 1k\nC1 N003 0 100n';
  const r = E.importLTspice(text);
  checkBoard(text, r);
  for (const p of r.parts.filter(p => p.b && p.type !== 'wire')) {
    const a = E.parseHole(p.a), b = E.parseHole(p.b);
    assert.ok(a.r === b.r || a.c === b.c || Math.abs(a.c - b.c) <= 3, `${p.name} runs ${p.a} → ${p.b}`);
  }
  assert.equal(r.netNames.TP, 'N001'); assert.equal(r.netNames.TN, '0');
  close(E.analyze(r.parts).parts[byName(r, 'R2').id].v[0], 12 * (4 / 6) , 0.1);
});

test('.param values, SINE offsets and files saved as UTF-16 or Windows-1252', () => {
  const r = E.importLTspice('* p\n.param Rtop=2k Cx=1µ\nV1 in 0 SINE(2.5 1.414 500)\nR1 in out {Rtop}\nC1 out 0 {Cx}\n.tran 10m');
  assert.equal(byName(r, 'R1').value, 2000); close(byName(r, 'C1').value, 1e-6, 1e-9);
  const v = byName(r, 'V1');
  assert.equal(v.dc, 2.5); close(v.value, 1, 1e-3); assert.equal(r.freq, 500);
  // the offset shows up as the DC level, the sine as the AC part
  const a = E.analyze(r.parts, { mode: 'AC', freq: 500 });
  close(a.dc.parts[byName(r, 'C1').id].v[0], 2.5);
  const utf16 = new Uint8Array(new Uint16Array([...'R1 a 0 10µ'].map(c => c.charCodeAt(0))).buffer);
  assert.equal(E.decodeSpiceFile(utf16), 'R1 a 0 10µ');
  assert.equal(E.decodeSpiceFile(new Uint8Array([0x31, 0x30, 0xb5])), '10µ');
  assert.equal(E.decodeSpiceFile(new TextEncoder().encode('10µ')), '10µ');
});

test('LTspice schematic with an op-amp, a battery symbol and a .param', () => {
  const asc = ['Version 4', 'SHEET 1 880 680',
    'WIRE 0 96 -64 96', 'WIRE 96 96 80 96', 'WIRE 208 96 176 96', 'WIRE 96 144 96 96', 'WIRE 112 144 96 144', 'WIRE 208 160 208 96', 'WIRE 208 160 176 160', 'WIRE 112 176 96 176',
    'FLAG 96 176 0', 'FLAG -64 176 0', 'FLAG 208 160 OUT',
    'SYMBOL Opamps\\\\opamp 144 96 R0', 'SYMATTR InstName U1',
    'SYMBOL res 96 80 R90', 'SYMATTR InstName R1', 'SYMATTR Value {RIN}',
    'SYMBOL res 192 80 R90', 'SYMATTR InstName R2', 'SYMATTR Value 20k',
    'SYMBOL Misc\\\\battery -64 80 R0', 'SYMATTR InstName V1', 'SYMATTR Value 1',
    'TEXT -80 240 Left 2 !.param RIN=10k\\n.op'].join('\n');
  const r = E.importLTspice(asc);
  assert.ok(!r.error, r.error);
  assert.equal(byName(r, 'R1').value, 10000);
  const a = E.analyze(r.parts), u = r.parts.find(p => p.type === 'OPAMP');
  close(a.parts[u.id].pinV[0][0], -2, 1e-2);
  assert.equal(r.netNames[E.baseNetOfHole(u.pins[0])], 'OUT');
});
