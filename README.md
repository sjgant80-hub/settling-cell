# Settling cell

Live: **https://sjgant80-hub.github.io/settling-cell/**

Rung 1 of the geometric ladder: **a network computes a real task by settling, deterministically, robust to noise,
proven on held-out data.** A handwritten digit becomes 256 bits; the bits flip one at a time, each flip strictly lowering
an energy shaped by 200 stored patterns, until nothing moves; the class whose patterns hold the resting state is the
answer. Whole numbers only, so the same digit settles to the same bits on any engine.

## The result (tested once on 1,797 digits from 13 writers it never saw)

5 of the 9 measured claims held; 4 failed and are kept:

| | claim | measured | bar |
|---|---|---|---|
| ✗ | T1 clean accuracy | 94.49% | ≥ 95.0% |
| ✗ | T2 against 1-NN over all 3,823 training digits (96.66%) | lower bound −3.17 points | > −1.5 points |
| ✓ | T3 beats the nearest class centroid (87.37%) | lower bound +5.68 points | > 0 |
| ✓ | T5 every settle stops, every flip downhill | ≤ 8 sweeps | ≤ 12 |
| ✓ | T6 holds under noise | −1.73 points at 10%, −6.07 at 25% | ≤ 2.0, ≤ 8.0 |
| ✗ | T7 settling beats reading the same shape in one step | lower bounds −1.78 (25% noise), −2.67 (clean) | > 0, > −0.5 |
| ✗ | T8 settling cleans a noisy digit | 66.4% | ≥ 70% |
| ✓ | T9 non-fit is measurable (real vs scrambled digits) | AUC 0.9986 | ≥ 0.98 |

The plain lesson: the same 200 patterns read in one step score 96.27%, within 0.4 points of 1-NN while keeping 5% of
the training digits. Settling, as built here, costs accuracy against that. Rung 1 shows the task can be done by
settling; it does not yet show settling earns its keep. That is what Rung 2 has to win.

## How it was kept honest

1. [`CLAIMS.md`](CLAIMS.md), seal 1 (ed3e7f5): every claim and bar, the dev protocol and seeds, the test file's hash,
   before any code.
2. Dev on the training file only. The sealed grid's energies were too soft (`data/dev-v1.json`, kept).
3. [`AMENDMENT.md`](AMENDMENT.md) (2ecb01a): sharper powers allowed, before the test file was read; no bar moved.
4. [`SEAL2.md`](SEAL2.md) (9574e19): the chosen cell, the dev tables and the code frozen by hash; the test file not yet
   in the repo.
5. The test file added and read once, for the judged cell and the original-grid cell (`data/record.json`).

## Re-derive it

```bash
node --test test/cell.test.mjs test/run.test.mjs test/page.test.mjs
node tools/dev.mjs --check
node tools/run.mjs --check
```

CI runs all three plus witness v0.6 on `src/cell.mjs`, `src/dev.mjs` and `src/run.mjs` (113/113, 11/11, 39/39 caught,
nothing baselined). The live page re-runs the held-out test in your browser and reproduces the record's hash.

Data: Alpaydin, E., & Kaynak, C. (1998). Optical Recognition of Handwritten Digits. UCI Machine Learning Repository,
DOI 10.24432/C50P49, CC BY 4.0. Energy after Hopfield (1982) and Krotov & Hopfield (2016). Powered by the Konomi
architecture, created by Thomas Frumkin. MIT licence; credits in [`NOTICE`](NOTICE).
