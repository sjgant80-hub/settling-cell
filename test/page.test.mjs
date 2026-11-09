// The page and the files, held to their sealed claims: T10 (no measured number typed into the page), T11 (the UCI
// files are the pinned bytes), the vendored pins, the credits, the page's security policy, and the failures told.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';

const ROOT = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8');
const sha = (p) => createHash('sha256').update(readFileSync(new URL(p, ROOT))).digest('hex');
const html = read('index.html'), app = read('app.mjs'), claims = read('CLAIMS.md');

test('T11: both UCI files are byte for byte the ones seal 1 pinned', () => {
  for (const f of ['optdigits.tra', 'optdigits.tes']) {
    const m = new RegExp('`' + f.replace('.', '\\.') + '`[^\\n]*sha256 `([0-9a-f]{64})`').exec(claims);
    assert.ok(m, 'CLAIMS.md pins ' + f);
    assert.equal(sha('data/' + f), m[1], f + ' changed');
  }
  const buf = Buffer.from(readFileSync(new URL('data/optdigits.tes', ROOT))); buf[10] ^= 1;
  assert.notEqual(createHash('sha256').update(buf).digest('hex'), sha('data/optdigits.tes'), 'one changed byte is caught');
});

test('seal 2 names the frozen cell, and both frozen cells are the ones their dev tables chose', () => {
  assert.ok(read('SEAL2.md').includes(sha('data/cell.txt')));
  assert.equal(JSON.parse(read('data/dev.json')).cellHash, sha('data/cell.txt'));
  assert.equal(JSON.parse(read('data/dev-v1.json')).cellHash, sha('data/cell-v1.txt'));
  assert.ok(read('AMENDMENT.md').includes(sha('data/cell-v1.txt')));
  const r = JSON.parse(read('data/record.json'));
  assert.equal(r.judged.cellHash, sha('data/cell.txt'));
  assert.equal(r.originalGrid.cellHash, sha('data/cell-v1.txt'));
  assert.equal(r.judged.regrown, true);
  assert.equal(r.originalGrid.regrown, true);
});

test('every vendored file is the pinned bytes, and nothing in vendor/ is unpinned', () => {
  const pinned = new Map();
  for (const s of JSON.parse(read('vendor/SOURCES.json')).sources) for (const f of s.files) pinned.set(f.path, f.sha256);
  const files = [];
  (function walk(d) { for (const n of readdirSync(new URL(d, ROOT))) { const p = d + '/' + n; if (statSync(new URL(p, ROOT)).isDirectory()) walk(p); else files.push(p); } })('vendor');
  for (const f of files.filter((x) => x !== 'vendor/SOURCES.json')) { assert.ok(pinned.has(f), f + ' is not pinned'); assert.equal(sha(f), pinned.get(f), f + ' changed'); }
  assert.equal(pinned.size, 4);
});

test('T10: no measured number is typed into the page', () => {
  const r = JSON.parse(read('data/record.json')), dev = JSON.parse(read('data/dev.json')), dev1 = JSON.parse(read('data/dev-v1.json'));
  const forms = new Set();
  const frac = (v) => { if (typeof v !== 'number' || !Number.isFinite(v)) return; if (v !== 0 && v !== 1) forms.add(String(v)); forms.add((v * 100).toFixed(1) + '%'); forms.add((v * 100).toFixed(2)); forms.add(Math.abs(v * 100).toFixed(2) + ' points'); forms.add(v.toFixed(4)); };
  for (const x of [r.judged, r.originalGrid]) {
    for (const v of [...Object.values(x.accuracy), ...Object.values(x.oneStep), x.nn1, x.centroid, x.cleaner, x.nonFitAuc, ...Object.values(x.lows)]) frac(v);
    for (const [k, v] of Object.entries(x.settings)) forms.add(k + '=' + v);
    forms.add(x.settings.N + ' bits'); forms.add(x.settings.M + ' patterns'); forms.add(x.settle.maxSweeps + ' sweeps');
    forms.add(x.hash.slice(0, 12)); forms.add(x.cellHash.slice(0, 12)); forms.add(String(x.settles)); forms.add(x.settles.toLocaleString('en-GB'));
    forms.add(x.settle.meanFlips.clean.toFixed(1));   // the only mean the page renders
  }
  for (const d of [dev, dev1]) { frac(d.choice.clean / d.devCount); frac(d.choice.noisy / d.devCount); forms.add(String(d.devCount)); }
  const visible = html.replace(/<style>[\s\S]*?<\/style>/, '');   // the words and markup a reader is served, not the CSS
  for (const s of forms) assert.equal(visible.includes(s), false, 'the page has "' + s + '" typed in; it must come from the record');
  assert.match(app, /pct\(j\.accuracy\.clean\)/, 'the numbers are rendered from the record');
});

test('the failures are told: a failed claim is shown as FAILED and kept', () => {
  assert.match(app, /pass \? 'HELD' : 'FAILED'/);
  assert.match(app, /Failed and kept: /);
  assert.match(app, /Each failure is kept on the record and on this page\./);
  assert.match(html, /A claim that misses its bar is kept and shown as failed\./);
  assert.match(html, /<a href="AMENDMENT\.md">AMENDMENT\.md<\/a>/);
});

test('the page talks only to itself, explains itself, and carries its credits', () => {
  assert.match(html, /connect-src 'self'/);
  assert.match(html, /default-src 'self'/);
  for (const id of ['result', 'watch', 'cell', 'rerun', 'what', 'start', 'how', 'blueprint', 'adoption', 'paper', 'business']) assert.match(html, new RegExp('<section id="' + id + '"'), id);
  assert.match(html, /Alpaydin, E\., & Kaynak, C\. \(1998\)\. Optical Recognition of Handwritten Digits\. UCI Machine Learning Repository, DOI 10\.24432\/C50P49, CC BY 4\.0\./);
  assert.match(html, /Krotov &amp; Hopfield \(2016\), "Dense Associative Memory for Pattern Recognition"/);
  assert.match(html, /Hopfield \(1982\)/);
  assert.match(html, /Powered by the Konomi architecture, created by Thomas Frumkin/);
  assert.equal(/£\s?\d|\$\s?\d|per seat|\/mo\b/i.test(html), false, 'no price of ours on the page');
  assert.equal(/<video|<iframe/i.test(html), false);
});
