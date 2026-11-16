// node tools/to_bymean.js data.js <out.json>: per-mean totals for tools/og_card.py
global.window = {}; require(require('path').resolve(process.argv[2]));
const D = window.ICLR_DATA, fs = require('fs');
const byMean = {}; const tot = { n: 0, withdrawn: 0, desk: 0, sc: 0, up: 0, down: 0, mixed: 0 };
for (const [k, v] of Object.entries(D.combos)) {
  const r = k.split('').map(Number); const m = (Math.round(r.reduce((a, b) => a + b, 0) / r.length * 100) / 100).toFixed(2);
  const g = byMean[m] = byMean[m] || [0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 7; i++) g[i] += v[i];
  tot.n += v[0]; tot.withdrawn += v[1]; tot.desk += v[2]; tot.sc += v[3]; tot.up += v[4]; tot.down += v[5]; tot.mixed += v[6];
}
tot.unchanged = tot.sc - tot.up - tot.down - tot.mixed;
fs.writeFileSync(process.argv[3], JSON.stringify({ reviews: D.reviews, at: D.updated, cols: ["n_initial","withdrawn","desk","sameCount_active","up","down","mixed"], tot, byMean }));
console.log(JSON.stringify(tot));
