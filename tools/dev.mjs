#!/usr/bin/env node
// tools/dev.mjs — runs the dev procedure on data/optdigits.tra (the training file only), twice:
//   the grid seal 1 fixed  → data/dev-v1.json + data/cell-v1.txt (kept: its cell is also run once on the test)
//   the amended grid       → data/dev.json    + data/cell.txt    (the cell the claims are judged on; seal 2)
// `--check` re-runs both and fails unless all four files reproduce byte for byte: CI runs that on every push.
import { readFileSync, writeFileSync } from 'node:fs';
import { runDev, GRID, GRID_V1 } from '../src/dev.mjs';

const ROOT = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');
const check = process.argv.includes('--check');
const tra = read('data/optdigits.tra');
let same = true;
for (const [tag, grid, devFile, cellFile] of [['seal 1 grid', GRID_V1, 'data/dev-v1.json', 'data/cell-v1.txt'], ['amended grid', GRID, 'data/dev.json', 'data/cell.txt']]) {
  const t0 = Date.now();
  const r = runDev(tra, grid);
  if (!r) { console.error('dev: the training file did not parse'); process.exit(1); }
  const dev = JSON.stringify({ trainCount: r.trainCount, devCount: r.devCount, grid, rule: 'score = clean + 25%-noise correct on dev; ties: smaller N·k, then n, then R', choice: r.choice, cellHash: r.cellHash, rows: r.rows }, null, 1) + '\n';
  const c = r.choice;
  if (check) {
    const ok = read(devFile) === dev && read(cellFile) === r.cellText;
    same = same && ok;
    console.log(tag + ': ' + (ok ? 'DEV REPRODUCED · cell ' + r.cellHash.slice(0, 16) : 'DEV DIFFERS'));
    continue;
  }
  writeFileSync(new URL(devFile, ROOT), dev);
  writeFileSync(new URL(cellFile, ROOT), r.cellText);
  console.log(tag + ': ' + r.rows.length + ' settings on ' + r.devCount + ' dev digits, ' + Math.round((Date.now() - t0) / 1000) + ' s · chose b=' + c.b + ' k=' + c.k + ' R=' + c.R + ' n=' + c.n +
    ' · dev clean ' + c.clean + ' · 25% noise ' + c.noisy + ' · worst settle ' + c.maxSweeps + ' sweeps · cell ' + r.cellHash);
}
if (check) process.exit(same ? 0 : 1);
