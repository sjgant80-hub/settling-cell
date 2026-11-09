// The held-out runner and the dev procedure, held to the sealed text: every bar, count and seed in code is checked
// against CLAIMS.md and AMENDMENT.md themselves, and both procedures are pinned on small fixtures from the training
// file (fixtures only: the claims are judged by tools/run.mjs on the real test file, once).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import C from '../src/cell.mjs';
import R from '../src/run.mjs';
import D from '../src/dev.mjs';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const claims = read('CLAIMS.md').replace(/\s+/g, ' '), amend = read('AMENDMENT.md').replace(/\s+/g, ' ');
const lines = read('data/optdigits.tra').split('\n');
const tra = lines.slice(0, 300).join('\n'), tes = lines.slice(300, 340).join('\n');
const fixture = () => { const t = C.parse(tra); return C.cellText(C.grow(t.x, t.y, { b: 2, k: 3 }), 32, 6); };

test('every bar, count and seed in the code is the one the seal states', () => {
  for (const s of ['Clean accuracy ≥ 95.0%', 'by more than 1.5 points', 'within 12 sweeps', 'accuracy ≥ clean − 2.0 points', 'accuracy ≥ clean − 8.0 points',
    'lower bound > −0.5 points', 'on at least 70% of test digits', 'AUC ≥ 0.98', '10% = 6 pixels, 25% = 16 pixels', 'seeded 2026 + the digit', 'seeded 7000 + the row index', '2,000 resamples, seed 99',
    'Dev split: training rows whose index (0-based) mod 4 = 3', 'b ∈ {1, 2, 4}; k ∈ {5, 10, 20, 40}; R ∈ {⌊N/8⌋, ⌊N/4⌋, ⌊3N/8⌋}; n ∈ {2, 3, 4}'])
    assert.ok(claims.includes(s), 'CLAIMS.md says: ' + s);
  assert.ok(amend.includes('n ∈ {2, 3, 4} becomes **n ∈ {2, 3, 4, 6, 8}**'));
  assert.deepEqual(R.BARS, { T1: 0.95, T2: -0.015, T3: 0, T5: 12, T6a: 0.02, T6b: 0.08, T7noisy: 0, T7clean: -0.005, T8: 0.7, T9: 0.98 });
  assert.ok(Object.isFrozen(R.BARS));
  assert.deepEqual(R.PIXELS_FOR, { n10: 6, n25: 16 });
  assert.deepEqual(R.SEEDS, { noise: 2026, scramble: 7000, boot: 99 });
  assert.equal(R.RESAMPLES, 2000);
  assert.deepEqual(R.CONDITIONS, ['clean', 'n10', 'n25', 'scrambled']);
  assert.deepEqual(D.GRID_V1, { b: [1, 2, 4], k: [5, 10, 20, 40], n: [2, 3, 4] });
  assert.deepEqual(D.GRID, { b: [1, 2, 4], k: [5, 10, 20, 40], n: [2, 3, 4, 6, 8] });
  assert.deepEqual([D.NOISE_PIXELS, D.NOISE_SEED], [16, 2026]);
  assert.deepEqual([64, 128, 256].map(D.reachesOf), [[8, 16, 24], [16, 32, 48], [32, 64, 96]]);
  assert.deepEqual(D.reachesOf(100), [12, 25, 37]);
});

test('pixelsFor: each sealed condition, and a copy, never the input itself', () => {
  const px = Array.from({ length: 64 }, (_, i) => i % 17);
  const clean = R.pixelsFor(px, 'clean', 5);
  assert.deepEqual(clean, px);
  assert.notEqual(clean, px);
  assert.deepEqual(R.pixelsFor(px, 'n10', 5), C.noisy(px, 6, 2031));
  assert.deepEqual(R.pixelsFor(px, 'n25', 5), C.noisy(px, 16, 2031));
  assert.deepEqual(R.pixelsFor(px, 'scrambled', 5), C.scrambled(px, 7005));
  assert.deepEqual(R.pixelsFor(px, 'other', 5), px);
});

test('evaluate: the whole record on a fixture, number for number', () => {
  const ct = fixture();
  const r = R.evaluate({ traText: tra, tesText: tes, cellText: ct });
  assert.equal(r.regrown, true);
  assert.deepEqual(r.settings, { b: 2, k: 3, N: 128, M: 30, R: 32, n: 6 });
  assert.deepEqual([r.trainCount, r.testCount, r.settles], [300, 40, 160]);
  assert.deepEqual(r.accuracy, { clean: 0.625, n10: 0.6, n25: 0.525 });
  assert.deepEqual(r.correct, { clean: 25, n10: 24, n25: 21 });
  assert.deepEqual(r.oneStep, { clean: 0.6, n25: 0.525 });
  assert.deepEqual([r.nn1, r.centroid, r.cleaner, r.cleanerCount, r.nonFitAuc], [0.65, 0.675, 0.35, 14, 1]);
  assert.deepEqual(r.lows, { T2: -0.15, T3: -0.25, T7noisy: 0, T7clean: 0 });
  assert.deepEqual(r.settle, { maxSweeps: 3, allSettled: true, honest: true, meanFlips: { clean: 15.95, n10: 19.575, n25: 22.7, scrambled: 0 } });
  assert.equal(r.hash, '5e93b1c37916152fcaa9b7a27cedfd44cece9519f3cde343e35644c09c253f07');
  assert.equal(r.cellHash.slice(0, 12), '73c0f16ae998');
  assert.equal(R.evaluate({ traText: tra, tesText: tes, cellText: ct }).hash, r.hash, 'two runs, one hash');
  const other = R.evaluate({ traText: lines.slice(0, 299).join('\n'), tesText: tes, cellText: ct });
  assert.equal(other.regrown, false, 'a cell not grown from this training file is caught');
  assert.equal(R.evaluate({ traText: tra, tesText: '', cellText: ct }), null);
  assert.equal(R.evaluate({ traText: '', tesText: tes, cellText: ct }), null);
  assert.equal(R.evaluate({ traText: tra, tesText: tes, cellText: 'nope' }), null);
  assert.equal(R.evaluate({ traText: tra, tesText: tes, cellText: ct.replace('R=32', 'R=999') }), null);
});

const rec = (o = {}) => ({ testCount: 100, correct: { clean: 95, n10: 93, n25: 87 }, accuracy: { clean: 0.95, n10: 0.93, n25: 0.87 }, lows: { T2: -0.0149, T3: 0.0001, T7noisy: 0.0001, T7clean: -0.0049 },
  settle: { maxSweeps: 12, allSettled: true, honest: true }, cleaner: 0.7, cleanerCount: 70, nonFitAuc: 0.98, ...o });
const pass = (r) => Object.fromEntries(R.verdicts(r).map((v) => [v.id, v.pass]));

test('verdicts: every bar is inclusive or strict exactly as sealed, judged on whole counts', () => {
  assert.deepEqual(pass(rec()), { T1: true, T2: true, T3: true, T5: true, T6a: true, T6b: true, T7: true, T8: true, T9: true });
  const fail = (o) => Object.entries(pass(rec(o))).filter(([, v]) => !v).map(([k]) => k);
  assert.deepEqual(fail({ correct: { clean: 94, n10: 92, n25: 86 } }), ['T1'], '94 of 100 is under 95%');
  assert.deepEqual(fail({ correct: { clean: 95, n10: 92, n25: 87 } }), ['T6a'], '3 of 100 lost is over 2 points');
  assert.deepEqual(fail({ correct: { clean: 95, n10: 93, n25: 86 } }), ['T6b'], '9 of 100 lost is over 8 points');
  assert.deepEqual(fail({ testCount: 1797, cleanerCount: 1258, correct: { clean: 1708, n10: 1672, n25: 1565 } }), ['T6a'], '36 lost of 1797 is 2.003 points: 50·36 = 1800 > 1797');
  assert.deepEqual(fail({ testCount: 1797, cleanerCount: 1258, correct: { clean: 1708, n10: 1673, n25: 1565 } }), [], '35 lost of 1797 is within 2 points; 143 lost is within 8');
  assert.deepEqual(fail({ testCount: 1797, cleanerCount: 1258, correct: { clean: 1707, n10: 1673, n25: 1565 } }), ['T1'], '1707/1797 = 94.99%');
  assert.deepEqual(fail({ testCount: 1797, cleanerCount: 1258, correct: { clean: 1708, n10: 1673, n25: 1564 } }), ['T6b'], '144 lost of 1797 is 8.01 points');
  assert.deepEqual(fail({ cleanerCount: 69 }), ['T8']);
  assert.deepEqual(fail({ testCount: 1797, cleanerCount: 1258, correct: { clean: 1708, n10: 1673, n25: 1565 } }), [], '1258/1797 ≥ 70%');
  assert.deepEqual(fail({ testCount: 1797, cleanerCount: 1257, correct: { clean: 1708, n10: 1673, n25: 1565 } }), ['T8']);
  assert.deepEqual(fail({ lows: { T2: -0.015, T3: 0.0001, T7noisy: 0.0001, T7clean: -0.0049 } }), ['T2']);
  assert.deepEqual(fail({ lows: { T2: -0.0149, T3: 0, T7noisy: 0.0001, T7clean: -0.0049 } }), ['T3']);
  assert.deepEqual(fail({ lows: { T2: -0.0149, T3: 0.0001, T7noisy: 0, T7clean: -0.0049 } }), ['T7']);
  assert.deepEqual(fail({ lows: { T2: -0.0149, T3: 0.0001, T7noisy: 0.0001, T7clean: -0.005 } }), ['T7']);
  assert.deepEqual(fail({ settle: { maxSweeps: 13, allSettled: true, honest: true } }), ['T5']);
  assert.deepEqual(fail({ settle: { maxSweeps: 3, allSettled: false, honest: true } }), ['T5']);
  assert.deepEqual(fail({ settle: { maxSweeps: 3, allSettled: true, honest: false } }), ['T5']);
  assert.deepEqual(fail({ nonFitAuc: 0.9799 }), ['T9']);
  const v = R.verdicts(rec());
  assert.deepEqual(v.map((x) => x.id), ['T1', 'T2', 'T3', 'T5', 'T6a', 'T6b', 'T7', 'T8', 'T9']);
  assert.equal(v.find((x) => x.id === 'T6a').measured, 0.02);
  assert.equal(v.find((x) => x.id === 'T6b').measured, 0.08);
  assert.deepEqual(v.find((x) => x.id === 'T7').measured, [0.0001, -0.0049]);
  assert.deepEqual(v.map((x) => x.bar), ['at least 0.95', 'above -0.015', 'above 0', 'at most 12 sweeps', 'at most 0.02', 'at most 0.08', 'above 0 at 25% noise and above -0.005 clean', 'at least 0.7', 'at least 0.98']);
  assert.deepEqual(v.map((x) => x.measured).slice(0, 4), [0.95, -0.0149, 0.0001, 12]);
  assert.deepEqual([v[7].measured, v[8].measured], [0.7, 0.98]);
  assert.ok(v.every((x) => typeof x.what === 'string' && x.what.length > 10));
});

test('honestSettle: a settle whose books do not add up is caught', () => {
  const t = C.parse(tra), c = C.cell(C.grow(t.x, t.y, { b: 2, k: 3 }), { R: 32, n: 6 });
  const st = C.settle(c, C.encode(t.x[5], 2));
  assert.ok(st.flips > 0);
  assert.equal(R.honestSettle(c, st), true);
  assert.equal(R.honestSettle(c, { ...st, fit: st.fit + 1 }), false, 'a fit that the state does not have');
  assert.equal(R.honestSettle(c, { ...st, start: st.fit - st.flips }), true, 'exactly one unit gained per flip is allowed');
  assert.equal(R.honestSettle(c, { ...st, start: st.fit - st.flips + 1 }), false, 'a flip that gained nothing');
  assert.equal(R.honestSettle(c, { ...st, fit: st.fit + 1, start: st.fit - st.flips + 1 }), false);
  const s2 = Uint8Array.from(st.state); s2[0] ^= 1;
  assert.equal(R.honestSettle(c, { ...st, state: s2 }), C.energyOf(c, C.distances(c, s2)) === st.fit);
});

test('dev: the sealed split, the sealed tie rules, and the whole procedure on a fixture', () => {
  assert.deepEqual(D.split(10), { grow: [0, 1, 2, 4, 5, 6, 8, 9], dev: [3, 7] });
  assert.deepEqual(D.split(0), { grow: [], dev: [] });
  const row = (o) => ({ score: 10, N: 64, k: 5, n: 3, R: 16, ...o });
  assert.equal(D.better(row({ score: 11 }), row()), true);
  assert.equal(D.better(row(), row({ score: 11 })), false);
  assert.equal(D.better(row({ k: 4 }), row()), true);
  assert.equal(D.better(row({ N: 128, k: 2 }), row()), true);
  assert.equal(D.better(row({ n: 2 }), row()), true);
  assert.equal(D.better(row({ n: 4 }), row()), false);
  assert.equal(D.better(row({ R: 8 }), row()), true);
  assert.equal(D.better(row(), row()), false);
  assert.equal(D.better(row({ score: 9, k: 1 }), row()), false, 'score comes before size');
  assert.equal(D.better(row({ k: 4, n: 4 }), row()), true, 'size comes before power');
  assert.equal(D.better(row({ n: 2, R: 24 }), row()), true, 'power comes before reach');
  assert.equal(D.better(row({ R: 24 }), row()), false);
  const tiny = lines.slice(0, 120).join('\n');
  const d = D.runDev(tiny, { b: [1], k: [2, 3], n: [2, 6] });
  assert.deepEqual([d.trainCount, d.devCount, d.rows.length], [120, 30, 12]);
  assert.equal(d.rows.map((x) => x.score).join(','), '27,27,19,50,8,41,26,26,6,49,0,36');
  assert.deepEqual(d.choice, { b: 1, k: 2, N: 64, M: 20, R: 16, n: 6, ok: true, clean: 27, noisy: 23, score: 50, maxSweeps: 3, unsettled: 0 });
  assert.equal(d.cellHash.slice(0, 16), '25cc5ce24ed0922d');
  assert.ok(d.cellText.startsWith('settling-cell.cell.v1 R=16 n=6\nsettling-cell.shape.v1 b=1 k=2 N=64 M=20\n'));
  assert.equal(D.runDev('', D.GRID), null);
  const refused = D.runDev(tiny, { b: [4], k: [2], n: [8] });
  assert.deepEqual(refused.rows.map((x) => x.ok), [true, true, false], 'R=96 at n=8 would leave the exact range: refused');
  assert.equal(refused.rows[2].score, -1);
  const c = C.cell(C.grow(C.parse(tiny).x, C.parse(tiny).y, { b: 1, k: 2 }), { R: 16, n: 6 });
  const t = C.parse(tiny);
  assert.deepEqual(D.scoreOn(c, 1, t.x, t.y, [3, 7, 11]), D.scoreOn(c, 1, t.x, t.y, [3, 7, 11]));
  assert.equal(D.scoreOn(c, 1, t.x, t.y, [4, 8, 9], 1).unsettled, 3, 'rows where only one of the two settles is cut short still count');
  assert.equal(D.scoreOn(c, 1, t.x, t.y, [4, 8, 9]).unsettled, 0, 'the sealed cap lets every settle finish');
  assert.equal(D.scoreOn(c, 1, t.x, t.y, [4, 8, 9], 1).maxSweeps, 1);
  const s = D.scoreOn(c, 1, t.x, t.y, [3, 7, 11]);
  assert.equal(s.score, s.clean + s.noisy);
});
