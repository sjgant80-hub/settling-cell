#!/usr/bin/env node
// tools/run.mjs — the held-out test. It refuses to run unless seal 2 exists and names the cell in data/cell.txt by
// its hash, and unless data/optdigits.tes is byte for byte the file seal 1 pinned. It runs the judged cell and the
// original-grid cell (AMENDMENT.md) once each and writes data/record.json. `--check` re-runs and fails unless the
// record reproduces exactly: CI runs that on every push, and the page's worker reproduces the same hash in a tab.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { evaluate, verdicts } from '../src/run.mjs';

export const TES_SHA256 = '6ebb3d2fee246a4e99363262ddf8a00a3c41bee6014c373ed9d9216ba7f651b8';
export const TRA_SHA256 = 'e1b683cc211604fe8fd8c4417e6a69f31380e0c61d4af22e93cc21e9257ffedd';
const ROOT = new URL('../', import.meta.url);
const raw = (p) => readFileSync(new URL(p, ROOT));
const read = (p) => raw(p).toString('utf8');
const sha = (p) => createHash('sha256').update(raw(p)).digest('hex');
const stop = (why) => { console.error('run: ' + why); process.exit(1); };

if (!existsSync(new URL('SEAL2.md', ROOT))) stop('no SEAL2.md: the cell is not frozen yet, so the test file may not be read');
const cellHash = sha('data/cell.txt');
if (!read('SEAL2.md').includes(cellHash)) stop('data/cell.txt (' + cellHash.slice(0, 16) + ') is not the cell seal 2 names');
if (sha('data/optdigits.tra') !== TRA_SHA256) stop('data/optdigits.tra is not the file seal 1 pinned');
if (sha('data/optdigits.tes') !== TES_SHA256) stop('data/optdigits.tes is not the file seal 1 pinned');

const t0 = Date.now();
const inputs = { traText: read('data/optdigits.tra'), tesText: read('data/optdigits.tes') };
const judged = evaluate({ ...inputs, cellText: read('data/cell.txt') });
const v1 = evaluate({ ...inputs, cellText: read('data/cell-v1.txt') });
if (!judged || !v1) stop('a cell did not evaluate');
const out = JSON.stringify({ judged, verdicts: verdicts(judged), originalGrid: v1, originalGridVerdicts: verdicts(v1) }, null, 1) + '\n';
if (process.argv.includes('--check')) {
  const same = read('data/record.json') === out;
  console.log(same ? 'RECORD REPRODUCED · ' + judged.hash.slice(0, 16) : 'RECORD DIFFERS');
  process.exit(same ? 0 : 1);
}
writeFileSync(new URL('data/record.json', ROOT), out);
console.log('held-out test: ' + judged.testCount + ' digits × 4 conditions, two cells, ' + Math.round((Date.now() - t0) / 1000) + ' s · record ' + judged.hash);
for (const v of verdicts(judged)) console.log((v.pass ? '  held   ' : '  FAILED ') + v.id + ' · ' + v.what + ' · ' + JSON.stringify(v.measured) + ' (bar ' + v.bar + ')');
