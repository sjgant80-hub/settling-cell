// The settling cell's kernel, held to its sealed definition (CLAIMS.md, seal 1). Fast on purpose: witness runs this
// whole file once per mutant of src/cell.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import C from '../src/cell.mjs';
import { rng } from '../vendor/seed-library/seedlib.mjs';

const bitsFrom = (s) => Uint8Array.from(s.replace(/ /g, ''), (ch) => (ch === '1' ? 1 : 0));
const str = (bits) => Array.from(bits).join('');
const randBits = (N, seed) => { const r = rng(seed); return Uint8Array.from({ length: N }, () => (r() < 0.5 ? 1 : 0)); };
const line = (px, y) => [...px, y].join(',');
const flat = (v) => Array.from({ length: 64 }, () => v);

test('the sealed constants', () => {
  assert.deepEqual([C.PIXELS, C.CLASSES, C.MAXV, C.MAX_ROUNDS, C.MAX_SWEEPS], [64, 10, 16, 25, 64]);
  assert.deepEqual(C.THRESHOLDS, { 1: [8], 2: [5, 11], 4: [2, 6, 10, 14] });
  assert.ok(Object.isFrozen(C.THRESHOLDS) && Object.isFrozen(C.THRESHOLDS[4]));
});

test('parse: good lines kept, every kind of bad line counted, never a throw', () => {
  const good = line(flat(16), 9), zero = line(flat(0), 0);
  const r = C.parse([good, '', '  ', zero + '\r', line(flat(17), 1), line(flat(3), 10), line(flat(3), -1), flat(3).join(','),
    good + ',1', 'a,' + good.slice(2), ',' + good.slice(2), line([1.5, ...flat(1).slice(1)], 2), line([123, ...flat(1).slice(1)], 2)].join('\n'));
  assert.equal(r.x.length, 2);
  assert.deepEqual(r.y, [9, 0]);
  assert.deepEqual(r.x[0], flat(16));
  assert.deepEqual(r.x[1], flat(0));
  assert.equal(r.bad, 9);
  for (const g of [null, undefined, 42, {}, '\n\n', 'x']) assert.doesNotThrow(() => C.parse(g));
  assert.deepEqual(C.parse(null), { x: [], y: [], bad: 0 });
});

test('encode: the thermometer code, threshold for threshold, pixel by pixel', () => {
  const at = (v, b) => str(C.encode(flat(v), b).slice(0, b));
  assert.deepEqual([0, 7, 8, 16].map((v) => at(v, 1)), ['0', '0', '1', '1']);
  assert.deepEqual([4, 5, 10, 11, 16].map((v) => at(v, 2)), ['00', '10', '10', '11', '11']);
  assert.deepEqual([1, 2, 5, 6, 9, 10, 13, 14, 16].map((v) => at(v, 4)), ['0000', '1000', '1000', '1100', '1100', '1110', '1110', '1111', '1111']);
  const px = flat(0); px[3] = 11; px[63] = 6;
  const e = C.encode(px, 2);
  assert.equal(e.length, 128);
  assert.equal(str(e.slice(6, 8)), '11');
  assert.equal(str(e.slice(126, 128)), '10');
  assert.equal(e.reduce((s, v) => s + v, 0), 3);
  assert.equal(C.encode(px, 3), null);
  assert.equal(C.encode(px, 0), null);
  assert.equal(C.encode(px.slice(1), 2), null);
  assert.equal(C.encode('x'.repeat(64), 2), null);
  assert.deepEqual(C.inkOf(C.encode(px, 4), 4).slice(0, 4), [0, 0, 0, 3]);
  assert.equal(C.inkOf(C.encode(px, 4), 4)[63], 2);
});

test('hamming, pack, popcount: the same distance two ways', () => {
  assert.equal(C.hamming(bitsFrom('1100'), bitsFrom('1010')), 2);
  assert.deepEqual([0, 0xffffffff, 0x80000000, 0x12345678, 1].map(C.popcount), [0, 32, 1, 13, 1]);
  assert.deepEqual([32, 33, 64].map((n) => C.pack(new Uint8Array(n)).length), [1, 2, 2]);
  const p = new Uint8Array(64); p[0] = 1; p[31] = 1; p[32] = 1;
  const w = C.pack(p);
  assert.equal(w[0], 0x80000001);
  assert.equal(w[1], 1);
  for (const [N, s] of [[64, 1], [100, 2], [256, 3]]) {
    const a = randBits(N, s), b = randBits(N, s + 10);
    assert.equal(C.hammingW(C.pack(a), C.pack(b)), C.hamming(a, b));
  }
});

test('kernel: max(R − d, 0)^n exactly, and out-of-range settings refused', () => {
  const K = C.kernel(10, 4, 3);
  assert.deepEqual(Array.from(K), [64, 27, 8, 1, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(C.kernel(8, 8, 8)[0], 8 ** 8);
  assert.equal(C.kernel(8, 8, 1)[7], 1);
  for (const bad of [[10, 0, 2], [10, 11, 2], [10, 4, 0], [10, 4, 9], [0, 1, 1], [10, 2.5, 2], [10, 2, 1.5], [10.5, 2, 2]]) assert.equal(C.kernel(...bad), null, String(bad));
});

test('majority: strict majority wins, a tie keeps the old bit or falls to 0', () => {
  const m = [bitsFrom('1100'), bitsFrom('1010')];
  assert.equal(str(C.majority(m)), '1000');
  assert.equal(str(C.majority(m, bitsFrom('0111'))), '1110');
  assert.equal(str(C.majority(m, bitsFrom('0001'))), '1000');
  assert.equal(str(C.majority([...m, bitsFrom('0110')])), '1110');
});

test('nearestIndex: the nearest, the lowest index on a tie, -1 on an empty pool', () => {
  const pool = ['1111', '0011', '1100', '0011'].map((s) => C.pack(bitsFrom(s)));
  assert.equal(C.nearestIndex(pool, C.pack(bitsFrom('0001'))), 1);
  assert.equal(C.nearestIndex(pool, C.pack(bitsFrom('1000'))), 2);
  assert.equal(C.nearestIndex(pool, C.pack(bitsFrom('1010'))), 0);
  assert.equal(C.nearestIndex([], C.pack(bitsFrom('1010'))), -1);
});

test('growClass: the sealed k-modes, tie for tie', () => {
  const P = ['11110000', '11100000', '11110001', '00001111', '00011111', '00001110'].map(bitsFrom);
  assert.deepEqual(C.growClass(P, 2).map(str), ['11110000', '00001111']);
  assert.deepEqual(C.growClass(P, 1).map(str), ['11100000'], 'one memory: the first pick, ties keep its bits');
  const three = C.growClass(P, 3).map(str);
  assert.equal(three.length, 3);
  assert.deepEqual(C.growClass(P, 3).map(str), three, 'deterministic');
  assert.equal(C.growClass(P, 9).length, 6);
  assert.deepEqual(C.growClass(P, 0), []);
  assert.deepEqual(C.growClass(P, 1.5), []);
  assert.deepEqual(C.growClass([], 2), []);
  assert.deepEqual(C.growClass('x', 2), []);
  const Q = ['1000', '0100', '0010', '0001', '1000'].map(bitsFrom);
  assert.deepEqual(C.growClass(Q, 2).map(str), ['1000', '0100']);
  const S = ['111000', '110000', '000111', '000011', '100000'].map(bitsFrom);
  assert.deepEqual(C.growClass(S, 2).map(str), ['110000', '000111'], 'a tied bit keeps the memory it came from');
});

test('grow: class by class, in class order, and null on bad settings', () => {
  const x = [flat(16), flat(0), flat(16), flat(9)], y = [3, 1, 3, 1];
  const s = C.grow(x, y, { b: 1, k: 2 });
  assert.deepEqual(s.cls, [1, 1, 3, 3], 'two identical digits give two identical memories');
  assert.equal(s.N, 64);
  assert.equal(s.mem[2].reduce((a, v) => a + v, 0), 64);
  assert.equal(C.grow(x, y, { b: 3, k: 2 }), null);
  assert.equal(C.grow(x, y, { b: 1, k: 0 }), null);
  assert.equal(C.grow(x, y.slice(1), { b: 1, k: 2 }), null);
  assert.equal(C.grow([], [], { b: 1, k: 2 }), null);
  assert.equal(C.grow([flat(1).slice(1)], [2], { b: 1, k: 1 }), null);
});

test('hex, shape text and cell text round-trip, and malformed text is refused', () => {
  assert.equal(C.hexOf(bitsFrom('1011 0001')), 'b1');
  assert.equal(str(C.bitsOf('b1', 8)), '10110001');
  for (const bad of [['b1', 4], ['zz', 8], [7, 8], ['B1', 8]]) assert.equal(C.bitsOf(...bad), null);
  const s = C.grow([flat(16), flat(5), flat(0)], [2, 2, 7], { b: 2, k: 2 });
  const t = C.shapeText(s);
  assert.match(t, /^settling-cell\.shape\.v1 b=2 k=2 N=128 M=3\n2 [0-9a-f]{32}\n/);
  assert.equal(C.shapeText(C.parseShape(t)), t);
  const ct = C.cellText(s, 16, 4);
  assert.ok(ct.startsWith('settling-cell.cell.v1 R=16 n=4\nsettling-cell.shape.v1'));
  const back = C.parseCell(ct.replace(/\n/g, '\r\n'));
  assert.deepEqual([back.R, back.n, C.shapeText(back.shape)], [16, 4, t]);
  for (const bad of [t.replace('v1', 'v2'), t.replace('N=128', 'N=64'), t.replace('M=3', 'M=4'), t.replace('\n2 ', '\nx '), t.replace(/\n7 [0-9a-f]+/, '\n7 abc'), t.replace('b=2', 'b=3'), 'settling-cell.shape.v1 b=2 k=2 N=128 M=0\n', '', null])
    assert.equal(C.parseShape(bad), null);
  for (const bad of ['settling-cell.cell.v1 R=16\n' + t, 'settling-cell.cell.v1 R=16 n=4', null, 'settling-cell.cell.v1 R=16 n=4\nnope']) assert.equal(C.parseCell(bad), null);
});

const toy = (R = 4, n = 2) => C.cell({ b: 1, k: 1, N: 8, mem: [bitsFrom('11110000'), bitsFrom('00001111')], cls: [0, 1] }, { R, n });

test('cell: whole numbers stay exact or the cell is refused', () => {
  const c = toy();
  assert.deepEqual([c.N, c.M, c.R, c.n], [8, 2, 4, 2]);
  assert.equal(c.memT[0 * 2 + 0], 1);
  assert.equal(c.memT[0 * 2 + 1], 0);
  assert.equal(c.memT[7 * 2 + 1], 1);
  const wide = (M) => ({ b: 4, k: M, N: 256, mem: Array.from({ length: M }, () => new Uint8Array(256)), cls: Array(M).fill(0) });
  assert.ok(C.cell(wide(31), { R: 256, n: 6 }), '31 · 2^48 fits');
  assert.equal(C.cell(wide(32), { R: 256, n: 6 }), null, '32 · 2^48 = 2^53 does not');
  assert.equal(C.cell({ b: 1, k: 1, N: 8, mem: [[1, 0, 1, 0, 1, 0, 1, 0]], cls: [0] }, { R: 2, n: 2 }), null);
  assert.equal(C.cell({ b: 1, k: 1, N: 8, mem: [new Uint8Array(7)], cls: [0] }, { R: 2, n: 2 }), null);
  assert.equal(C.cell({ b: 1, k: 1, N: 8, mem: [], cls: [] }, { R: 2, n: 2 }), null);
  assert.equal(C.cell(null, { R: 2, n: 2 }), null);
  assert.equal(C.cell({ b: 1, k: 1, N: 8, mem: [new Uint8Array(8)], cls: [0] }, { R: 9, n: 2 }), null);
});

test('distances, fit, class fit and the answer rule', () => {
  const c = toy();
  const d = C.distances(c, bitsFrom('11100000'));
  assert.deepEqual(Array.from(d), [1, 7]);
  assert.equal(C.energyOf(c, d), 9);
  assert.deepEqual(C.classFit(c, d).slice(0, 2), [9, 0]);
  assert.equal(C.classFit(c, d).length, 10);
  assert.equal(C.answerOf([0, 3, 3, 1]), 1);
  assert.equal(C.answerOf([0, 0, 0]), -1);
  assert.equal(C.answerOf([2, 5, 1]), 1);
  assert.deepEqual(C.readout(c, bitsFrom('11100000')), { answer: 0, fit: 9 });
  assert.deepEqual(C.readout(c, bitsFrom('11000000')), { answer: 0, fit: 4 });
  assert.deepEqual(C.readout(c, bitsFrom('11001100')), { answer: -1, fit: 0 });
});

test('settle: one flip into the memory, then a quiet sweep, and every number on the way', () => {
  const st = C.settle(toy(), bitsFrom('11100000'), { trace: true });
  assert.equal(str(st.state), '11110000');
  assert.deepEqual([st.start, st.fit, st.flips, st.sweeps, st.settled, st.answer], [9, 16, 1, 2, true, 0]);
  assert.deepEqual(st.path, [3]);
  assert.deepEqual(Array.from(st.d), [0, 8]);
  assert.equal(C.settle(toy(), bitsFrom('11100000')).path, null);
  const capped = C.settle(toy(), bitsFrom('11100000'), { maxSweeps: 1 });
  assert.deepEqual([capped.sweeps, capped.settled, capped.flips], [1, false, 1]);
  const edge = C.settle(toy(4, 2), bitsFrom('10101010'));
  assert.ok(edge.flips > 0, 'a memory exactly R away still pulls (R−1 has fit 1)');
  const far = C.settle(toy(2, 2), bitsFrom('10101010'));
  assert.deepEqual([far.fit, far.flips, far.sweeps, far.settled, far.answer, str(far.state)], [0, 0, 1, true, -1, '10101010']);
  assert.equal(C.settle(toy(), bitsFrom('1110')), null);
  assert.equal(C.settle(null, bitsFrom('11100000')), null);
  assert.equal(C.settle(toy(), null), null);
});

test('settle: every flip strictly raises the fit, and the end is a true fixed point', () => {
  const r = rng(5);
  const mem = Array.from({ length: 12 }, (_, i) => randBits(48, 100 + i));
  const c = C.cell({ b: 1, k: 3, N: 48, mem, cls: mem.map((_, i) => i % 4) }, { R: 14, n: 3 });
  let moves = 0;
  for (let t = 0; t < 30; t++) {
    const start = Uint8Array.from(mem[t % 12]);
    for (let j = 0; j < 9; j++) start[Math.floor(r() * 48)] ^= 1;
    const st = C.settle(c, start, { trace: true });
    let s = Uint8Array.from(start), f = C.energyOf(c, C.distances(c, s));
    assert.equal(f, st.start);
    for (const i of st.path) { s[i] ^= 1; const g = C.energyOf(c, C.distances(c, s)); assert.ok(g > f, 'a flip lowered E'); f = g; moves++; }
    assert.equal(f, st.fit);
    assert.deepEqual(s, st.state);
    for (let i = 0; i < 48; i++) { s[i] ^= 1; assert.ok(C.energyOf(c, C.distances(c, s)) <= st.fit, 'no single flip lowers E further'); s[i] ^= 1; }
    assert.equal(st.answer, C.answerOf(C.classFit(c, C.distances(c, st.state))));
  }
  assert.ok(moves > 30);
});

test('noise and scrambling: seeded, distinct positions, nested, and in range', () => {
  const ramp = Array.from({ length: 64 }, (_, i) => i % 17);
  const z = C.noisy(ramp, 3, 1);
  assert.deepEqual(z.map((v, i) => (v === ramp[i] ? null : [i, v])).filter(Boolean), [[34, 16], [40, 0], [62, 4]]);
  assert.deepEqual(C.noisy(ramp, 0, 1), ramp);
  assert.deepEqual(C.noisy(ramp, -5, 1), ramp);
  assert.deepEqual(C.noisy(ramp, 3.9, 1), z);
  assert.notDeepEqual(C.noisy(ramp, 3, 2), z);
  const six = C.noisy(ramp, 6, 9), sixteen = C.noisy(ramp, 16, 9);
  for (let p = 0; p < 64; p++) if (six[p] !== ramp[p]) assert.equal(sixteen[p], six[p], 'the 10% noise is the start of the 25% noise');
  const all = C.noisy(flat(99), 100, 4);
  assert.ok(all.every((v) => Number.isInteger(v) && v >= 0 && v <= 16), 'every pixel replaced, each in 0..16');
  assert.ok(C.noisy(flat(0), 64, 3).some((v) => v === 16), 'the top value 16 is reachable');
  assert.deepEqual(ramp, Array.from({ length: 64 }, (_, i) => i % 17), 'the input is not changed');
  const sc = C.scrambled(ramp, 5);
  assert.deepEqual(sc.slice(0, 12), [3, 6, 5, 7, 7, 3, 12, 10, 1, 3, 15, 2]);
  assert.deepEqual([...sc].sort((a, b) => a - b), [...ramp].sort((a, b) => a - b));
  assert.deepEqual(C.scrambled(ramp, 5), sc);
  assert.notDeepEqual(C.scrambled(ramp, 6), sc);
});

test('pairedLow: the 2.5th percentile of the paired difference, seeded', () => {
  const a = [1, 0, 1, 1, 0, 1, 1, 1, 0, 1], b = [0, 0, 1, 0, 0, 1, 0, 1, 0, 0];
  assert.equal(C.pairedLow(a, b, 40, 7), 0.1);
  assert.equal(C.pairedLow(a, b), 0.1);
  assert.equal(C.pairedLow([1, 1, 1], [0, 0, 0]), 1);
  assert.equal(C.pairedLow([1, 0, 1], [1, 0, 1]), 0);
  assert.equal(C.pairedLow([0, 0, 0, 0], [1, 1, 1, 1], 10, 1), -1);
  assert.ok(Number.isNaN(C.pairedLow([], [])));
  assert.ok(Number.isNaN(C.pairedLow([1], [1, 0])));
  const u = Array.from({ length: 200 }, (_, i) => (i % 3 ? 1 : 0)), v = Array.from({ length: 200 }, (_, i) => (i % 5 ? 1 : 0));
  const lo = C.pairedLow(u, v, 400, 3);
  assert.equal(lo, -0.215);
});

test('a real slice: grown on 400 training digits, settled on the next 100', () => {
  const t = C.parse(readFileSync(new URL('../data/optdigits.tra', import.meta.url), 'utf8'));
  const s = C.grow(t.x.slice(0, 400), t.y.slice(0, 400), { b: 2, k: 5 });
  assert.equal(s.mem.length, 50);
  const c = C.cell(s, { R: 16, n: 4 });
  let ok = 0, one = 0, flips = 0;
  const ans = [];
  for (let i = 400; i < 500; i++) {
    const bits = C.encode(t.x[i], 2), st = C.settle(c, bits);
    ok += st.answer === t.y[i]; one += C.readout(c, bits).answer === t.y[i]; flips += st.flips; ans.push(st.answer);
  }
  assert.deepEqual([ok, one, flips], [66, 55, 877]);
  assert.equal(ans.slice(0, 20).join(''), '-151-1890-12793172-17183');
  const st = C.settle(c, C.encode(C.noisy(t.x[450], 16, 2026 + 450), 2));
  assert.deepEqual([st.answer, st.fit, st.flips, st.sweeps, C.hexOf(st.state)], [-1, 0, 0, 1, '00203bf80b2c2c380c282a0802f2a2e0']);
});

test('the default export carries every function', () => {
  for (const k of ['parse', 'encode', 'inkOf', 'hamming', 'pack', 'popcount', 'hammingW', 'kernel', 'majority', 'nearestIndex', 'growClass', 'grow', 'hexOf', 'bitsOf', 'shapeText', 'parseShape', 'cellText', 'parseCell', 'cell', 'distances', 'energyOf', 'classFit', 'answerOf', 'readout', 'settle', 'noisy', 'scrambled', 'pairedLow'])
    assert.equal(typeof C[k], 'function', k);
});
