// node tools/build_data.js data.js <update.json>: appends one pass to data.js. Exits 1 if the totals do not add up.
const fs = require('fs');
global.window = {}; require(require('path').resolve(process.argv[2]));
const D = window.ICLR_DATA, U = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
// sanity: combos totals must match the timeline row
const t = [0,0,0,0,0,0,0,0]; for (const v of Object.values(U.combos)) v.forEach((x, i) => t[i] += x);
const row = U.timelineRow;
const ok = t[3] === row.sc && t[4] === row.up && t[5] === row.down && t[6] === row.mixed && t[1] === row.withdrawn
  && Object.values(U.reviews.moves).reduce((a, b) => a + b, 0) === U.reviews.changed && t[0] === 40458;
if (!ok) { console.error('MISMATCH', t, row); process.exit(1); }
if (!D.timeline.some(r => r.at === row.at)) D.timeline.push({ at: row.at.replace(/\.\d+Z$/, 'Z'), sc: row.sc, up: row.up, down: row.down, mixed: row.mixed, withdrawn: row.withdrawn });
D.updated = U.updated.replace(/\.\d+Z$/, 'Z'); D.combos = U.combos; D.currentMeans = U.currentMeans;
const order = ['1>2','1>3','1>4','2>1','2>3','2>4','3>1','3>2','3>4','4>2','4>3'];
const moves = Object.fromEntries(Object.entries(U.reviews.moves).sort((a, b) => b[1] - a[1]));
D.reviews = { analyzed: U.reviews.analyzed, modified: U.reviews.modified, changed: U.reviews.changed, exact: U.reviews.exact, inferred: U.reviews.inferred, initial: U.reviews.initial, moves };
const J = (o) => JSON.stringify(o);
const comboLines = []; let line = [];
for (const [k, v] of Object.entries(D.combos)) { line.push(`${J(k)}:${J(v)}`); if (line.length === 6) { comboLines.push('    ' + line.join(',')); line = []; } }
if (line.length) comboLines.push('    ' + line.join(','));
const out = `// Aggregated numbers only. No review text, reviewer ids or per-paper rows.
// combos: initial ratings on Nov 6 (sorted high to low) ->
//   [papers, withdrawn, desk_rejected, still active with same review count, went up, went down, mixed, sum of rating-sum changes]
window.ICLR_DATA = {
  venue: ${J(D.venue)},
  scale: ${J(D.scale)},
  baseline: ${J(D.baseline)},
  updated: ${J(D.updated)},
  discussionEnds: ${J(D.discussionEnds)},
  decisions: ${J(D.decisions)},
  combos: {
${comboLines.join(',\n')}
  },
  // Mean rating now -> number of papers still under review, for ranking a score against today's field.
  currentMeans: ${J(D.currentMeans)},
  // Review-level moves. exact: the pairing of Nov 6 and current ratings is unique.
  // inferred: more than one pairing fits, smallest-change one used.
  reviews: ${J(D.reviews)},
  // One row per update: papers still active with the same number of reviews, and how many moved.
  timeline: [
${D.timeline.map(r => '    ' + J(r)).join(',\n')}
  ]
};
`;
fs.writeFileSync(process.argv[2], out);
console.log('ok', 'timeline rows', D.timeline.length, 'totals', t.join(','));
