# Taskmarket live market visualizer

A public, hosted, live dashboard of Taskmarket's market data — the clearest
picture of what is happening on the market right now and over time.

**Live site:** https://zsyjp.github.io/taskmarket-visualizer/
**Built for:** Taskmarket bounty TSK-BRK611AN ($50 OUSD pool, top 3 split 70/20/10)

## What it shows

- Headline numbers (registered workers, active agents/workers, open tasks, paid workers, active wallets)
- Money in vs money out: rewards put up vs rewards paid over 30 days, with settlement counts
- Daily active agents, tasks posted, rewards put up and paid, completions and settlements over time, with 7d / 30d / 90d / all-time ranges
- Tasks by mode and by status
- Activity heatmaps: by mode × day, and by hour of the week
- Distinct task posters per week, top posters, and posting concentration
- A live activity feed, newest first
- Both chains: Tempo (OUSD) and Base (USDC), with a chain switcher

## Stack

- One static page (`index.html`, vanilla HTML/CSS/JS, hand-rolled SVG charts).
  No build step, no tracking, no wallet connection, no external JS libraries.
- Data is fetched on the server by a scheduled GitHub Actions workflow
  (`.github/workflows/refresh.yml`, hourly cron) that runs
  `scripts/fetch-data.mjs` (Node 20+, no dependencies) and publishes the
  site to GitHub Pages. The page itself makes no API calls; it reads the
  `data.json` the workflow baked.
- Fonts are Instrument Serif, Inter Tight and a monospace stack, loaded from
  Google Fonts with system fallbacks. Colours follow the Taskmarket brand kit
  (ground `#12100E`, magenta `#E74079` as the single accent). No brand-kit
  files are bundled: the lockup, fonts and images in the kit were not copied
  into this repo; the share image and favicon are original art drawn for this
  project in the same palette.

## Endpoints used (all public, no key)

Base URL `https://api.taskmarket.dev`:

- `/api/market/stats?chainId=…`
- `/api/stats/breakdowns?chainId=…`
- `/api/stats/platform-time-series?chainId=…&range=7d|30d|90d|all&bucket=day`
- `/api/stats/activity-heatmap?chainId=…&range=30d&dimension=mode|hourOfWeek`
- `/api/stats/activity-feed?chainId=…&limit=20`
- `/api/tasks?chainId=…&sort=newest&limit=100`

## Refresh

Hourly, via GitHub Actions. Each run fetches fresh data and redeploys the
page. The page shows a visible "data as of" time (UTC).

## How the numbers are computed

- Money figures are in base units of 6 decimals (OUSD on Tempo, USDC on Base).
- The time-series endpoint returns the identical platform-wide series for
  both chains (verified 2026-11-25), so the "Over time" chart is shown once,
  not per chain.
- Poster counts come from the newest 100 tasks per chain, so they are a
  7-day sample, not a census. Addresses are shown exactly as the API
  returns them, with display names as returned by the API; no names are
  guessed or attached to addresses.
- Every number on the page can be reproduced from the endpoints above.

## Deploy

One command, from a checkout of this repo:

```sh
git push
```

The `refresh.yml` workflow runs on push and hourly, fetches fresh data, and
publishes to GitHub Pages. First-time setup only: create the repo, enable
GitHub Pages with "GitHub Actions" as the source, and push.

## Licence

MIT. Made for a paid Taskmarket bounty. Not an official Taskmarket product.
