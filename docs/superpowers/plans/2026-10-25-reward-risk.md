# Reward/risk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic reward/risk summaries to AI reference levels, saved setups, and setup editing.

**Architecture:** A pure TypeScript helper validates geometry and calculates distances. A shared responsive React component formats the helper's results and keeps comparison prices separate. Existing pages supply already-available values; nothing is persisted or fetched by the new component.

**Tech Stack:** React, TypeScript, existing Tailwind/shadcn components, Vitest/Testing Library, existing Python Playwright for browser verification.

**Spec:** `docs/superpowers/specs/2026-10-25-reward-risk-design.md`

## Global Constraints

- No API/schema changes, provider calls, saved-price mutation, automatic trade grading, or minimum-ratio gate.
- Preserve original entry anchors and calculate primary/secondary entries independently.
- Show unavailable states for missing, nonpositive, nonfinite, equal, incorrectly ordered, or numerically unrepresentable levels.
- Label AI snapshot comparisons `Report price comparison`; watchlist comparisons `Quoted price comparison` and use its displayed session price with regular-price fallback.

## Review Focus

- Bearish research with inverted long/short references must not produce positive-looking invalid ratios.
- A quote at or beyond a stop/target must not silently become a new saved entry.
- Tiny valid price distances must remain visible rather than display `$0.00` or `0.00 : 1`.
- Secondary-only and incomplete reference data must expose unavailable states without hiding the valid independent row.
- Narrow layouts and duplicate/repeated summaries must remain readable and accessible.

## Task 1: Calculation

Files: `src/lib/reward-risk.ts`, `src/lib/reward-risk.test.ts`.

Interface: `calculateRewardRisk({entry, stop, target, side?})` returns an available result (`side`, `stopDistance`, `stopDistancePct`, `targetDistance`, `targetDistancePct`, `rewardRisk`) or an unavailable result with a reason. `RewardRiskLevels` describes the existing entry/stop/target shape.

- [x] Add cases: long 100/96/112 => 4, 4%, 12, 12%, 3; short 100/104/88 => the same distances; entry 98 => ratio 7; entry 106 => ratio 0.6; explicit-side conflict; equal/beyond levels; null/zero/negative/NaN/Infinity; overflow; tiny finite distances. Verify failure before implementation.
- [x] Implement the pure helper without rounding intermediate math or modifying inputs. Verify its tests pass.

## Task 2: Shared display and integration

Files: `src/components/shared/reward-risk-summary.tsx` and its test, `price-reference-ladder.tsx` and its test, `watchlists-page.tsx` and its test, `setup-form-dialog.tsx` and its test.

Interface: `RewardRiskSummary({levels, side?, comparison?})`, where `comparison` contains `label` and `price`. No effects, fetching, or saved state.

- [x] Write failing UI tests for separate primary/secondary/comparison anchors, quote-only rerenders, missing/invalid levels, short geometry, and tiny formatted values.
- [x] Add the shared component and verify its tests pass.
- [x] Write failing integration tests for AI references, expanded saved setups, and form changes before saving.
- [x] Wire all three surfaces, retaining existing price labels, notes, save behavior, and source semantics. Verify focused integration tests pass.

## Task 3: Verification and delivery

- [x] Run `npm test`, `npm run lint`, and `npm run build`; inspect actual exit status and summaries. 999 tests pass; lint has only existing fast-refresh warnings; production build succeeds with its existing chunk-size advisory.
- [x] Browser plugin not available: use the already installed Playwright runtime. Check the isolated frontend on localhost:5174, then the delivered checkout on localhost:5173, with intercepted fixture responses and no live research or external operations.
- [x] Verify AI report generation from fixture data, watchlist expansion, form entry/stop edits, separate quote comparison, missing/invalid states, and desktop/mobile overflow. Final tracked-stock checks pass at 1280, 390 and 320 pixels with no console errors or failed responses. Screenshots are outside the repository. An existing untracked-ticker header button exceeds a 320-pixel viewport by about 3 pixels; the new summary fits and the existing header was not modified.
- [x] Obtain a read-only fresh-context review of the finished branch. No critical or important defects were found. Add contextual region labels and a failing-then-passing two-ticker regression for the accessibility finding.
- [x] Apply the verified patch to the user's original frontend checkout as local changes, preserving its branch. Delivered verification: 126 test files / 1000 tests pass; lint and production build exit 0 with only existing advisories.
