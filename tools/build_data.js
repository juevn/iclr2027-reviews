// node tools/build_data.js data.js <update.json>: appends one pass to data.js. Exits 1 if the totals do not add up.
const fs = require('fs');
global.window = {}; require(require('path').resolve(process.argv[2]));
const D = window.ICLR_DATA, U = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
// sanity: combos totals must match the timeline row
const t = [0,0,0,0,0,0,0,0]; for (const v of Object.values(U.combos)) v.forEach((x, i) => t[i] += x);
const row = U.timelineRow;
const ok = t[3] === row.sc && t[4] === row.up && t[5] === row.down && t[6] === row.mixed && t[1] === row.withdrawn && (row.desk == null || t[2] === row.desk)
  && Object.values(U.reviews.moves).reduce((a, b) => a + b, 0) === U.reviews.changed && t[0] === 40458;
if (!ok) { console.error('MISMATCH', t, row); process.exit(1); }
// edit-time buckets must add up to each move
if (U.reviews.times) for (const [k, n] of Object.entries(U.reviews.moves)) {
  const s = Object.values(U.reviews.times[k] || {}).reduce((a, b) => a + b, 0);
  if (s !== n) { console.error('TIMES MISMATCH', k, s, n); process.exit(1); }
}
// destinations must add up to the changed papers of each initial combo
if (U.dest) for (const [k, v] of Object.entries(U.combos)) {
  const s = Object.values(U.dest[k] || {}).reduce((a, b) => a + b, 0);
  if (s !== v[4] + v[5] + v[6]) { console.error('DEST MISMATCH', k, s, v); process.exit(1); }
}
const at = row.at.replace(/\.\d+Z$/, 'Z');
if (!D.timeline.some(r => r.at === at)) D.timeline.push({ at, sc: row.sc, up: row.up, down: row.down, mixed: row.mixed, withdrawn: row.withdrawn, ...(row.desk != null ? { desk: row.desk } : {}) });
D.updated = U.updated.replace(/\.\d+Z$/, 'Z'); D.combos = U.combos; D.currentMeans = U.currentMeans;
const order = ['1>2','1>3','1>4','2>1','2>3','2>4','3>1','3>2','3>4','4>2','4>3'];
const moves = Object.fromEntries(Object.entries(U.reviews.moves).sort((a, b) => b[1] - a[1]));
D.reviews = { analyzed: U.reviews.analyzed, modified: U.reviews.modified, changed: U.reviews.changed, exact: U.reviews.exact, inferred: U.reviews.inferred, initial: U.reviews.initial, moves };
const sortObj = (o, f) => Object.fromEntries(Object.entries(o).sort(f));
if (U.dest) D.dest = sortObj(Object.fromEntries(Object.entries(U.dest).map(([k, v]) => [k, sortObj(v, (a, b) => b[1] - a[1])])), (a, b) => a[0] < b[0] ? 1 : -1);
const total = (o) => Object.values(o).reduce((x, y) => x + y, 0);
if (U.reviews.times) D.moveTimes = sortObj(Object.fromEntries(Object.entries(U.reviews.times).map(([k, v]) => [k, sortObj(v, (a, b) => a[0] < b[0] ? -1 : 1)])), (a, b) => total(b[1]) - total(a[1]));
const J = (o) => JSON.stringify(o);
const comboLines = []; let line = [];
for (const [k, v] of Object.entries(D.combos)) { line.push(`${J(k)}:${J(v)}`); if (line.length === 6) { comboLines.push('    ' + line.join(',')); line = []; } }
if (line.length) comboLines.push('    ' + line.join(','));
const out = `// Aggregated numbers only. No review text, reviewer ids or per-paper rows.
// combos: initial ratings (sorted high to low) ->
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
  // Review-level moves. exact: the pairing of initial and current ratings is unique.
  // inferred: more than one pairing fits, smallest-change one used.
  reviews: ${J(D.reviews)},
${D.dest ? `  // dest: initial ratings -> current ratings of the papers that changed (same number of reviews), with counts.
  dest: {
${Object.entries(D.dest).map(([k, v]) => '    ' + J(k) + ':' + J(v)).join(',\n')}
  },
` : ''}${D.moveTimes ? `  // moveTimes: changed reviews per move, by 3-hour UTC bucket of the review's last edit (a later text-only edit moves it).
  moveTimes: ${J(D.moveTimes)},
` : ''}  // One row per update: papers still active with the same number of reviews, and how many moved.
  timeline: [
${D.timeline.map(r => '    ' + J(r)).join(',\n')}
  ]
};
`;
fs.writeFileSync(process.argv[2], out);
console.log('ok', 'timeline rows', D.timeline.length, 'totals', t.join(','));
