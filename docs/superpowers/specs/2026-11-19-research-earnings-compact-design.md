# Research page: compact earnings section

Date: 2026-11-19. Small change, approach A approved by the owner.

## Why

Each earnings company (NVDA, AMAT under Recent results) rendered as a full card:
consensus block, 13 ragged figure boxes with near-duplicates, and the findings tabs
all open at once. Two finished events took about 1.5 screens. The owner wants each
company readable at a glance, with detail only on request.

## Goals

- One line per company: ticker, date, BMO/AMC, the headline answer (EPS and revenue
  beat/miss vs consensus, guidance vs consensus), and status.
- Click a row to open its detail in place; everything starts collapsed.
- Figures as a tidy table instead of wrapped boxes.
- A compact company picker.

## Non-goals

- No backend or API change; no new data (no company names or consensus on candidates).
- The other Research sections (Research First, Fresh catalysts, Short squeeze) are
  untouched.

## Approaches

- **A. Collapsible rows (picked).** One line per company; the detail opens in place.
  Least space, keeps detail on the page, works at phone width.
- B. Table plus side drawer. Most compact, but poor on phones and the drawer hides
  the page.
- C. Trimmed cards. Smallest change, but still a card per company, so little space saved.

## Design

- **Row header** (live monitors and recent results alike): chevron, ticker, short date
  and BMO/AMC, then headline metrics: `EPS $2.68 Beat +6.1%`,
  `Revenue $115.84B Beat +4.1%`, and a guidance verdict (consensus below the guided
  range reads "above consensus"). Without consensus, the first line of the analysis
  summary; for a monitor with no release yet, its check window and next check. Status
  on the right with a colored dot. The whole header toggles; a real button with
  `aria-expanded` carries keyboard use.
- A monitor error stays visible under the header while the row is collapsed.
- **Opened row:** schedule and check times (monitors), release links, consensus
  detail, analysis summary, figures table, the Guidance/Highlights/Developments/Risks
  tabs.
- **Figures table:** one row per metric and period, with Reported and Adjusted columns
  (one Value column when no adjusted figure exists). Dollar totals stated in
  thousand/million/billion read as compact amounts (`$115.84B`); other values keep the
  release's wording. The same figure stated twice (equal value, same column) is shown
  once, preferring the copy with a year-ago value. Year-over-year change sits under each
  value. Clicking a row opens its stated values, year-ago values and source evidence.
- **Guidance facts:** a list in the Guidance tab, each opening to its evidence.
- **Picker:** a pill per company (checkbox, ticker, BMO/AMC, "Confirmed" when the date
  is confirmed), today and tomorrow each on one wrapped line. The duplicate "No releases
  being monitored" card is removed.

## Left to the builder

Exact spacing, colors and copy, within the existing shadcn/Tailwind tokens.
