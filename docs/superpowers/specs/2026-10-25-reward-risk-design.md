# Reward/risk summaries

The user approved adding the first proposed improvement on 2026-10-25: deterministic reward/risk calculations beside MarketScout's existing research price references and saved setups.

## Behavior

- Show dollar and percentage distance to stop, dollar and percentage distance to target, and reward/risk (target distance divided by stop distance) separately for primary and optional secondary entries.
- Use direction-aware long/short arithmetic. Saved/manual setups supply their side; AI reference direction is inferred from stop/target geometry rather than the research lean.
- Keep original entries as the calculation anchors. A separately labelled report-price or quoted-price comparison never substitutes for a saved entry.
- Reject missing, nonpositive, nonfinite, equal, incorrectly ordered, or numerically unrepresentable levels. Show an explicit unavailable explanation rather than negative ratios, NaN, or Infinity.
- Surface the summary in the AI price-reference card, expanded saved-watchlist details on desktop/mobile, and the manual setup editor as levels change.
- Use existing prices, styles and components. No API/schema changes, provider calls, saved-price mutation, automatic trade grading, or minimum-ratio gate.
- Explain that these are price distances before costs, not a target probability or guaranteed loss limit.

## Approaches

The implementation choice is a shared frontend calculation and display component: existing responses already contain the required inputs. Server-derived fields would unnecessarily expand the API; AI arithmetic would make a deterministic calculation unreliable. The user's approval covers the visible feature; this frontend implementation is the implementer's choice.

## Validation

Prove long and short math, both entry anchors, current-price separation, invalid/missing/overflow behavior, live form updates, integration with saved setups, and responsive rendering. Preserve research-only semantics and existing form/save behavior.
