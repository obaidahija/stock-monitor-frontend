# MarketScout Frontend

React/TypeScript (Vite) frontend for the MarketScout research API in `../stock-monitor`.
The dev server proxies `/v1` (WebSockets included) to `http://localhost:8100`. Everything
shown is research and information only: the app never places orders or holds broker
credentials.

## Running and checks

```bash
npm install
npm run dev      # dev server, proxies /v1 to the backend on port 8100
npm test         # vitest
npm run lint     # oxlint
npm run build    # tsc + vite build
```

On Windows, `..\stock-monitor\marketscout.ps1 start` starts Postgres, the backend and this dev
server together.

## Pages

| Path | Page |
|---|---|
| `/` | Morning Digest (see below) |
| `/discover` | Research First, upcoming macro events, macro attention, social buzz, analyst price-target changes, Google Finance Outlook, fresh catalysts, sector heatmap and the sortable tracked universe |
| `/research` | Research First and fresh catalysts |
| `/stocks/:ticker` | Ticker page: Analysis, AI Research, News, Earnings, Social, Filings (Insider trades / All filings) and Peers (Competitors / Pairs) |
| `/filings` | Filing Intel: recent and expected filings, the filing detail panel, and on-demand analysis |
| `/watchlists` | Named watchlists with setups, setup history and alert rules |
| `/social/:view` | Social: `trending`, `twitter` or `reddit` |
| `/macro` | Macro signal, history, sector rotation, sector impact and macro news |
| `/events` | The week's scheduled macro events and big earnings |
| `/system` | Health, Jobs, Signals, Research health and Archive (manual cleanup of saved research) |
| `/settings` | Runtime settings by category, AI provider profiles and Telegram routing |

Older paths redirect: `/trending`, `/twitter` and `/reddit` to `/social/...` (keeping the query
string), `/ai-settings` to `/settings`, and `/briefing` to `/`. Every page shares a side column
with the oil/gold/Bitcoin price panel and the market news briefing; on narrow screens both
start behind **Market overview**.

## Morning Digest

Research First is a ten-stock research shortlist for the selected 1–7-session window. Each
card explains its placement, links to source and analysis, and shows data limits and timing
risks. The Digest displays the snapshots saved when it was built; changing the window there
selects another saved snapshot.

The compact view keeps twelve signal cards in one responsive grid, with each card's section
labelled. **Show all coverage** and stage, text, or **New only** filters browse at most 24
cards per page; filters and the selected historical date are preserved in the URL. Today's
edition refreshes every minute, including the early-to-late transition, and follows the New
York calendar date. Past editions remain saved snapshots; the separately labelled price quotes
are current and refresh only for cards near the viewport and the selected Research First
window. Viewport changes are batched for 200 ms; successful quotes are reused per symbol for 30
seconds, including when returning to Digest. A provider outage keeps the last useful price
visible with **Cached quote · Refresh failed**, independently for each symbol. Stale Research
First news coverage is visible beside the compact cards and describes the saved edition's
capture-time limitation.

**News volume** is filterable even in older saved editions that recorded it only as a section.
**New only** shows entries with an explicit saved New label; it explains how many otherwise
matching entries have no recorded newness and offers **Remove New only filter** without
clearing the search or stage selection.

**Headlines** expands complete saved titles and, for newly built editions, source links and
timestamps. Older editions retain their saved text without invented links. Hiding a ticker
offers **Undo**; **Hidden tickers** lists active seven-day exclusions and restores them. A
failed or skipped manual build keeps the current edition visible and displays the error;
successful builds open today's Intraday update. Positive Filing Intel filings appear as rows
that open the filing detail panel. The Telegram send button reads the Digest route's readiness
from Settings → Telegram.

## Social

Twitter and Reddit stay separate, in AI research too. Reddit live collection is controlled by
the backend's `REDDIT_INTELLIGENCE_ENABLED` flag; when it is off, cached Reddit content stays
visible and refresh actions explain why they are unavailable. The Reddit auth banner polls
every 30 seconds and shows automatic recovery and its cooldown.

Post collection is faster than sentiment classification. New posts may briefly render without
a sentiment badge; feed and ticker-search queries use the backend's `sentiment_pending` flag
to refresh every 30 seconds and stop as soon as classification is complete. Opening a
discussion loads at most 25 comments, which are not sentiment-labelled. The frontend never runs
`rdt-cli` or `twitter-cli` and never receives or stores their credentials.

A ticker's Social → Twitter view has the company's own confirmed X posts, trusted-account
mentions, and an explicit cashtag search.

## AI settings and the AI Research tab

Settings → AI selects independent provider/model profiles for research, summarization and macro
transmission. Only the OpenRouter catalog is discovered dynamically; local and Anthropic model
IDs remain editable text. Provider cards show configured status; the frontend never fetches,
renders, stores, or submits API keys.

Each ticker's AI Research tab shows a Google Finance Research card above the MarketScout
structured report. The card answers a ticker-aware question and follow-ups: each follow-up
resends the earlier turns, nothing is saved, and changing ticker resets it. Answers render as
Markdown with the sources Google cited (links open in a new tab with
`rel="noopener noreferrer"`). On failure the card shows the bounded error, keeps the question
editable, and links to Google Finance's own Research page. The structured report below it
(generate, refresh, live progress, saving an AI setup) is independent.

## Telegram settings

Settings → Telegram shows the bot, the default chat, and each message kind's destination
(Digest, Earnings, Filings, Insider – Form 144, Major holders – 13D, Watchlist) with its chat
and topic names, whether the bot can post there, and the last delivery or failure. **Set up
topics** creates one forum topic per kind; each kind can be tested, edited or cleared. See the
backend README's Telegram section for the group setup.
