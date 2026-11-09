# Seal 2 · the frozen cell, before the test file is read

Committed after seal 1 (`CLAIMS.md`, ed3e7f5) and amendment 1 (`AMENDMENT.md`, 2ecb01a). At this commit,
**`data/optdigits.tes` is not in the repository and has not been read.** The next commit adds it (its SHA-256 is the one
seal 1 pinned) and runs the held-out test once, for the two cells below, with `tools/run.mjs`, which refuses to run
unless this file names `data/cell.txt` by its hash.

## The judged cell

- `data/cell.txt` sha256 **095d33a8bb6d6393173b48279f60000aa2d9e3b1413abc2e18e87936dab73b88**
- Settings: b=4 (256 bits per digit), k=20 patterns per class (200 in all), reach R=64, power n=6.
- Grown on all 3,823 training digits after the amended grid chose it by the sealed rule (`data/dev.json`, sha256
  0c69c62fb2a756f7a7e6b99dfae09292b2c89a946d5cd9cc7c1d0adaa8f380f5): 180 settings, 9 refused because their energy
  would leave the exact whole-number range. On the 955 dev digits it scored 908 clean (95.1%) and 868 at 25% noise
  (90.9%), and its longest dev settle took 9 sweeps.

## The original-grid cell, run beside it (AMENDMENT.md)

- `data/cell-v1.txt` sha256 f746d9127b7fcd4c1acc7a237b923d38c93491d6965f8ded892e959cd4a248c1
- b=4, k=5, R=64, n=4, chosen by seal 1's grid (`data/dev-v1.json`, sha256
  b9880e5b6f75e5c3a294299650c2ab97536ae771aa0376eee93e149aedc17cf4): 841 clean and 808 at 25% noise on dev.

## The code that will run the test, frozen here

| file | sha256 | mutation gate (witness v0.6) |
|---|---|---|
| `src/cell.mjs` | 590c8307b06148dbfa7c2e4a247336441e150d8235d62783c45efb53190d9101 | 113 of 113 caught, 0 baselined |
| `src/dev.mjs` | 096d159fe2b2cc7cf7a055e4bd2a1c570d503abcb2703795cee7f0bc0dd8960f | 11 of 11 caught, 0 baselined |
| `src/run.mjs` | ad6a0d58236ccb8e976ed78e6a935c02fe50a2484f999dcc4dffd26e5e147775 | 39 of 39 caught, 0 baselined |

Both dev tables re-derive byte for byte from the training file (`node tools/dev.mjs --check`). The bars are the ones
`CLAIMS.md` fixed before any code; none has moved.
