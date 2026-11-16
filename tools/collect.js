// Rebuilds the numbers in data.js. Run in the browser console of a signed-in openreview.net tab.
//
// 1. Baseline. OpenReview's content policy blocks fetching other sites from its pages, so the
//    Nov 6 snapshot is handed over through window.name:
//      a. open https://shiqiangw.github.io/iclr-2027-scores/ and run in its console:
//           const p = await fetch('data/papers.json').then(r => r.json());
//           window.name = 'ICLRINIT\n' + p.rows.map(([n, f, t, r]) => n + '\t' + r.join('')).join('\n');
//      b. in the same tab, go to https://openreview.net/ and sign in.
// 2. Paste this file into that tab's console and wait about four minutes.
// 3. The console prints a JSON object. Copy `combos`, `currentMeans`, `reviews` and one new `timeline` row into data.js.

(async () => {
  if (!window.name.startsWith('ICLRINIT')) throw new Error('Baseline missing: see step 1');
  const SNAP_TS = Date.parse('2026-11-06T13:54:47Z');
  const init = {};
  for (const line of window.name.split('\n').slice(1)) {
    const [num, rs] = line.split('\t');
    init[num] = rs ? rs.split('').map(Number) : [];
  }

  const num = (v) => {
    if (v && typeof v === 'object' && 'value' in v) v = v.value;
    if (v == null || typeof v === 'boolean') return null;
    if (typeof v === 'number') return v;
    const m = String(v).match(/^\s*(-?\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) : null;
  };
  const statusOf = (n) => {
    let v = n.content && n.content.venueid; if (v && typeof v === 'object') v = v.value; v = v || '';
    if (v.endsWith('/Withdrawn_Submission')) return 'w';
    if (v.endsWith('/Desk_Rejected_Submission')) return 'd';
    return 'a';
  };

  // current state of every submission, one page of 1000 at a time
  const cur = {};
  const base = 'https://api2.openreview.net/notes?invitation=ICLR.cc/2027/Conference/-/Submission&details=directReplies&sort=number:asc&limit=1000';
  for (let offset = 0; ; ) {
    let d, tries = 0;
    for (;;) {
      try {
        const r = await fetch(base + '&offset=' + offset, { credentials: 'include' });
        if (r.ok) { d = await r.json(); break; }
        throw new Error(r.status + ' ' + (await r.text()).slice(0, 200));
      } catch (e) {
        if (String(e).includes('ChallengeRequired') || ++tries >= 6) throw e;
        await new Promise(s => setTimeout(s, 4000 * tries));
      }
    }
    for (const n of d.notes) {
      const revs = (n.details && n.details.directReplies || []).filter(x => !x.ddate && (x.invitations || []).some(i => i.endsWith('/-/Official_Review')));
      cur[n.number] = { s: statusOf(n), revs: revs.map(x => ({ v: num(x.content && x.content.rating), tm: x.tmdate || x.mdate || 0, tc: x.tcdate || x.cdate || 0 })) };
    }
    offset += d.notes.length;
    console.log(offset, 'submissions');
    if (d.notes.length < 1000) break;
    await new Promise(s => setTimeout(s, 1500));
  }

  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const combos = {}, moves = {}, initial = {};
  const rv = { analyzed: 0, modified: 0, changed: 0, exact: 0, inferred: 0 };
  const row = { sc: 0, up: 0, down: 0, mixed: 0, withdrawn: 0 };
  for (const [n, r0] of Object.entries(init)) {
    if (!r0.length) continue;
    const key = r0.join('');
    const g = combos[key] = combos[key] || [0, 0, 0, 0, 0, 0, 0, 0];
    g[0]++;
    const c = cur[n]; if (!c) continue;
    if (c.s === 'w') { g[1]++; row.withdrawn++; continue; }
    if (c.s === 'd') { g[2]++; continue; }
    const revs = c.revs.filter(x => x.v != null);
    const r1 = revs.map(x => x.v).sort((a, b) => b - a);
    if (r1.length !== r0.length) continue;
    g[3]++; row.sc++;
    const same = r1.every((v, i) => v === r0[i]), d = sum(r1) - sum(r0);
    if (!same) { if (d > 0) { g[4]++; row.up++; } else if (d < 0) { g[5]++; row.down++; } else { g[6]++; row.mixed++; } }
    g[7] += d;

    // review-level moves: reviews untouched since the snapshot keep their rating
    if (revs.some(x => x.tc > SNAP_TS)) continue;
    const pool = [...r0];
    const stable = revs.filter(x => x.tm <= SNAP_TS), mod = revs.filter(x => x.tm > SNAP_TS);
    let ok = true;
    for (const x of stable) { const i = pool.indexOf(x.v); if (i < 0) { ok = false; break; } pool.splice(i, 1); }
    if (!ok || pool.length !== mod.length) continue;
    rv.analyzed += r0.length; rv.modified += mod.length;
    for (const v of r0) initial[v] = (initial[v] || 0) + 1;
    // The pairing is unique when one review was edited, or all edited reviews share their Nov 6 value, or share their value now.
    const curVals = mod.map(x => x.v);
    const unique = mod.length === 1 || new Set(pool).size === 1 || new Set(curVals).size === 1;
    const rest = [];
    for (const v of curVals) { const i = pool.indexOf(v); if (i >= 0) pool.splice(i, 1); else rest.push(v); }
    pool.sort((a, b) => a - b); rest.sort((a, b) => a - b);
    rest.forEach((to, i) => { const k = pool[i] + '>' + to; moves[k] = (moves[k] || 0) + 1; rv.changed++; unique ? rv.exact++ : rv.inferred++; });
  }
  // mean rating of every paper still under review, for ranking
  const h = {}; let nNow = 0;
  for (const c of Object.values(cur)) {
    if (c.s !== 'a') continue;
    const r = c.revs.map(x => x.v).filter(v => v != null);
    if (!r.length) continue;
    const m = (Math.round(sum(r) / r.length * 100) / 100).toFixed(2);
    h[m] = (h[m] || 0) + 1; nNow++;
  }
  const out = { updated: new Date().toISOString(), combos, currentMeans: { n: nNow, h }, reviews: { ...rv, initial, moves }, timelineRow: { at: new Date().toISOString(), ...row } };
  console.log(JSON.stringify(out));
  return out;
})();
