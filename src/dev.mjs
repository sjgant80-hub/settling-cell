// src/dev.mjs — choosing the cell's settings on the training file only, exactly as CLAIMS.md (seal 1) fixed it:
// dev = training rows whose index mod 4 is 3; grow on the rest; the sealed grid; score = clean + 25%-noise correct
// counts on dev (the same order as their mean); ties to the smaller shape (N·k), then smaller n, then smaller R.
// Amendment 1 (AMENDMENT.md) widened the powers only; GRID_V1 is the grid seal 1 fixed, kept so its table re-derives.
// The winner is then grown on all 3,823 training digits; its canonical text is what seal 2 hashes. Pure: no file system.
import C from './cell.mjs';
import { sha256Hex } from '../vendor/seed-library/sha256.mjs';

export const GRID_V1 = Object.freeze({ b: [1, 2, 4], k: [5, 10, 20, 40], n: [2, 3, 4] });           // seal 1
export const GRID = Object.freeze({ b: [1, 2, 4], k: [5, 10, 20, 40], n: [2, 3, 4, 6, 8] });        // amendment 1
export const reachesOf = (N) => [Math.floor(N / 8), Math.floor(N / 4), Math.floor((3 * N) / 8)];
export const NOISE_PIXELS = 16, NOISE_SEED = 2026;

/** split(count) → the sealed dev split: rows with index % 4 === 3 are dev, the rest grow. */
export function split(count) {
  const grow = [], dev = [];
  for (let i = 0; i < count; i++) (i % 4 === 3 ? dev : grow).push(i);
  return { grow, dev };
}

/** scoreOn(c, b, x, y, rows) → how many of `rows` the cell answers right, clean and at 25% noise, and its worst settle. */
export function scoreOn(c, b, x, y, rows) {
  let clean = 0, noisy = 0, maxSweeps = 0, unsettled = 0;
  for (const i of rows) {
    const a = C.settle(c, C.encode(x[i], b));
    const z = C.settle(c, C.encode(C.noisy(x[i], NOISE_PIXELS, NOISE_SEED + i), b));
    if (a.answer === y[i]) clean++;
    if (z.answer === y[i]) noisy++;
    maxSweeps = Math.max(maxSweeps, a.sweeps, z.sweeps);
    if (!a.settled || !z.settled) unsettled++;
  }
  return { clean, noisy, score: clean + noisy, maxSweeps, unsettled };
}

/** better(a, b) → true when row a beats row b by the sealed rule. */
export function better(a, b) {
  if (a.score !== b.score) return a.score > b.score;
  if (a.N * a.k !== b.N * b.k) return a.N * a.k < b.N * b.k;
  if (a.n !== b.n) return a.n < b.n;
  return a.R < b.R;
}

/** runDev(traText) → { devCount, rows, choice, cellText, cellHash }: the whole dev table and the frozen winner. */
export function runDev(traText, grid = GRID) {
  const { x, y } = C.parse(traText);
  if (!x.length) return null;
  const { grow, dev } = split(x.length);
  const gx = grow.map((i) => x[i]), gy = grow.map((i) => y[i]);
  const rows = [];
  for (const b of grid.b) for (const k of grid.k) {
    const shape = C.grow(gx, gy, { b, k });
    const N = C.PIXELS * b;
    for (const R of reachesOf(N)) for (const n of grid.n) {
      const c = C.cell(shape, { R, n });
      rows.push(c ? { b, k, N, M: shape.mem.length, R, n, ok: true, ...scoreOn(c, b, x, y, dev) } : { b, k, N, M: shape ? shape.mem.length : 0, R, n, ok: false, score: -1 });
    }
  }
  const choice = rows.filter((r) => r.ok).reduce((best, r) => (best === null || better(r, best) ? r : best), null);
  const final = C.grow(x, y, { b: choice.b, k: choice.k });
  const cellText = C.cellText(final, choice.R, choice.n);
  return { trainCount: x.length, devCount: dev.length, rows, choice, cellText, cellHash: sha256Hex(cellText) };
}

export default { GRID, GRID_V1, reachesOf, split, scoreOn, better, runDev, NOISE_PIXELS, NOISE_SEED };
