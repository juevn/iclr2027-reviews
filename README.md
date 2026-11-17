# How much did the ICLR 2027 rebuttal move scores?

How much did the ICLR 2027 rebuttal move review scores? Every paper's initial review scores against live OpenReview data.

- **Look up your score.** Type your initial ratings (for example `3 3 2 2`) to see your initial rank, where the same mean ranks now, and how papers that started the same way moved: up, down, same, withdrawn.
- **By initial mean.** Share of papers whose score went up or down, and share withdrawn, for each exact mean (2.5 is its own bar).
- **Review by review.** Each review's initial rating against now, as a 4×4 table.
- **Updates.** One row per pass over all submissions until the discussion closes on Nov 18.

**Live page:** https://juevn.github.io/iclr2027-reviews/

## Files

- `index.html`: the whole site. Static, no build step, works on GitHub Pages.
- `data.js`: aggregated counts only.
- `tools/collect.js`: runs in a signed-in OpenReview tab and pulls the current ratings (steps in the file).
- `tools/build_data.js`: appends one pass to `data.js`, and refuses if the totals do not add up.
- `tools/to_bymean.js`, `tools/og_card.py`: rebuild the link-preview card.
- `assets/`: favicon and link-preview card.

## Data

`combos` maps each initial rating combination (sorted high to low) to eight counts:

| Index | Meaning |
|---|---|
| 0 | Papers that started with these initial scores |
| 1 | Withdrawn since |
| 2 | Desk-rejected since |
| 3 | Still under review with the same number of reviews |
| 4 | Of those, rating sum went up |
| 5 | Rating sum went down |
| 6 | Ratings changed but the sum stayed the same |
| 7 | Total change in rating sums |

`currentMeans` counts papers still under review by their current mean rating, so a score can be ranked against today's field. `reviews` holds review-level moves (`"2>3"`: reviews that were initially 2 and are 3 now). `dest` lists, for each initial combination, the current scores of the papers that changed. `moveTimes` counts changed reviews per move by 3-hour UTC bucket of the review's last edit. `timeline` has one row per update.

## How it was made

- **Initial scores.** The snapshot taken right after reviews were released (Nov 6, 13:54 UTC), published at [shiqiangw.github.io/iclr-2027-scores](https://shiqiangw.github.io/iclr-2027-scores/) ([repo](https://github.com/shiqiangw/iclr-2027-scores)), about a day after reviews were released.
- **Current ratings.** The OpenReview API: every ICLR 2027 submission with its official reviews.
- **Score changes.** A paper's scores now against its initial scores. Only papers still under review with the same number of reviews are counted.
- **Review-level moves.** Reviews not edited since the snapshot keep their initial rating, which pins down the rest. When several reviews on one paper were edited and more than one pairing fits, edits that kept the rating count as text-only and the rest are paired by smallest change. This applies to 628 of 6,371 changed reviews (10%, as of Nov 17); the rest are pinned down exactly.
- **Privacy.** Only counts are published. No review text, reviewer ids, paper titles or author names.

Made by [Jueun Kim](https://juevn.github.io/) ([@jueun_kim_](https://x.com/jueun_kim_)). Also: [NeurIPS 2026 Explorer](https://juevn.github.io/neurips2026/).
