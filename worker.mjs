// worker.mjs — the cell, off the page's thread. It loads the committed files from this site and answers:
//   'rerun'  → src/run.mjs's evaluate on the judged cell: the whole held-out record and its hash (claims T4, T10)
//   'digit'  → one test digit in one condition, settled with its path, and the fit and class fits after every flip
//   'shape'  → the frozen cell's patterns, for drawing
import C from './src/cell.mjs';
import { evaluate, pixelsFor } from './src/run.mjs';

const D = new URL('./data/', import.meta.url);
let texts = null, frozen = null, tes = null;
async function load() {
  if (texts) return texts;
  const get = (p) => fetch(new URL(p, D)).then((r) => { if (!r.ok) throw new Error(p + ' answered ' + r.status); return r.text(); });
  const [traText, tesText, cellText] = await Promise.all([get('optdigits.tra'), get('optdigits.tes'), get('cell.txt')]);
  texts = { traText, tesText, cellText };
  return texts;
}
function ready() {
  if (frozen) return;
  const f = C.parseCell(texts.cellText);
  if (!f) throw new Error('the frozen cell did not parse');
  frozen = { ...f, c: C.cell(f.shape, { R: f.R, n: f.n }) };
  tes = C.parse(texts.tesText);
}

self.onmessage = async (m) => {
  const q = m.data || {};
  try {
    await load();
    if (q.do === 'rerun') {
      const t = performance.now();
      const record = evaluate(texts);
      self.postMessage({ id: q.id, ok: !!record, record, ms: Math.round(performance.now() - t), why: record ? '' : 'the record did not compute' });
      return;
    }
    ready();
    const { c, shape } = frozen, b = shape.b;
    if (q.do === 'shape') {
      self.postMessage({ id: q.id, ok: true, b, N: shape.N, k: shape.k, R: frozen.R, n: frozen.n, cls: shape.cls, mem: shape.mem.map((x) => C.inkOf(x, b)), bytes: C.cellText(shape, frozen.R, frozen.n).length });
      return;
    }
    if (q.do === 'digit') {
      const row = (q.row >>> 0) % tes.x.length, cond = ['clean', 'n10', 'n25', 'scrambled'].includes(q.cond) ? q.cond : 'clean';
      const px = pixelsFor(tes.x[row], cond, row), bits = C.encode(px, b);
      const st = C.settle(c, bits, { trace: true });
      const s = Uint8Array.from(bits), d = C.distances(c, s);
      const steps = [{ fit: C.energyOf(c, d), classes: C.classFit(c, d) }];
      for (const i of st.path) {
        const si = s[i];
        s[i] = si ^ 1;
        for (let k = 0; k !== c.M; k++) d[k] += c.memT[i * c.M + k] === si ? 1 : -1;
        steps.push({ fit: C.energyOf(c, d), classes: C.classFit(c, d) });
      }
      self.postMessage({ id: q.id, ok: true, row, cond, truth: tes.y[row], b, start: C.inkOf(bits, b), startBits: Array.from(bits), path: st.path, steps, answer: st.answer, oneStep: C.readout(c, bits).answer, flips: st.flips, sweeps: st.sweeps, count: tes.x.length });
      return;
    }
    self.postMessage({ id: q.id, ok: false, why: 'unknown request' });
  } catch (e) { self.postMessage({ id: q.id, ok: false, why: String((e && e.message) || e).slice(0, 200) }); }
};
