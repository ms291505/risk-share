# REQUIREMENTS

## 1. Purpose & principles

1. This web app helps business users quickly create estimates of the financial
   terms of risk share arrangements.
1. Core features should be self-evident; users should not need to read a
   manual to do core tasks.
1. Core features should be easy to see. Complex features (tiers, caps,
   minimums, currency thresholds, sensitivity sweeps, tag filters) must not be
   buried, but should reveal themselves as the user explores the app
   (progressive disclosure).
1. Onboarding is acceptable if it's fast, and must be opt-in. It consists of a
   "Show me" action that loads a worked example and runs a brief (3–5 step),
   dismissible tour of the key areas.
1. React single-page app. No server: all data lives in the browser and in
   files the user exports. Desktop/laptop first; must be usable on a tablet.
   Phone layout is not a priority.

## 2. Workspace

1. The app has a single workspace containing: workspace settings, the two
   parties, terms, amount sets, scenarios, saved sensitivity sweeps, saved
   filter views, and workspace notes.
1. Workspace settings include the currency/locale (selectable; one currency
   per workspace). Currency formatting and minor units (e.g. cents, or none for
   JPY) follow the selected currency.
1. Workspace notes support basic markdown (bold, italics, lists, links).

## 3. Parties

1. An arrangement has exactly two parties, with fixed roles:
   - **Risk-bearer**: receives revenue and pays expenses on behalf of the
     counterparty (e.g. Lisa).
   - **Counterparty**: the party on whose behalf the risk-bearer operates
     (e.g. Bob).
1. Users can name both parties. Results always show direction clearly
   (who pays whom).

## 4. Amounts (additions & deductions)

1. Gain or loss = total additions − total deductions. Positive is a gain;
   negative is a loss.
1. Additions and deductions are composable: users can enter a total directly
   or enter named components that sum to it.
1. Users can name the components.
1. Individual components may be negative (e.g. rebates within deductions).
1. Total additions must be > 0. If not, entry is blocked with a validation
   error and no results are calculated for that amount set (gain/loss and cost
   ratio are both meaningless without valid additions). Total deductions may be
   zero or negative.
1. Each addition component can be tagged **paid by counterparty** (e.g.
   premiums or fees Bob pays Lisa). Untagged additions are treated as
   third-party revenue. This tag is used only for net position (§7).
1. An **amount set** is a named, reusable collection of additions and
   deductions.

## 5. Cost ratio

1. Cost ratio (CR) = total deductions ÷ total additions.
1. CR is rounded to a precision configured **per set of terms** (default: 3
   decimals, e.g. 0.801 → 80.1%).
1. Rounding mode is configured **per set of terms**: half up (default),
   banker's (half to even), or truncate.
1. CR is always displayed to its full configured precision so it's clear it has
   been rounded (e.g. 0.700 → 70.0%, not 70%).
1. Settlements are calculated from the **rounded** CR, so the math matches
   what the user sees.

## 6. Terms

### 6.1 Structure

1. A **set of terms** is named and has one threshold unit for the whole set:
   - **Cost ratio**: thresholds are CR percentages.
   - **Currency**: thresholds are gain/loss amounts (additions − deductions).
1. Terms have a **gain side** and/or a **loss side**:
   - **Gain share**: only a gain side. The risk-bearer refunds a share of the
     gain beyond the threshold to the counterparty. Past the threshold on the
     loss side no money changes hands; the risk-bearer absorbs 100% of losses.
   - **Full risk share**: both sides. Between the gain and loss thresholds
     is a neutral corridor where no payment is made.
1. Thresholds are nameable. Default names: "Gain share threshold" and
   "Loss share threshold".
1. Each side has one or more thresholds. Each threshold has a share % (0–100%)
   that the paying party pays on the band from that threshold to the next one.
   The last threshold's band is open-ended. To stop sharing beyond a point,
   add a threshold with 0%.
1. Tiers are **marginal** (like tax brackets): each share % applies only
   to its own band, so the settlement is continuous as CR changes.

### 6.2 Settlement calculation

Cost ratio terms:

- Gain side (CR below threshold): risk-bearer pays counterparty
  Σ(share % × CR points within band) × total additions.
- Loss side (CR above threshold): counterparty pays risk-bearer
  Σ(share % × CR points within band) × total additions.

Currency terms: the same, except bands are measured in currency gain (or loss)
amounts and are not multiplied by additions.

Order of operations per side:

1. Compute the tiered amount.
1. Apply the minimum payout (if any).
1. Apply caps (if any). When both caps are set, the lower one wins.
1. Round the final settlement to the currency's minor unit (half up).

### 6.3 Optional limits (per side)

These are optional add-ons, set separately for the gain side and the loss
side:

1. **Max payout (currency)**, e.g. never more than $250,000.
1. **Max payout as % of total additions**, e.g. never more than 5% of revenue.
1. **Minimum payout**, with a user-selected behavior:
   - *Threshold*: below the minimum, pay $0; at or above it, pay the full amount.
   - *Deductible*: subtract the minimum from the amount (floored at $0).

### 6.4 Validation (blocking)

1. Gain-side and loss-side bands must not overlap (in CR terms, every gain
   threshold ≤ every loss threshold).
1. Tiers within a side must be strictly ordered.
1. Share % must be between 0% and 100%.
1. Caps must be ≥ the minimum payout when both are set.

### 6.5 Worked examples (acceptance tests)

All examples use total additions of $1,000,000.

1. **Gain share**: Lisa (risk-bearer) receives revenue and pays expenses on
   behalf of Bob. If CR is below 85.0%, Lisa refunds Bob 100% of the
   difference.
   - CR 80.0% → Lisa pays Bob 100% × 5.0 pts × $1,000,000 = **$50,000**.
   - CR 90.0% → **$0**; Lisa absorbs the loss.
1. **Full risk share**: if CR is above 101.0%, Bob pays Lisa 30% of the
   difference. If CR is below 99.0%, Lisa refunds Bob 50% of the difference.
   - CR 105.0% → Bob pays Lisa 30% × 4.0 pts × $1,000,000 = **$12,000**.
   - CR 95.0% → Lisa pays Bob 50% × 4.0 pts × $1,000,000 = **$20,000**.
   - CR 100.0% → **$0** (corridor).
1. **Tiered gain share**: 50% from 85.0% down to 80.0%, 80% from 80.0% down to
   75.0%, 0% below 75.0%.
   - CR 70.0% → (50% × 5.0 + 80% × 5.0) pts = 6.5 pts × $1,000,000 =
     **$65,000**.
1. **Currency gain share**: Bob receives 50% of gain above $100,000.
   - Gain $180,000 → 50% × $80,000 = **$40,000**.
1. **Rounding**: deductions $800,500 / additions $1,000,000 = 0.8005 →
   0.801 (half up), 0.800 (banker's), 0.800 (truncate).

### 6.6 Plain-English summary

1. Each set of terms shows an auto-generated plain-English summary, worded
   like the examples in §6.5, that updates live as the terms are edited. For
   example: "If the cost ratio is below 85.0%, Lisa pays Bob 100% of the
   difference × total additions, up to $250,000."
1. The summary uses the party names, threshold names, tiers, minimums, and
   caps, so users can check their setup at a glance.
1. The summary is included in print/PDF exports.

### 6.7 Templates

The app ships with starter templates: the gain share example (85.0%), the
full risk share example (99.0% / 101.0%), and blank.

## 7. Results

For each scenario, show:

1. Total additions, total deductions, gain/loss, and the rounded cost ratio.
1. The settlement amount and direction (who pays whom).
1. **Net position** per party:
   - Risk-bearer = additions − deductions − settlement paid + settlement
     received.
   - Counterparty = −(additions tagged *paid by counterparty*) + settlement
     received − settlement paid.
1. A **show-the-math** breakdown, step by step (CR before and after rounding,
   each tier's band and amount, minimum, caps, final rounding), for
   auditability.

## 8. Scenarios & comparison

1. A **scenario** pairs one set of terms with one amount set. Users can:
   - compare different terms on the same amounts,
   - compare one set of terms across different amounts,
   - or combine both.
1. The comparison view should comfortably handle a handful of scenarios and
   scale to larger grids (10+) with a dense table/matrix layout.
1. Scenarios have a name, optional markdown notes, any number of **tags**, and
   a per-scenario hide toggle.
1. Terms, amount sets, and scenarios can be duplicated.

### 8.1 Visibility & tag filters

1. Everything is visible by default.
1. The user builds a filter by selecting tags as **show** or **hide**:
   - *Show* tags have a match **any / all** toggle. With no show tags
     selected, everything is shown. With show tags selected, untagged
     scenarios are hidden.
   - *Hide* tags always win: a scenario with any hide tag is hidden.
   - Example: "show *Optimistic*, hide *Current threshold*".
1. A manual per-scenario hide always wins over the filter.
1. Hidden scenarios are removed from comparison tables and charts but remain
   listed, dimmed, in the sidebar so they can be toggled back.
1. Users can save named filter views (e.g. "Board deck") and switch between
   them.
1. Exports follow the current visibility.

## 9. Sensitivity view

1. A separate view (scenarios are not used here) for sweeping one input across
   a range.
1. The user picks one amount set as the baseline, one or more sets of terms
   (one line/series per terms set), and the variable to sweep: total
   additions, total deductions, or any single component.
1. Ways to define the range:
   - min / max / step in currency;
   - ±% around the baseline value, with a step;
   - a cost ratio range (e.g. 70%–110% by 1 pt) that holds additions and
     derives deductions.
1. A sweep is capped at 200 points. If the range exceeds the cap, the app says
   so and asks the user to increase the step.
1. Sweeps are named and saved, so a user can keep several and return to them.

## 10. Charts

1. **Settlement vs. cost ratio** (line): payout to each party across CR, with
   thresholds and corridor marked. Used to understand terms and in the
   Sensitivity view.
1. **Scenarios compared** (bar): settlement per visible scenario.
1. **Net position per party** (bar).
1. **Waterfall**: additions → deductions → gain/loss → settlement → net
   position.

## 11. Persistence, import & export

1. Auto-save the workspace to browser storage (localStorage). Saved data
   survives a reload on the same browser and device.
1. Export and import the whole workspace as a JSON file, including notes,
   tags, saved sweeps, and filter views. The file includes a schema version.
   Importing replaces the current workspace after a confirmation, which offers
   to export the current workspace first.
1. No URL-based sharing. Data never leaves the browser except through files the
   user exports.
1. Results export:
   - CSV of specific results (a scenario comparison table or sweep table);
   - print/PDF via a print-friendly page with terms, results, charts, and
     notes;
   - each chart as PNG, as SVG, or copied to the clipboard.

## 12. Editing

1. Undo/redo across all edits (Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z).

## 13. Confirmed decisions

These were assumptions the user confirmed during the requirements interview.

1. Party names, currency, and the paid-by-counterparty tag are set
   per workspace, not per set of terms.
1. A threshold's share % applies to the band from that threshold to the next;
   the last band is open-ended (add a 0% threshold to stop).
1. The minimum payout is applied before caps, so a cap is always the true
   maximum paid.
1. Threshold inputs use the same decimal precision as the terms' CR
   precision.
1. When an amount set or terms is deleted, the scenarios that use it are
   flagged and the user confirms before they are deleted too.
