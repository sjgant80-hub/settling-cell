// src/run.mjs — the held-out test, run once after seal 2: the frozen cell against the 1,797 digits of the 13 writers
// it never saw, in every sealed condition, with the sealed baselines, and every claim judged against the bar CLAIMS.md
// fixed before any code. Pure and browser-safe: the page's worker runs this same function and must reproduce the hash.
import C from './cell.mjs';
import { sha256Hex } from '../vendor/seed-library/sha256.mjs';
import { auc, round6 } from '../vendor/seed-library/seedlib.mjs';

export const BARS = Object.freeze({ T1: 0.95, T2: -0.015, T3: 0, T5: 12, T6a: 0.02, T6b: 0.08, T7noisy: 0, T7clean: -0.005, T8: 0.7, T9: 0.98 });
export const PIXELS_FOR = Object.freeze({ n10: 6, n25: 16 });
export const SEEDS = Object.freeze({ noise: 2026, scramble: 7000, boot: 99 });
export const RESAMPLES = 2000;
export const CONDITIONS = Object.freeze(['clean', 'n10', 'n25', 'scrambled']);

/** pixelsFor(px, cond, row) → the test digit as the sealed condition presents it. */
export function pixelsFor(px, cond, row) {
  if (cond === 'n10' || cond === 'n25') return C.noisy(px, PIXELS_FOR[cond], SEEDS.noise + row);
  if (cond === 'scrambled') return C.scrambled(px, SEEDS.scramble + row);
  return px.slice();
}

const sum = (v) => v.reduce((s, a) => s + a, 0);
const share = (v) => round6(sum(v) / v.length);

/** honestSettle(c, st) → true when a settle's books add up: its fit recomputed from scratch is the fit it reported, and
 *  it gained at least one whole unit of fit per flip (every gain is a whole number above zero). */
export function honestSettle(c, st) {
  return C.energyOf(c, C.distances(c, st.state)) === st.fit && st.fit - st.start >= st.flips;
}

/** evaluate({ traText, tesText, cellText }) → the record (every number the claims are judged on, and the T4 hash). */
export function evaluate({ traText, tesText, cellText }) {
  const tra = C.parse(traText), tes = C.parse(tesText), frozen = C.parseCell(cellText);
  if (!frozen || !tra.x.length || !tes.x.length) return null;
  const { shape, R, n } = frozen, b = shape.b;
  const c = C.cell(shape, { R, n });
  if (!c) return null;
  const regrown = C.shapeText(C.grow(tra.x, tra.y, { b, k: shape.k })) === C.shapeText(shape);
  const right = Object.fromEntries(CONDITIONS.map((k) => [k, []]));
  const one = { clean: [], n25: [] }, nn = [], cen = [], cleaner = [], fitG = [], fitS = [], lines = [];
  const flips = Object.fromEntries(CONDITIONS.map((k) => [k, 0]));
  let maxSweeps = 0, allSettled = true, honest = true;
  const trainW = tra.x.map((p) => C.pack(C.encode(p, b)));
  const cents = [];
  for (let k = 0; k < C.CLASSES; k++) { const m = tra.x.filter((_, i) => tra.y[i] === k).map((p) => C.encode(p, b)); cents.push(C.pack(C.majority(m))); }
  for (let i = 0; i < tes.x.length; i++) {
    const y = tes.y[i], cleanBits = C.encode(tes.x[i], b);
    for (const cond of CONDITIONS) {
      const bits = cond === 'clean' ? cleanBits : C.encode(pixelsFor(tes.x[i], cond, i), b);
      const st = C.settle(c, bits);
      if (!honestSettle(c, st)) honest = false;
      if (!st.settled) allSettled = false;
      maxSweeps = Math.max(maxSweeps, st.sweeps);
      flips[cond] += st.flips;
      right[cond].push(st.answer === y ? 1 : 0);
      if (cond === 'clean' || cond === 'n25') one[cond].push(C.readout(c, bits).answer === y ? 1 : 0);
      if (cond === 'n25') cleaner.push(C.hamming(st.state, cleanBits) < C.hamming(bits, cleanBits) ? 1 : 0);
      if (cond === 'clean') fitG.push(st.fit);
      if (cond === 'scrambled') fitS.push(st.fit);
      lines.push(cond + ' ' + i + ' ' + st.answer + ' ' + st.fit + ' ' + st.flips + ' ' + st.sweeps + ' ' + C.hexOf(st.state));
    }
    const w = C.pack(cleanBits);
    nn.push(tra.y[C.nearestIndex(trainW, w)] === y ? 1 : 0);
    cen.push(C.nearestIndex(cents, w) === y ? 1 : 0);
  }
  const low = (a, z) => round6(C.pairedLow(a, z, RESAMPLES, SEEDS.boot));
  const count = tes.x.length;
  return {
    cellHash: sha256Hex(cellText), regrown, settings: { b, k: shape.k, N: shape.N, M: shape.mem.length, R, n },
    trainCount: tra.x.length, testCount: count,
    accuracy: Object.fromEntries(CONDITIONS.filter((k) => k !== 'scrambled').map((k) => [k, share(right[k])])),
    correct: { clean: sum(right.clean), n10: sum(right.n10), n25: sum(right.n25) },
    oneStep: { clean: share(one.clean), n25: share(one.n25) },
    nn1: share(nn), centroid: share(cen),
    lows: { T2: low(right.clean, nn), T3: low(right.clean, cen), T7noisy: low(right.n25, one.n25), T7clean: low(right.clean, one.clean) },
    cleaner: share(cleaner), cleanerCount: sum(cleaner),
    nonFitAuc: round6(auc([...fitG, ...fitS], [...fitG.map(() => 1), ...fitS.map(() => 0)])),
    settle: { maxSweeps, allSettled, honest, meanFlips: Object.fromEntries(CONDITIONS.map((k) => [k, round6(flips[k] / count)])) },
    settles: lines.length,
    hash: sha256Hex(lines.join('\n') + '\n'),
  };
}

/** verdicts(r) → each sealed claim beside its bar. Every bar is the one CLAIMS.md fixed before any code. The bars on
 *  shares are judged on whole-number counts (95% of n ⇔ 20·right ≥ 19·n), so no rounding can tip a verdict. */
export function verdicts(r) {
  const a = r.accuracy, k = r.correct, n = r.testCount;
  return [
    { id: 'T1', what: 'clean accuracy on the 13 unseen writers', measured: a.clean, bar: 'at least ' + BARS.T1, pass: 20 * k.clean >= 19 * n },
    { id: 'T2', what: 'against 1-NN over all 3,823 training digits: 95% lower bound of the gap', measured: r.lows.T2, bar: 'above ' + BARS.T2, pass: r.lows.T2 > BARS.T2 },
    { id: 'T3', what: 'against the nearest class centroid: 95% lower bound of the lead', measured: r.lows.T3, bar: 'above ' + BARS.T3, pass: r.lows.T3 > BARS.T3 },
    { id: 'T5', what: 'every settle reaches a fixed point, every flip lowers the energy, within the sweeps', measured: r.settle.maxSweeps, bar: 'at most ' + BARS.T5 + ' sweeps', pass: r.settle.allSettled && r.settle.honest && r.settle.maxSweeps <= BARS.T5 },
    { id: 'T6a', what: 'accuracy lost at 10% noise', measured: round6(a.clean - a.n10), bar: 'at most ' + BARS.T6a, pass: 50 * (k.clean - k.n10) <= n },
    { id: 'T6b', what: 'accuracy lost at 25% noise', measured: round6(a.clean - a.n25), bar: 'at most ' + BARS.T6b, pass: 25 * (k.clean - k.n25) <= 2 * n },
    { id: 'T7', what: 'settling against the same shape read in one step: lower bound at 25% noise, and clean', measured: [r.lows.T7noisy, r.lows.T7clean], bar: 'above ' + BARS.T7noisy + ' at 25% noise and above ' + BARS.T7clean + ' clean', pass: r.lows.T7noisy > BARS.T7noisy && r.lows.T7clean > BARS.T7clean },
    { id: 'T8', what: 'share of 25%-noise digits the settle moved closer to the clean digit', measured: r.cleaner, bar: 'at least ' + BARS.T8, pass: 10 * r.cleanerCount >= 7 * n },
    { id: 'T9', what: 'settled fit ranks genuine digits above scrambled ones (AUC)', measured: r.nonFitAuc, bar: 'at least ' + BARS.T9, pass: r.nonFitAuc >= BARS.T9 },
  ];
}

export default { BARS, PIXELS_FOR, SEEDS, RESAMPLES, CONDITIONS, pixelsFor, honestSettle, evaluate, verdicts };
