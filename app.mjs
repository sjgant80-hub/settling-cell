// app.mjs — the page's glue. Every number on the page is read from the committed record, the dev tables or the gate
// receipts, or computed in this tab (claim T10: none is typed into index.html). The cell itself runs in worker.mjs.
import { mintCase, sourcesOf } from './vendor/liveware/mintcase.mjs';

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(props)) if (k === 'class') e.className = v; else e.setAttribute(k, v); for (const c of kids) e.append(c); return e; };
const json = (p) => fetch(p).then((r) => (r.ok ? r.json() : null)).catch(() => null);
const pct = (x) => (x * 100).toFixed(1) + '%';
const pts = (x) => (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x * 100).toFixed(2) + ' points';
const big = (n) => Number(n).toLocaleString('en-GB');
const chip = (pass) => el('span', { class: 'chip ' + (pass ? 'win' : 'bad') }, pass ? 'HELD' : 'FAILED');
const vf0 = (v, id) => v.find((x) => x.id === id) || {};

let REC = null, DEV = null, DEV1 = null, GATES = [], BASIS = null;

const PLAIN = {
  T1: 'Reads unseen handwriting: clean accuracy', T2: 'Close to the strong reference: 1-NN over every training digit', T3: 'Beats the weak baseline: the nearest class centroid',
  T5: 'It settles: always stops, every flip downhill', T6a: 'Holds at 10% noise', T6b: 'Holds at 25% noise', T7: 'Settling beats reading the same shape in one step',
  T8: 'Settling cleans a noisy digit', T9: 'Non-fit is measurable: real digits fit, scrambled ones do not',
};
function shown(v) {
  const m = v.measured;
  switch (v.id) {
    case 'T1': return [pct(m), '≥ 95.0%'];
    case 'T2': return [pts(m) + ' (lower bound)', '> −1.5 points'];
    case 'T3': return [pts(m) + ' (lower bound)', '> 0'];
    case 'T5': return [REC.judged.settle.maxSweeps + ' sweeps at most; ' + (REC.judged.settle.allSettled ? 'every settle stopped' : 'NOT every settle stopped') + '; ' + (REC.judged.settle.honest ? 'every flip lowered the energy' : 'an energy check FAILED'), '≤ 12 sweeps'];
    case 'T6a': return [(m * 100).toFixed(2) + ' points lost', '≤ 2.0 points lost'];
    case 'T6b': return [(m * 100).toFixed(2) + ' points lost', '≤ 8.0 points lost'];
    case 'T7': return [pts(m[0]) + ' at 25% noise; ' + pts(m[1]) + ' clean (lower bounds)', '> 0 at 25% noise and > −0.5 points clean'];
    case 'T8': return [pct(m) + ' of digits', '≥ 70%'];
    case 'T9': return [m.toFixed(4) + ' AUC', '≥ 0.98'];
    default: return [JSON.stringify(m), v.bar];
  }
}

function fillResult() {
  const j = REC.judged, v = REC.verdicts, held = v.filter((x) => x.pass), failed = v.filter((x) => !x.pass);
  const gate = GATES.find((g) => g.kernel === 'src/cell.mjs');
  $('verdictline').textContent = held.length + ' of ' + v.length + ' measured claims held on the ' + big(j.testCount) + ' unseen test digits' +
    (failed.length ? '. Failed and kept: ' + failed.map((x) => x.id + ' (' + PLAIN[x.id].charAt(0).toLowerCase() + PLAIN[x.id].slice(1) + ')').join('; ') + '.' : '.') +
    ' Clean accuracy ' + pct(j.accuracy.clean) + '; ' + pct(j.accuracy.n25) + ' with a quarter of the pixels replaced.';
  const tb = $('claims').querySelector('tbody'); tb.replaceChildren();
  for (const x of v) { const [m, bar] = shown(x); tb.append(el('tr', {}, el('td', { class: 'num' }, el('b', {}, x.id)), el('td', {}, PLAIN[x.id]), el('td', {}, m), el('td', { class: 'num' }, bar), el('td', {}, chip(x.pass)))); }
  tb.append(el('tr', {}, el('td', {}, el('b', {}, 'T4')), el('td', {}, 'Deterministic: one hash for the whole record, in CI and in your tab'), el('td', { class: 'num' }, j.hash.slice(0, 16) + '…'), el('td', {}, 'the same hash everywhere'), el('td', {}, el('span', { class: 'chip win' }, 'CI'), ' ', el('a', { href: '#rerun' }, 'check it here'))));
  tb.append(el('tr', {}, el('td', {}, el('b', {}, 'T10')), el('td', {}, 'No measured number typed into this page'), el('td', {}, 'checked by test/page.test.mjs'), el('td', {}, 'none'), el('td', {}, el('span', { class: 'chip win' }, 'CI'))));
  tb.append(el('tr', {}, el('td', {}, el('b', {}, 'T11')), el('td', {}, 'Both UCI files byte-identical to the sealed hashes'), el('td', {}, 'checked by test/page.test.mjs'), el('td', {}, 'SHA-256 equal'), el('td', {}, el('span', { class: 'chip win' }, 'CI'))));
  if (gate) tb.append(el('tr', {}, el('td', {}, el('b', {}, 'G')), el('td', {}, 'The kernel is mutation-gated'), el('td', { class: 'num' }, gate.killed + ' of ' + gate.total + ' mutants caught, ' + gate.ignored + ' baselined'), el('td', {}, 'clean, nothing baselined'), el('td', {}, chip(gate.clean && gate.ignored === 0))));
  const o = REC.originalGrid, s = (r) => 'b=' + r.settings.b + ', k=' + r.settings.k + ', R=' + r.settings.R + ', n=' + r.settings.n;
  const rows = [['Settings', s(j), s(o)], ['Patterns stored', big(j.settings.M), big(o.settings.M)], ['Clean accuracy', pct(j.accuracy.clean), pct(o.accuracy.clean)],
    ['10% of pixels replaced', pct(j.accuracy.n10), pct(o.accuracy.n10)], ['25% of pixels replaced', pct(j.accuracy.n25), pct(o.accuracy.n25)],
    ['Same shape, read in one step: clean', pct(j.oneStep.clean), pct(o.oneStep.clean)], ['Same shape, read in one step: 25% noise', pct(j.oneStep.n25), pct(o.oneStep.n25)],
    ['Digits the settle moved closer to clean (25% noise)', pct(j.cleaner), pct(o.cleaner)], ['Non-fit AUC, real vs scrambled', j.nonFitAuc.toFixed(4), o.nonFitAuc.toFixed(4)],
    ['Longest settle', j.settle.maxSweeps + ' sweeps', o.settle.maxSweeps + ' sweeps'], ['Mean flips per clean digit', j.settle.meanFlips.clean.toFixed(1), o.settle.meanFlips.clean.toFixed(1)],
    ['Claims held', REC.verdicts.filter((x) => x.pass).length + ' of ' + REC.verdicts.length, REC.originalGridVerdicts.filter((x) => x.pass).length + ' of ' + REC.originalGridVerdicts.length]];
  $('cells').querySelector('tbody').replaceChildren(...rows.map(([a, b, c]) => el('tr', {}, el('td', {}, a), el('td', { class: 'num' }, b), el('td', { class: 'num' }, c))));
  $('refs').replaceChildren(
    el('div', { class: 'card' }, el('div', { class: 'k' }, 'Strong reference'), el('div', { class: 'big' }, pct(j.nn1)), el('div', { class: 'vs' }, '1-nearest-neighbour over all ' + big(j.trainCount) + ' training digits, on the same bits. The cell keeps ' + big(j.settings.M) + ' patterns.')),
    el('div', { class: 'card' }, el('div', { class: 'k' }, 'Weak baseline'), el('div', { class: 'big' }, pct(j.centroid)), el('div', { class: 'vs' }, 'the nearest class centroid: one bitwise-majority pattern per digit.')),
    el('div', { class: 'card' }, el('div', { class: 'k' }, 'From the dataset\'s own notes'), el('div', { class: 'big' }, '98.00%'), el('div', { class: 'vs' }, 'what the dataset\'s authors report for 1-NN on the raw 0..16 features. Context, not a claim.')));
  const gap = j.nn1 - j.oneStep.clean, cost = j.oneStep.clean - j.accuracy.clean, costN = j.oneStep.n25 - j.accuracy.n25;
  $('lesson').textContent = 'The same ' + big(j.settings.M) + ' patterns read in one step, without settling, score ' + pct(j.oneStep.clean) + ' clean: ' +
    (gap > 0 ? Math.abs(gap * 100).toFixed(1) + ' points under' : Math.abs(gap * 100).toFixed(1) + ' points over') + ' 1-NN over all ' + big(j.trainCount) + ' training digits, while keeping ' + pct(j.settings.M / j.trainCount) + ' of them. ' +
    (cost > 0 ? 'Settling, as built here, costs ' + (cost * 100).toFixed(1) + ' points against that clean and ' + (costN * 100).toFixed(1) + ' points at 25% noise: when the bit-by-bit descent changes an answer, it changes it for the worse more often than for the better. '
      : 'Settling, as built here, adds ' + (-cost * 100).toFixed(1) + ' points against that clean. ') +
    'So Rung 1 shows a network can read unseen handwriting by settling (' + pct(j.accuracy.clean) + ', the same bits every time, robust to noise, with a fit that tells real digits from scrambled ones at AUC ' + j.nonFitAuc.toFixed(4) + '), ' +
    (vf0(v, 'T7').pass ? 'and that settling beats reading the same shape directly.' : 'but not that settling beats reading the same shape directly. Making the settle earn its keep is the job of Rung 2: code that changes the stored patterns itself, keeps a change only when a fresh exam improves, and uses no model at all.') +
    ' (The one-step readout is a comparison, not a sealed claim.)';
  const ul = $('results'); ul.replaceChildren();
  const li = (t) => ul.append(el('li', {}, t));
  const vf = (id) => v.find((x) => x.id === id);
  li('Clean, on ' + big(j.testCount) + ' digits from 13 writers it never saw: ' + pct(j.accuracy.clean) + ' (T1 ' + (vf('T1').pass ? 'held' : 'FAILED, kept') + '). 1-NN over every training digit on the same bits: ' + pct(j.nn1) + '; the lower bound of the cell\'s gap to it is ' + pts(j.lows.T2) + ' (T2 ' + (vf('T2').pass ? 'held' : 'FAILED, kept') + ').');
  li('With 10% and 25% of the pixels replaced: ' + pct(j.accuracy.n10) + ' and ' + pct(j.accuracy.n25) + ' (T6a ' + (vf('T6a').pass ? 'held' : 'FAILED') + ', T6b ' + (vf('T6b').pass ? 'held' : 'FAILED') + ').');
  li('Settling against reading the same shape in one step: clean ' + pct(j.accuracy.clean) + ' vs ' + pct(j.oneStep.clean) + '; at 25% noise ' + pct(j.accuracy.n25) + ' vs ' + pct(j.oneStep.n25) + ' (T7 ' + (vf('T7').pass ? 'held' : 'FAILED, kept') + ').');
  li('The settle moved ' + pct(j.cleaner) + ' of the 25%-noise digits closer to the clean digit (T8 ' + (vf('T8').pass ? 'held' : 'FAILED, kept') + '). Real digits against their scrambled copies, by settled fit: AUC ' + j.nonFitAuc.toFixed(4) + ' (T9 ' + (vf('T9').pass ? 'held' : 'FAILED, kept') + ').');
  li('The cell the original grid chose: ' + pct(o.accuracy.clean) + ' clean, ' + pct(o.accuracy.n25) + ' at 25% noise. That is the gap the amendment closed.');
  if (gate) li('Mutation gate on the kernel: ' + gate.killed + ' of ' + gate.total + ' deliberately broken copies caught by the tests, ' + gate.ignored + ' baselined.');
  $('faq-unseen').textContent = 'That is the whole test: ' + big(j.testCount) + ' digits from 13 people who wrote none of the ' + big(j.trainCount) + ' training digits. Clean, it read ' + pct(j.accuracy.clean) + ' of them; with a quarter of the pixels replaced at random, ' + pct(j.accuracy.n25) + '.';
  $('faq-fit').textContent = 'How deeply the input settled into what the cell knows. Take one real test digit and one test digit with its ink scrambled into the wrong places, both at random: the real one has the higher fit ' + pct(j.nonFitAuc) + ' of the time (AUC ' + j.nonFitAuc.toFixed(4) + '). So a very low fit marks an input unlike any digit the cell knows: a case to send to a person. Only scrambled digits were tested; other kinds of junk were not.';
  $('faq-failed').textContent = failed.length ? failed.map((x) => x.id + ': ' + PLAIN[x.id] + ', measured ' + shown(x)[0] + ' against a bar of ' + shown(x)[1] + '.').join(' ') + ' Each failure is kept on the record and on this page.' : 'Nothing measured failed its bar on this run.';
}

function fillDev() {
  const D = DEV1.devCount, p = (r) => pct(r.clean / D), q = (r) => pct(r.noisy / D);
  const find = (T, o) => T.rows.find((r) => r.ok && Object.entries(o).every(([k, v]) => r[k] === v));
  const s1 = DEV1.choice, soft = find(DEV1, { b: 4, k: 40, R: 64, n: 4 }), narrow = find(DEV1, { b: 1, k: 40, R: 8, n: 4 }), pick = DEV.choice;
  const label = (r) => 'b=' + r.b + ', k=' + r.k + ', R=' + r.R + ', n=' + r.n;
  const rows = [[s1, 'seal 1\'s grid chose this'], [soft, 'a soft energy and many patterns: the settle slides into a mixture of digits'], [narrow, 'a very short reach: clean digits work, noisy ones find nothing to settle into'], [pick, 'the amended grid chose this: the judged cell']].filter(([r]) => r);
  $('devtable').querySelector('tbody').replaceChildren(...rows.map(([r, note]) => el('tr', {}, el('td', { class: 'num' }, label(r)), el('td', { class: 'num' }, p(r)), el('td', { class: 'num' }, q(r)), el('td', {}, note))));
  $('sharpnote').textContent = 'Settings were chosen on ' + big(D) + ' dev digits carved from the training file. With the powers seal 1 allowed (up to ' + Math.max(...DEV1.grid.n) + '), the best the cell could do on dev was ' + p(s1) + ' clean. A soft energy lets many moderately close patterns outweigh the nearest one. The amended grid allowed sharper powers, up to ' + Math.max(...DEV.grid.n) + ', and the sealed rule picked ' + label(pick) + ' at ' + p(pick) + ' clean and ' + q(pick) + ' at 25% noise on dev.';
}

function fillBlueprint() {
  const g = (k) => GATES.find((x) => x.kernel === k);
  const gl = (k) => { const x = g(k); return x ? 'mutation gate ' + x.killed + '/' + x.total + ', ' + x.ignored + ' baselined' : 'tested in CI'; };
  const parts = [
    ['src/cell.mjs', 'The cell: the thermometer code, the deterministic k-modes growth, the whole-number energy, the settle, the answer and fit, seeded noise and scrambling, the paired bootstrap.', gl('src/cell.mjs')],
    ['src/dev.mjs', 'Choosing the settings on the training file only: the sealed split, the grid, the score and the tie rules, then growing the winner on all training digits.', gl('src/dev.mjs') + '; CI re-derives both dev tables byte for byte'],
    ['src/run.mjs', 'The held-out test: every condition, the baselines, the record and its hash, and every claim judged against its sealed bar.', gl('src/run.mjs') + '; CI re-derives the record byte for byte'],
    ['data/', 'The two UCI files (pinned by SHA-256 in seal 1), both dev tables, both frozen cells, and the record.', 'tools/run.mjs refuses to run unless seal 2 names the cell'],
    ['worker.mjs + app.mjs', 'The page: a worker runs the cell so the page never freezes; the glue fills every number from the committed files.', 'no measured number typed into the page (CI checks)'],
    ['vendor/', 'The estate\'s seed-library rng, AUC and SHA-256 (from living-seed) and Liveware\'s cost-case kernel and sourced basis, byte for byte.', 'pinned in vendor/SOURCES.json'],
  ];
  $('parts').replaceChildren(...parts.map(([h, t, gtxt]) => el('div', { class: 'card' }, el('div', { class: 'k' }, h), el('p', { style: 'font-size:14.5px;margin-top:4px' }, t), el('p', { class: 'vs', style: 'margin-top:6px;color:var(--accent)' }, gtxt))));
  const steps = [['Seal 1', 'CLAIMS.md alone, before any code: every bar, the dev protocol, the seeds, and the test file\'s hash.'],
    ['Dev, first grid', 'Run on the training file only. The energy was too soft (data/dev-v1.json, kept).'],
    ['Amendment 1', 'Before the test file: sharper powers allowed, no bar moved (AMENDMENT.md).'],
    ['Dev, amended grid', 'The sealed rule picked the cell (data/dev.json).'],
    ['Seal 2', 'The frozen cell named by hash before the test file entered the repository (SEAL2.md): ' + REC.judged.cellHash.slice(0, 16) + '…'],
    ['The test, once', 'The test file added and read once for both cells (data/record.json).']];
  $('timeline').replaceChildren(...steps.map(([a, b]) => el('li', {}, el('b', {}, a), ' · ', b)));
}

// ── the cell, through the worker ──
let worker = null, seq = 0;
function ask(msg) {
  if (!worker) worker = new Worker(new URL('./worker.mjs', import.meta.url), { type: 'module' });
  return new Promise((resolve) => { const id = ++seq; const on = (e) => { if (e.data.id === id) { worker.removeEventListener('message', on); resolve(e.data); } }; worker.addEventListener('message', on); worker.postMessage({ ...msg, id }); });
}
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
function mix(a, b, t) {
  const h = (s) => { const x = s.replace('#', ''); return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16)); };
  const [p, q] = [h(a), h(b)];
  return 'rgb(' + p.map((v, i) => Math.round(v + (q[i] - v) * t)).join(',') + ')';
}
function draw(canvas, levels, b) {
  const g = canvas.getContext('2d'), c0 = css('--px0') || '#ffffff', c1 = css('--px1') || '#1d1c1a';
  for (let p = 0; p !== 64; p++) { g.fillStyle = mix(c0, c1, levels[p] / b); g.fillRect(p % 8, Math.floor(p / 8), 1, 1); }
}

let D = null, timer = null, row = 0;
function renderStep(k) {
  const st = D.steps[k], max = Math.max(1, ...D.steps.flatMap((s) => s.classes));
  const lead = st.classes.reduce((bi, v, i, a) => (v > a[bi] ? i : bi), 0), total = st.classes.reduce((s, v) => s + v, 0);
  $('fits').replaceChildren(...st.classes.flatMap((v, i) => [el('span', {}, String(i)), el('div', { class: 'bar' + (total && i === lead ? ' win' : '') }, (() => { const x = el('i'); x.style.width = (100 * v / max).toFixed(1) + '%'; return x; })()),
    el('span', { class: 'num' }, total ? Math.round((100 * v) / total) + '% of the fit' : 'no fit')]));
  return st;
}
function show() {
  clearInterval(timer);
  const levels = D.start.slice();
  draw($('digit'), levels, D.b);
  renderStep(0);
  const what = D.cond === 'scrambled' ? 'the digit before scrambling was ' : 'the writer wrote ';
  $('readout').textContent = 'Test digit ' + big(D.row) + ' of ' + big(D.count) + ': ' + what + D.truth + '. Press Settle.';
  $('readout2').textContent = '';
}
async function another() {
  row = Math.floor(Math.random() * (D ? D.count : 1));
  await load();
}
async function load() {
  $('readout').textContent = 'reading…';
  const r = await ask({ do: 'digit', row, cond: $('cond').value });
  if (!r.ok) { $('readout').textContent = 'it did not load: ' + r.why; return; }
  D = r; row = r.row;
  show();
}
function settle() {
  if (!D) return;
  clearInterval(timer);
  const levels = D.start.slice(), on = D.startBits.slice();
  let k = 0;
  const finish = () => {
    clearInterval(timer);
    const st = renderStep(D.steps.length - 1);
    const verdict = D.answer < 0 ? 'no answer: nothing it knows fits this' : 'it settled on ' + D.answer + (D.cond === 'scrambled' ? '' : D.answer === D.truth ? ' ✓ right' : ' ✗ wrong');
    $('readout').textContent = (D.cond === 'scrambled' ? 'Scrambled from a ' : 'The writer wrote ') + D.truth + '; ' + verdict + '.';
    const sweeps = D.sweeps === 1 ? '1 sweep, which found nothing to flip' : D.sweeps + ' sweeps (the last found nothing to flip)';
    $('readout2').textContent = big(D.flips) + (D.flips === 1 ? ' flip' : ' flips') + ' over ' + sweeps + ' · total fit ' + big(st.fit) + ' · read in one step instead, the same shape says ' + (D.oneStep < 0 ? 'nothing' : D.oneStep) + '.';
  };
  draw($('digit'), levels, D.b);
  if (!D.path.length) { finish(); return; }
  timer = setInterval(() => {
    const i = D.path[k], p = Math.floor(i / D.b);
    on[i] ^= 1; levels[p] += on[i] ? 1 : -1;
    k++;
    draw($('digit'), levels, D.b);
    renderStep(k);
    $('readout2').textContent = 'flip ' + k + ' of ' + D.path.length;
    if (k >= D.path.length) finish();
  }, Math.max(12, Math.min(60, 1800 / D.path.length)));
}

async function fillCell() {
  const r = await ask({ do: 'shape' });
  if (!r.ok) { $('cellnote').textContent = 'The cell did not load: ' + r.why; return; }
  $('cellnote').textContent = 'These ' + big(r.mem.length) + ' patterns, ' + r.k + ' per digit and ' + big(r.N) + ' bits each, are everything the cell knows: the frozen cell file is ' + big(r.bytes) + ' bytes, settings included (reach R=' + r.R + ', power n=' + r.n + '). Each is the bitwise majority of one cluster of training digits.';
  $('memories').replaceChildren(...r.mem.map((levels, i) => { const c = el('canvas', { width: '8', height: '8', 'aria-label': 'a stored ' + r.cls[i] }); draw(c, levels, r.b); return el('figure', {}, c, el('figcaption', {}, String(r.cls[i]))); }));
}

$('go').onclick = async () => {
  $('go').disabled = true; $('gostatus').textContent = 'loading both data files and the cell, re-growing it, settling every test digit four ways…';
  const r = await ask({ do: 'rerun' });
  $('go').disabled = false;
  if (!r.ok) { $('gostatus').textContent = 'it did not run: ' + r.why; return; }
  const a = r.record, b = REC.judged;
  const rows = [['the cell re-grown from the training file is the frozen one', String(a.regrown), String(b.regrown)], ['clean accuracy', a.accuracy.clean, b.accuracy.clean], ['10% noise', a.accuracy.n10, b.accuracy.n10], ['25% noise', a.accuracy.n25, b.accuracy.n25],
    ['1-NN reference', a.nn1, b.nn1], ['non-fit AUC', a.nonFitAuc, b.nonFitAuc], ['settles hashed', a.settles, b.settles], ['the hash of the whole record', a.hash, b.hash]];
  const tb = $('proof').querySelector('tbody'); tb.replaceChildren();
  let all = true;
  for (const [w, x, y] of rows) { const same = x === y; all = all && same; tb.append(el('tr', {}, el('td', {}, w), el('td', { class: 'num' }, String(x).slice(0, 24)), el('td', { class: 'num' }, String(y).slice(0, 24)), el('td', { class: same ? 'ok' : 'no' }, same ? '✓ same' : '✗ differs'))); }
  $('proof').hidden = false;
  $('gostatus').textContent = (all ? '✓ your tab reproduced the record, hash and all' : '✗ your tab differs from the record') + ' · ' + big(a.settles) + ' settles in ' + (r.ms / 1000).toFixed(1) + ' s';
};
$('another').onclick = another;
$('cond').onchange = load;
$('settle').onclick = settle;

// ── the cost case (Liveware's kernel, the sourced basis) ──
const gbp = (x) => '£' + Math.round(x).toLocaleString('en-GB');
function renderCost() {
  if (!BASIS) { $('c-head').textContent = 'The sourced basis did not load; reload the page.'; return; }
  const v = (id) => Number($(id).value);
  const r = mintCase(BASIS, { hoursPerWeek: v('c-hours'), share: v('c-share') / 100, seats: v('c-seats'), casesPerWeek: v('c-cases'), years: v('c-years') });
  if (!r.ok) { $('c-head').textContent = 'Check the inputs: ' + r.why + '.'; return; }
  const yrs = r.inputs.years + (r.inputs.years === 1 ? ' year' : ' years');
  $('c-overh').textContent = 'Over ' + yrs;
  $('c-head').textContent = `This process costs you ${gbp(r.perYear.today)} a year in staff time today. Owning it: ${gbp(r.perYear.own)} a year, which is ${gbp(r.savingPerYear)} a year back and ${gbp(r.savingOver)} over ${yrs}.`;
  const rows = [['Today', 'Your team does all of it.', 'today'], ['Rent AI assistant seats', `Microsoft 365 Copilot for ${r.inputs.seats} people (${gbp(r.lines.seats)} a year). It helps each person; the work, and the staff time, stay.`, 'rentSeats'],
    ['Call a cloud AI on every case', `Takes the same share off, billed per case at Claude Sonnet 5 API rates (${gbp(r.lines.api)} a year at your volume), and every case leaves your building.`, 'cloudApi'],
    ['Own it', `Takes the same share off on a machine you already have, for about ${gbp(r.lines.power)} a year of electricity. No seats, no meter, nothing leaves.`, 'own']];
  const tb = $('c-table').querySelector('tbody'); tb.replaceChildren();
  for (const [a, b, k] of rows) tb.append(el('tr', {}, el('td', {}, el('b', {}, a)), el('td', {}, b), el('td', { class: 'num' }, gbp(r.perYear[k])), el('td', { class: 'num' }, gbp(r.over[k]))));
  $('c-note').textContent = `Owning beats the cloud route by ${gbp(r.versusCloudOver)} over ${yrs} at this volume. Staff time is a floor: the UK median wage, with on-costs left out.`;
  $('c-board').textContent = `A small owned cell read real handwriting from people it never saw, with every failure published. Pick one narrow recognition or sorting step your people do by hand. Today it costs ${gbp(r.perYear.today)} a year in staff time. If an owned cell takes off the share you estimate, that is ${gbp(r.savingPerYear)} a year back, on hardware you already have, with nothing leaving the building, and the fee is due only on a receipt that it beat your current way on your own data.`;
}

async function main() {
  [REC, DEV, DEV1, BASIS] = await Promise.all(['data/record.json', 'data/dev.json', 'data/dev-v1.json', 'vendor/liveware/basis.json'].map(json));
  GATES = (await Promise.all(['receipts/gate-cell.json', 'receipts/gate-dev.json', 'receipts/gate-run.json'].map(json))).filter(Boolean);
  $('c-src').replaceChildren(...sourcesOf(BASIS || {}).map((s) => { const li = el('li', {}, s.what + (s.source ? ': ' : '')); if (s.source) { const a = el('a', { href: s.source, target: '_blank', rel: 'noopener' }); try { a.textContent = new URL(s.source).hostname; } catch { a.textContent = s.source; } li.append(a); } return li; }));
  for (const id of ['c-hours', 'c-share', 'c-seats', 'c-cases', 'c-years']) $(id).addEventListener('input', renderCost);
  renderCost();
  if (!REC || !DEV || !DEV1) { $('verdictline').textContent = 'The record did not load; reload the page.'; return; }
  fillResult(); fillDev(); fillBlueprint();
  fillCell();
  row = 0;
  await load();
}
main();
