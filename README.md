# MarketScout Frontend

React/TypeScript frontend for MarketScout. The Reddit workspace at `/reddit` provides a cached
feed, explicit ticker searches, trusted subreddit and author sources, and bounded discussion
threads. Each ticker also has an independent Reddit tab and monitoring control; Twitter and
Reddit evidence remain separate in AI research.

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
