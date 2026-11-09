# Amendment 1 to seal 1, made before the test file was read

`CLAIMS.md` (seal 1, ed3e7f5) is unchanged and stays the contract. This file records one change to the **dev
search only**, made after dev and before `optdigits.tes` entered this repository. **No bar moved. No claim was
reworded. The test file has not been read.**

## What dev showed

The sealed dev grid (powers n ∈ {2, 3, 4}) chose b=4, k=5, R=64, n=4: **88.1% clean and 84.6% at 25% noise** on the
955 dev digits (`data/dev-v1.json`, kept). The table showed the cause: with a soft energy, many moderately close
memories together outweigh the one nearest memory, and the settle slides into a mixture of digits. More memories made
it worse, not better (k=40 at R=64, n=4: 54.0% clean), while the same shape read in one step scored 97.5%.

A diagnosis on half the dev digits (the even positions of the dev list) then tried sharper energies. These numbers
were seen before this amendment was written:

| shape | R | n | clean one-step | clean settled | 25% one-step | 25% settled |
|---|---|---|---|---|---|---|
| b=4, k=20 | 64 | 4 | 96.0 | 75.7 | 92.5 | 79.1 |
| b=4, k=20 | 64 | 6 | 96.9 | 95.4 | 92.3 | 92.3 |
| b=4, k=40 | 64 | 6 | 97.5 | 90.2 | 93.7 | 91.0 |
| b=4, k=40 | 40 | 8 | 97.1 | 97.3 | 34.3 | 39.5 |
| b=4, k=5 | 64 | 6 | 94.4 | 94.4 | 88.7 | 88.5 |

So the grid fixed in seal 1 was too soft. That was a mistake in the seal, made before any code existed.

## The change

- Dev grid powers: n ∈ {2, 3, 4} becomes **n ∈ {2, 3, 4, 6, 8}**. Everything else is as sealed: b, k, the three
  reaches, the dev split, the score, the tie rules, the seeds and the noise. A setting whose energy would leave the
  exact whole-number range is refused and listed as refused.
- The claims are judged on the cell this amended grid chooses (sealed by hash in seal 2).
- **The cost is shown, not hidden:** the cell the original grid chose (`data/cell-v1.txt`, sha256
  `f746d9127b7fcd4c1acc7a237b923d38c93491d6965f8ded892e959cd4a248c1`) is also run once on the test, and its numbers
  stand beside the judged cell's on the page and in the record.

## What this does not change

T1–T11 and G, their bars, the held-out rule (the test file is read once, after seal 2), and the rule that a claim
missing its bar is kept as failed.
