// Rebuilds the numbers in data.js. Runs in a signed-in openreview.net browser tab.
//
// 1. Baseline. OpenReview's content policy blocks fetching other sites from its pages, so the
//    initial snapshot is handed over through window.name, in the SAME tab:
//      a. open https://shiqiangw.github.io/iclr-2027-scores/ and run:
//           const p = await fetch('data/papers.json', { cache: 'no-store' }).then(r => r.json());
//           window.name = 'ICLRINIT\n' + p.rows.map(([n, f, t, r]) => n + '\t' + r.join('')).join('\n');
//      b. navigate that tab to https://openreview.net/group?id=ICLR.cc/2027/Conference (signed in).
// 2. Run this whole file in that tab. It starts a background pull (about 4 minutes) and returns at once.
// 3. Poll until done (each call waits up to 35 s):
//      await Promise.race([window.ICLR_COLLECT.job, new Promise(s => setTimeout(s, 35000))]);
//      window.ICLR_COLLECT.done ? JSON.stringify(window.ICLR_COLLECT.out) : JSON.stringify(window.ICLR_COLLECT.progress)
// 4. Save that JSON to a file and run: node tools/build_data.js data.js <file>

(() => {
  if (window.ICLR_COLLECT && !window.ICLR_COLLECT.done && !window.ICLR_COLLECT.progress.error) return 'already running';
  if (!window.name.startsWith('ICLRINIT')) return 'ERROR: baseline missing in window.name (see step 1)';
  const SNAP_TS = Date.parse('2026-11-06T13:54:47Z');
  const C = window.ICLR_COLLECT = { done: false, init: {}, cur: {}, progress: { offset: 0, pages: 0, retries: 0, error: null, started: new Date().toISOString() } };
  for (const line of window.name.split('\n').slice(1)) { const [n, rs] = line.split('\t'); C.init[n] = rs ? rs.split('').map(Number) : []; }
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
  const sum = (a) => a.reduce((x, y) => x + y, 0);

  C.job = (async () => {
    const base = 'https://api2.openreview.net/notes?invitation=ICLR.cc/2027/Conference/-/Submission&details=directReplies&sort=number:asc&limit=1000';
    try {
      for (;;) {
        let d, tries = 0;
        for (;;) {
          try {
            const r = await fetch(base + '&offset=' + C.progress.offset, { credentials: 'include' });
            if (r.ok) { d = await r.json(); break; }
            const t = await r.text();
            if (t.includes('ChallengeRequired')) throw Object.assign(new Error('ChallengeRequired: sign in to OpenReview in this tab'), { fatal: true });
            throw new Error(r.status + ' ' + t.slice(0, 200));
          } catch (e) {
            if (e.fatal || ++tries >= 6) throw e;
            C.progress.retries++; await new Promise(s => setTimeout(s, 4000 * tries));
          }
        }
        for (const n of d.notes) {
          const revs = (n.details && n.details.directReplies || []).filter(x => !x.ddate && (x.invitations || []).some(i => i.endsWith('/-/Official_Review')));
          C.cur[n.number] = { s: statusOf(n), revs: revs.map(x => ({ v: num(x.content && x.content.rating), tm: x.tmdate || x.mdate || 0, tc: x.tcdate || x.cdate || 0 })) };
        }
        C.progress.pages++; C.progress.offset += d.notes.length;
        if (d.notes.length < 1000) break;
        await new Promise(s => setTimeout(s, 1500));
      }
      const finished = new Date().toISOString();

      const combos = {}, moves = {}, initial = {}, dest = {}, times = {};
      const rv = { analyzed: 0, modified: 0, changed: 0, exact: 0, inferred: 0 };
      const row = { sc: 0, up: 0, down: 0, mixed: 0, withdrawn: 0, desk: 0 };
      for (const [n, r0] of Object.entries(C.init)) {
        if (!r0.length) continue;
        const g = combos[r0.join('')] = combos[r0.join('')] || [0, 0, 0, 0, 0, 0, 0, 0];
        g[0]++;
        const c = C.cur[n]; if (!c) continue;
        if (c.s === 'w') { g[1]++; row.withdrawn++; continue; }
        if (c.s === 'd') { g[2]++; row.desk++; continue; }
        const revs = c.revs.filter(x => x.v != null);
        const r1 = revs.map(x => x.v).sort((a, b) => b - a);
        if (r1.length !== r0.length) continue;
        g[3]++; row.sc++;
        const same = r1.every((v, i) => v === r0[i]), dd = sum(r1) - sum(r0);
        if (!same) {
          if (dd > 0) { g[4]++; row.up++; } else if (dd < 0) { g[5]++; row.down++; } else { g[6]++; row.mixed++; }
          const d = dest[r0.join('')] = dest[r0.join('')] || {}; d[r1.join('')] = (d[r1.join('')] || 0) + 1;
        }
        g[7] += dd;
        // review-level moves: reviews untouched since the snapshot keep their rating
        if (revs.some(x => x.tc > SNAP_TS)) continue;
        const pool = [...r0];
        const stable = revs.filter(x => x.tm <= SNAP_TS), mod = revs.filter(x => x.tm > SNAP_TS);
        let ok = true;
        for (const x of stable) { const i = pool.indexOf(x.v); if (i < 0) { ok = false; break; } pool.splice(i, 1); }
        if (!ok || pool.length !== mod.length) continue;
        rv.analyzed += r0.length; rv.modified += mod.length;
        for (const v of r0) initial[v] = (initial[v] || 0) + 1;
        const unique = mod.length === 1 || new Set(pool).size === 1 || new Set(mod.map(x => x.v)).size === 1;
        const rest = [];
        for (const x of mod) { const i = pool.indexOf(x.v); if (i >= 0) pool.splice(i, 1); else rest.push(x); }
        pool.sort((a, b) => a - b); rest.sort((a, b) => a.v - b.v);
        rest.forEach((x, i) => {
          const k = pool[i] + '>' + x.v; moves[k] = (moves[k] || 0) + 1; rv.changed++; unique ? rv.exact++ : rv.inferred++;
          // 3-hour UTC bucket of the review's last edit ("2026-11-16T12" = 12:00-14:59)
          const iso = new Date(x.tm).toISOString(), hr = iso.slice(0, 11) + String(Math.floor(+iso.slice(11, 13) / 3) * 3).padStart(2, '0');
          const t = times[k] = times[k] || {}; t[hr] = (t[hr] || 0) + 1;
        });
      }
      const h = {}; let nNow = 0;
      for (const c of Object.values(C.cur)) {
        if (c.s !== 'a') continue;
        const r = c.revs.map(x => x.v).filter(v => v != null);
        if (!r.length) continue;
        const m = (Math.round(sum(r) / r.length * 100) / 100).toFixed(2);
        h[m] = (h[m] || 0) + 1; nNow++;
      }
      const sorted = Object.fromEntries(Object.entries(h).sort((a, b) => +a[0] - +b[0]));
      C.out = { updated: finished, combos, dest, currentMeans: { n: nNow, h: sorted }, reviews: { ...rv, initial, moves, times }, timelineRow: { at: finished, ...row } };
      C.done = true;
    } catch (e) { C.progress.error = String(e); }
  })();
  return 'started';
})();
