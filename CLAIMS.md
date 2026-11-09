# settling-cell · sealed claims (seal 1, before any code)

Rung 1 of the geometric substrate ladder: **a network computes a real task by settling; deterministic,
robust to noise; proven on held-out.** This file is committed on its own, before a line of code exists.
Every bar below is fixed here. A claim that misses its bar is kept and published as failed, never
re-worded and never re-run until it passes.

## The task and the data

- **Task:** read a handwritten digit (0–9).
- **Data:** UCI *Optical Recognition of Handwritten Digits* (E. Alpaydin, C. Kaynak, 1998; CC BY 4.0;
  DOI 10.24432/C50P49). Each digit is an 8×8 grid of ink counts, 0..16.
  - `optdigits.tra`: 3,823 digits written by 30 people. sha256 `e1b683cc211604fe8fd8c4417e6a69f31380e0c61d4af22e93cc21e9257ffedd`
  - `optdigits.tes`: 1,797 digits written by 13 *different* people. sha256 `6ebb3d2fee246a4e99363262ddf8a00a3c41bee6014c373ed9d9216ba7f651b8`
  - Archive as downloaded: sha256 `0d7b054fea010270e9b3f06411c654c5e59547732ad626381980baffe0a23fb0`
- **Held-out rule:** the cell is grown only from `optdigits.tra`. `optdigits.tes` is not in this
  repository until the grown cell is frozen and its hash sealed (seal 2). It is then read once.
- **Context, not a claim:** the dataset's authors report 98.00% for 1-nearest-neighbour on the raw
  features of the same test set.

## The cell (what "settling" means here)

- **Bits.** Each pixel becomes b bits by a thermometer code: b=1 at {8}; b=2 at {5, 11};
  b=4 at {2, 6, 10, 14} (bit on when the ink count is at least the threshold). A digit is N = 64·b bits.
- **Shape.** For each digit class, k stored patterns ("memories"), grown from that class's training
  digits by deterministic Hamming k-modes: start from the class member nearest the class's bitwise
  majority, add the member farthest from those already chosen until there are k, then alternate
  assign-to-nearest and bitwise-majority for at most 25 rounds. Every tie goes to the lowest index.
- **Energy.** E(σ) = −Σ over memories of max(R − d(σ, memory), 0)^n, where d is Hamming distance.
  Whole numbers only.
- **Settling.** Start at the digit's bits. Sweep bits 0..N−1 in order and flip a bit only if that
  strictly lowers E. Stop after a sweep with no flip. Every flip lowers E, so it must stop.
- **Answer.** The class whose memories hold the most fit at the settled state (Σ of max(R−d,0)^n over
  that class); a tie goes to the lowest class. Zero fit means no answer, and no answer counts as wrong.
- **Fit** = −E at the settled state. **One-step readout** = the same answer rule applied to the
  unsettled input (used only by T7).

## Choosing the settings (dev, on the training file only)

- Dev split: training rows whose index (0-based) mod 4 = 3 are dev; the cell grows on the rest.
- Grid: b ∈ {1, 2, 4}; k ∈ {5, 10, 20, 40}; R ∈ {⌊N/8⌋, ⌊N/4⌋, ⌊3N/8⌋}; n ∈ {2, 3, 4}.
- Score: the mean of dev accuracy clean and dev accuracy at 25% noise. Ties: smaller N·k, then smaller
  n, then smaller R.
- The chosen settings are then grown on all 3,823 training digits. That shape, its hash and the whole
  dev table are sealed (seal 2) before the test file is added.

## Fixed seeds and noise

- Noise at p of 64 pixels: 10% = 6 pixels, 25% = 16 pixels. Positions drawn without replacement and each
  replaced by a whole number drawn uniformly from 0..16. The rng is the estate's mulberry32 (seed-library
  `rng`), seeded 2026 + the digit's row index.
- Scrambled copy (T9): the digit's 64 values shuffled by Fisher–Yates, seeded 7000 + the row index.
- Paired bootstrap: 2,000 resamples, seed 99. A lower bound is the 2.5th percentile.

## The claims (all on the 1,797 test digits from 13 writers the cell never saw)

- **T1 · real task.** Clean accuracy ≥ 95.0%.
- **T2 · against the strong reference.** Not worse than 1-nearest-neighbour over all 3,823 stored
  training digits (same bits, Hamming) by more than 1.5 points: paired 95% lower bound of
  (cell − 1-NN) > −1.5 points. (The cell stores at most 400 patterns against 1-NN's 3,823; that follows
  from the grid, so it is a design fact, not a measurement.)
- **T3 · against the weak baseline.** Beats the nearest class centroid (each class's bitwise majority,
  nearest by Hamming) on the same bits: paired 95% lower bound > 0.
- **T4 · deterministic.** The full test record (every digit: settled state, flips, sweeps, answer, fit,
  in every condition) has one SHA-256. Node on GitHub's runner and a browser tab produce the same hash,
  and two runs in a row agree.
- **T5 · it settles.** On every test settle (clean, 10%, 25%, scrambled), every flip strictly lowers E,
  and every settle reaches a fixed point within 12 sweeps.
- **T6 · robust to noise.** At 10% noise, accuracy ≥ clean − 2.0 points. At 25% noise, accuracy ≥
  clean − 8.0 points.
- **T7 · settling earns its keep (could fail).** At 25% noise the settled answer beats the same shape's
  one-step readout: paired 95% lower bound > 0. Clean, settling is not worse than one-step by more than
  0.5 points: lower bound > −0.5 points.
- **T8 · settling cleans.** At 25% noise, the settled state is strictly closer (Hamming) to the clean
  digit's bits than the noisy input was, on at least 70% of test digits.
- **T9 · non-fit is measurable (groundwork for Rung 5, not a defence claim).** Settled fit ranks the
  genuine test digits above their scrambled copies: AUC ≥ 0.98.
- **T10 · the page.** No measured number is typed into `index.html`. The tab re-runs the held-out test
  and reproduces the T4 hash.
- **T11 · the data.** Both UCI files are byte-identical to the hashes above.
- **G · the gate.** witness v0.6 on the cell's kernel: CLEAN, nothing baselined. CI green on GitHub's
  runner.

## What Rung 1 is not

Not self-improvement (Rung 2), not a defence (Rung 5), not on a chip (Rung 7). Whole-number maths is
chosen so that later rungs can run on small hardware; this rung proves only what is listed above.
