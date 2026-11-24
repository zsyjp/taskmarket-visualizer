// Fetch Taskmarket public stats and build a compact data.json for the dashboard.
// Runs in GitHub Actions (hourly) and locally. Read-only, no keys.
// Endpoints (all public, https://api.taskmarket.dev):
//   /api/market/stats, /api/stats/breakdowns, /api/stats/platform-time-series,
//   /api/stats/activity-heatmap, /api/stats/activity-feed, /api/tasks
// Note (verified 2026-11-25): platform-time-series returns the same platform-wide
// series for chainId 4217 and 8453, so it is fetched once and shown once.
import { writeFileSync } from 'node:fs';

const API = 'https://api.taskmarket.dev';
const CHAINS = [4217, 8453];
const WEEK_MS = 7 * 24 * 3600 * 1000;

async function get(path) {
  const r = await fetch(API + path, { headers: { 'user-agent': 'taskmarket-visualizer/1.0 (+https://taskmarket.dev)' } });
  if (!r.ok) throw new Error(`${path} -> HTTP ${r.status}`);
  return r.json();
}
const trunc = (a) => (a ? a.slice(0, 6) + '…' + a.slice(-4) : null);
const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

const out = { generatedAt: new Date().toISOString(), chains: {}, series: {}, postersWeek: {}, topPosters: {}, insights: {} };

for (const chain of CHAINS) {
  const [stats, breakdowns, heatMode, heatHour, feed, tasksNew] = await Promise.all([
    get(`/api/market/stats?chainId=${chain}`),
    get(`/api/stats/breakdowns?chainId=${chain}`),
    get(`/api/stats/activity-heatmap?chainId=${chain}&range=30d&dimension=mode`),
    get(`/api/stats/activity-heatmap?chainId=${chain}&range=30d&dimension=hourOfWeek`),
    get(`/api/stats/activity-feed?chainId=${chain}&limit=20`),
    get(`/api/tasks?chainId=${chain}&sort=newest&limit=100`),
  ]);
  const tasks = tasksNew.tasks || tasksNew;
  const now = Date.now();
  const recent = tasks.filter((t) => now - new Date(t.createdAt).getTime() <= WEEK_MS);
  const byReq = {};
  for (const t of recent) {
    const k = t.requester;
    byReq[k] = byReq[k] || { address: t.requester, displayName: t.requesterDisplayName || null, count: 0 };
    byReq[k].count++;
  }
  const ranked = Object.values(byReq).sort((a, b) => b.count - a.count);
  const top3share = ranked.length ? ranked.slice(0, 3).reduce((s, r) => s + r.count, 0) / Math.max(recent.length, 1) : 0;
  const openTasks = tasks.filter((t) => t.status === 'open');
  const rewards = openTasks.map((t) => Number(t.reward) / 1e6).filter((n) => Number.isFinite(n) && n > 0);
  const statusCounts = Object.fromEntries((breakdowns.status || []).map((s) => [s.status, s.count]));
  const dead = (statusCounts.expired || 0) + (statusCounts.cancelled || 0);
  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  out.chains[chain] = {
    stats,
    breakdowns,
    heatmapMode: heatMode,
    heatmapHour: heatHour,
    feed: (feed.items || feed).slice(0, 20).map((f) => ({
      type: f.type, timestamp: f.timestamp, taskTitle: f.taskTitle, chainId: f.chainId,
      actor: trunc(f.actor), actorType: f.actorType, amount: f.amount, rating: f.rating,
    })),
  };
  out.postersWeek[chain] = { distinct: ranked.length, tasks: recent.length };
  out.topPosters[chain] = ranked.slice(0, 8).map((r) => ({ ...r, addressShort: trunc(r.address) }));
  out.insights[chain] = {
    top3PosterShare: +top3share.toFixed(3),
    deadShare: total ? +(dead / total).toFixed(3) : null,
    medianOpenReward: median(rewards),
    openSampled: openTasks.length,
  };
}
out.postersWeek.combined = {
  distinct: 'see per-chain (a poster can post on both chains)',
  tasks: Object.values(out.postersWeek).reduce((s, p) => s + (p.tasks || 0), 0),
};

for (const range of ['7d', '30d', '90d', 'all']) {
  out.series[range] = await get(`/api/stats/platform-time-series?chainId=4217&range=${range}&bucket=day`);
}
out.seriesNote = 'platform-time-series is platform-wide: the API returns the identical series for chainId 4217 and 8453 (verified 2026-11-25), so it is shown once, not per chain.';

writeFileSync(new URL('../data.json', import.meta.url), JSON.stringify(out, null, 1));
console.log('wrote data.json at', out.generatedAt);
console.log('postersWeek', JSON.stringify(out.postersWeek));
console.log('series rows', Object.fromEntries(Object.entries(out.series).map(([k, v]) => [k, v.length])));
