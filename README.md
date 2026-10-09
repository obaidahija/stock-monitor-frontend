# MarketScout Frontend

React/TypeScript frontend for MarketScout. The Reddit workspace at `/reddit` provides a cached
feed, explicit ticker searches, trusted subreddit and author sources, and bounded discussion
threads. Each ticker also has an independent Reddit tab and monitoring control; Twitter and
Reddit evidence remain separate in AI research.

Discover starts with **Research first**, a ten-stock research shortlist for the selected
1–7-session window. Each card explains its placement, links to source and analysis,
and shows data limits and timing risks. The Morning Digest displays the snapshots saved
when it was built; changing the window there selects another saved snapshot.

## Short Squeeze Strategy (Discover)

Below Fresh catalysts, **Short Squeeze Strategy** lists the latest completed session's matches for
the backend's daily scanner (rule `short-squeeze-daily-v2`): short float above 7%, days to cover
above 5, and a gain above 7% or a close at or above the prior 252-session high. Rule v1 counted an
intraday touch of that high, which matched reversal days. The section appears when
`short_squeeze_scanner_enabled` is on (an older backend without that capability reads as off), or
while it is off but a cached publication exists, labelled "Collection off · cached results". An
enabled scan with no matches still shows its coverage line. Filters live in the URL as
`squeeze_status`, `squeeze_sort` and `squeeze_page`; invalid values fall back to matches / daily
move / page 1, and changing a filter resets only `squeeze_page`. Mounting the section issues GET
requests only.

Rows name the price branch that qualified ("Daily gain", "Closed at prior high" or both), warn when
a gain match touched the prior high and closed below it ("High touched; closed below") or the
short-interest report date is unavailable, and show volume as "Completed session volume".
**Inspect** opens the frozen condition checklist, provenance, the reference high (with the closing
distance only when the session reached it; a stored v1 row shows its touch condition), and the
recorded outcomes measured from the first close after discovery; the detail never shows a previous
selection's evidence while a new one loads.

From a matched evaluation, **Save setup** asks for one watchlist (an explicit checkbox is required
to replace that list's current setup, and an explicit button creates a list when none exist), then
opens the shared setup form prefilled long, five-session swing, with the dated signal close as an
editable entry. Stop and target are entered by the user; **Use 8% target** proposes `entry × 1.08`
only on request and stops following the entry once the target is edited. A corrected source needs a
review checkbox before saving. The request carries `strategy_observation_id`; nothing is created
until Save.

Research Performance offers a **Short Squeeze Strategy** source (no origin filter) with the
measurement note, a recorded-rows drill-down showing signal and baseline sessions, and the same CSV
export filters. Research health shows the scanner's collection state, latest publication, coverage
and warm-up checkpoints.

## Summary-first SEC tabs

The ticker's Commitments and Filings tabs open with a compact business-impact card: explicit
Positive, Negative, Neutral, Mixed, or Unavailable status; confidence; up to three key factors;
and a few decision-useful facts. This is business impact, not a buy/sell recommendation.

Mounting either tab reads saved summaries only. The single **Refresh analysis** button runs the
complete backend workflow and keeps the last useful result visible if refresh fails. Commitment
Ledger, Sources, manual entry, and the data-quality Review queue remain under **Evidence &
Advanced**. Filing references, Compare/Explain tools, filters, and raw diffs remain under
**Evidence & All Changes**; the raw change page is not requested until that disclosure opens.

Live collection is controlled by the backend's `REDDIT_INTELLIGENCE_ENABLED` flag. When disabled,
the UI continues to show cached Reddit content and explains why refresh actions are unavailable.
The Reddit auth banner polls every 30 seconds. During automatic recovery it shows that
authentication is being repaired while cached discussions remain available; after a failed
attempt it shows the recovery cooldown timestamp. A valid state removes the recovery copy.

Post collection is intentionally faster than sentiment classification. Newly collected posts may
briefly render without a sentiment badge; feed and ticker-search queries use the backend's
`sentiment_pending` flag to refresh the existing cache every 30 seconds, then stop polling as soon
as classification is complete. Cached posts remain rendered throughout that transition. Opening
or refreshing one discussion loads at most 25 comments for that post, and comments do not receive
sentiment labels.

## Development checks

```bash
npm install
npm test
npm run lint
npm run build
```

The frontend never runs `rdt-cli` directly and never receives or stores Reddit browser
credentials. Backend setup, recovery, retention, and read-only operational guidance live in the
sibling backend's `docs/reddit-intelligence-runbook.md`.

## AI Settings and AI Research tab

`/ai-settings` selects independent provider/model profiles for research and summarization. Only
the OpenRouter catalog is discovered dynamically; local and Anthropic model IDs remain editable
text. Provider cards show configured status, but the frontend never fetches, renders, stores, or
submits API key values.

Each ticker's AI Research tab shows a Google Finance Research card above the unchanged
MarketScout Structured Report. The card is experimental and single-turn: it opens with a
ticker-aware default question, submits one edited question at a time, and renders the latest
answer as Markdown with the external sources Google cited (all links open in a new tab with
`rel="noopener noreferrer"`). Nothing is cached or persisted — a second submission replaces the
first result, and changing ticker resets the card. It costs no MarketScout LLM tokens.

When the backend reports `source.ok=false` or the request itself fails, the card shows the bounded
error, keeps the question editable, and always offers a direct link to Google Finance's own
Research page. The structured report below it — generate, refresh, live progress, and saving an
AI setup — is unchanged and independent.

## Vite notes

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
