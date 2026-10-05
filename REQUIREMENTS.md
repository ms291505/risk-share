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
   - Because there is a single workspace (§2), "Show me" **replaces** the
     current workspace using the same flow as import (§11.2): confirm, offer
     to export the current workspace first, then load. It is undoable (§12).
     On an empty workspace no confirmation is needed.
1. React single-page app. No server: all data lives in the browser and in
   files the user exports. Desktop/laptop first; must be usable on a tablet.
   Phone layout is not a priority.
1. Supported browsers: the latest two major versions of Chrome, Edge,
   Firefox, and Safari (macOS and iPadOS). Other browsers show a dismissible
   "unsupported browser" notice but are not blocked. The notice is based on
   feature detection, not the user agent: exact amount formatting needs
   `Intl.NumberFormat` to format decimal strings without converting them to
   floating point.
1. **Landing view.** With an empty workspace (no terms, amount sets, or
   scenarios), the app opens on a welcome view offering "Show me" (§1.4),
   "Start from a template" (§6.7), and "Import a workspace" (§11.2).
   Otherwise it opens on Scenarios.
1. **Appearance.** Users can choose light, dark, or follow the system. The
   choice is remembered per browser, like the active filter (§8.1.7); it is
   not part of the workspace export and is not undoable.

## 2. Workspace

1. The app has a single workspace containing: workspace settings, the two
   parties, terms, amount sets, scenarios, saved sensitivity sweeps, saved
   filter views, and workspace notes.
1. Workspace settings include the currency and locale (selectable; one
   currency per workspace). Currency formatting and minor units (e.g. cents,
   or none for JPY) follow the selected currency. Party names (§3) are also
   workspace-level, shared by all terms.
1. **Changing currency** relabels amounts; there is no FX conversion. Every
   stored amount keeps its value and is rounded (half up) to the new currency's
   minor unit. Before applying, a confirmation says how many values will be
   rounded. The change is undoable.
1. **Number entry** follows the workspace locale's decimal and grouping
   separators (e.g. `1.000,50` in a German locale). Input that can't be parsed
   unambiguously shows an inline error rather than guessing.
1. Currency amounts are entered and stored to the currency's minor unit (no
   fractional cents).
1. Workspace notes support basic markdown (bold, italics, lists, links).
1. **New workspace defaults**: currency USD, the browser's locale, and party
   names "Risk-bearer" and "Counterparty".

## 3. Parties

1. An arrangement has exactly two parties, with fixed roles:
   - **Risk-bearer**: receives revenue and pays expenses on behalf of the
     counterparty (e.g. Lisa).
   - **Counterparty**: the party on whose behalf the risk-bearer operates
     (e.g. Bob).
1. Users can name both parties. Results always show direction clearly
   (who pays whom).
1. Party names are trimmed of leading/trailing spaces, must be non-empty, are
   at most 80 characters (counting each emoji, even a combined one like a
   flag, as one), and must differ from each other (ignoring case). Invalid
   names are saved and remain editable, with inline errors (as in §4.7).

## 4. Amounts (additions & deductions)

1. An **amount set** is a named, reusable collection of additions and
   deductions.
1. Gain or loss = total additions − total deductions. Positive is a gain;
   negative is a loss.
1. Additions and deductions are composable: users can enter a total directly
   or enter named components that sum to it. Additions and deductions each
   choose their mode independently.
   - Switching from components to a total starts the total at the
     components' sum. The components are kept but inactive, and switching
     back restores them.
   - Switching from a total to components starts with one component equal to
     the total.
   - Inactive components are not used in calculations and cannot be chosen
     as a sweep variable (§9.2).
1. Individual components may be negative (e.g. rebates within deductions).
1. Total additions must be > 0 (see §4.7 for how invalid data behaves). Total
   deductions may be zero or negative.
1. **Paid by counterparty.** Part of the additions may be paid by the
   counterparty (e.g. premiums or fees Bob pays Lisa). The rest is treated as
   third-party revenue. This amount is used only for net position (§7).
   - With components: each addition component can be marked *paid by
     counterparty*; the amount is the sum of marked components. (This is a
     per-component checkbox, not a scenario tag; see §8.2.)
   - With a total only: an optional *paid by counterparty* amount field
     (must be ≤ total additions).
   - The counterparty-paid amount must be between 0 and total additions.
   - If it is zero, the counterparty's net position shows a hint that no
     counterparty-paid additions have been entered.
1. **Invalid amount sets** are saved and remain editable, with inline errors.
   Any scenario or sweep point that uses an invalid amount set shows "—"
   instead of results, with the reason. (A new amount set starts at additions
   = 0 and is therefore invalid until filled in.)

## 5. Cost ratio

1. Cost ratio (CR) = total deductions ÷ total additions, shown as a percentage.
1. CR precision is configured **per set of terms** as the number of decimal
   places in the percentage (default **1**, e.g. 80.1%).
1. Rounding mode is configured **per set of terms**: half up (default),
   banker's (half to even), or truncate. For negative CRs, half up rounds
   halves away from zero and truncate rounds toward zero.
1. CR is always displayed to its full configured precision so it's clear it has
   been rounded (e.g. 70.0%, not 70%).
1. For cost ratio terms, settlements are calculated from the **rounded** CR,
   so the math matches what the user sees. Currency terms (§6.1) use gain or
   loss directly and are unaffected by CR rounding.
1. CR threshold inputs use the same precision as the terms' CR precision. If the
   precision is lowered and existing thresholds have more decimals, the app
   lists the thresholds that will change (e.g. 85.55% → 85.6%) and requires
   confirmation before rounding them. The change is undoable.
1. **All calculations use exact decimal arithmetic**, not binary floating
   point. (In floating point, 800,500 ÷ 1,000,000 evaluates to 0.80049999…,
   which would make acceptance test §6.6.8 fail.)

## 6. Terms

### 6.1 Structure

1. A **set of terms** is named and has one threshold unit for the whole set:
   - **Cost ratio**: thresholds are CR percentages.
   - **Currency**: gain-side thresholds are gain amounts and loss-side
     thresholds are loss amounts, both entered as non-negative numbers (e.g.
     "loss above $50,000" is entered as 50,000).
1. There are three types of terms:
   - **Gain share**: gain side only. The risk-bearer refunds a share of the
     gain beyond the threshold to the counterparty. The risk-bearer absorbs
     all losses; no money moves on a loss.
   - **Loss share**: loss side only. The counterparty pays the risk-bearer a
     share of the loss beyond the threshold. The risk-bearer keeps all gains.
   - **Full risk share**: both sides. Between the gain and loss thresholds is
     a neutral corridor where no payment is made.
1. Each side has one or more thresholds (tiers). Each threshold has a name
   and a share % (0–100%) that the paying party pays on the band from that
   threshold to the next one, moving away from break-even. The last band is
   open-ended. To stop sharing beyond a point, add a threshold with 0%.
1. Default threshold names: "Gain share threshold" and "Loss share
   threshold"; additional tiers are numbered ("Gain share threshold 2", …).
1. Tiers are **marginal** (like tax brackets): each share % applies only to
   its own band, so the settlement is continuous as CR changes.
1. On the signed scale used by charts, a payment to the counterparty is
   positive and a payment to the risk-bearer is negative. The y-axis is
   labeled with party names at both ends: "↑ Lisa pays Bob" above the plot and
   "↓ Bob pays Lisa" below it. The labels are part of the chart image, so
   exports (§11.4) keep them.

### 6.2 Settlement calculation

A **CR point** is one percentage point of CR (1 pt = 0.01).

Cost ratio terms:

- Gain side (CR below a gain threshold): risk-bearer pays counterparty
  Σ(share % × band width in CR points ÷ 100) × total additions.
- Loss side (CR above a loss threshold): counterparty pays risk-bearer
  Σ(share % × band width in CR points ÷ 100) × total additions.

Currency terms: the same, except bands are measured in currency gain (gain
side) or loss (loss side) amounts and are not multiplied by additions.

Order of operations per side:

1. Compute the tiered amount.
1. Apply the minimum payout (if any).
1. Apply caps (if any). When both caps are set, the lower one wins. Caps are
   applied after the minimum, so a cap is always the true maximum paid.
1. Round the final settlement to the currency's minor unit (half up).

### 6.3 Optional limits (per side)

These are optional add-ons, set separately for the gain side and the loss
side. All are currency amounts except where noted.

1. **Max payout (currency)**, e.g. never more than $250,000.
1. **Max payout as % of total additions**, e.g. never more than 5% of revenue.
1. **Minimum payout**, with a user-selected behavior:
   - *All-or-nothing*: below the minimum, pay $0; at or above it, pay the
     full amount.
   - *Deductible*: subtract the minimum from the amount (floored at $0).
1. If the %-of-additions cap works out lower than the minimum payout for a
   given amount set, the cap still wins. The result shows a non-blocking
   warning, which is explained in show-the-math (§7.4).

### 6.4 Validation

Invalid terms are saved and remain editable, with inline errors (same
behavior as §4.7). Any scenario or sweep using them shows "—" instead of
results. Validation that depends on ordering runs when a field loses focus,
not on every keystroke, so users aren't interrupted mid-entry.

1. Cost ratio terms: every gain threshold ≤ 100% and every loss threshold ≥
   100%. (This also guarantees the gain and loss sides never overlap.)
1. Currency terms: every threshold ≥ 0.
1. Tiers within a side must be strictly ordered moving away from break-even
   (gain-side CR thresholds descending; loss-side CR thresholds ascending;
   currency thresholds ascending).
1. Share % must be between 0% and 100%.
1. The max payout (currency) must be ≥ the minimum payout when both are set.
   (The %-of-additions cap is checked at calculation time; see §6.3.4.)

### 6.5 Plain-English summary

1. Each set of terms shows an auto-generated plain-English summary, worded
   like the examples in §6.6, that updates live as the terms are edited. For
   example: "If the cost ratio is below 85.0%, Lisa pays Bob 100% of the
   difference × total additions, up to $250,000."
1. The summary uses the party names, threshold names, tiers, minimums, and
   caps, so users can check their setup at a glance.
1. The summary is included in print/PDF exports.

### 6.6 Worked examples (acceptance tests)

Unless stated otherwise, all examples use total additions of $1,000,000 and
the default CR precision (1 decimal, half up).

1. **Gain share**: Lisa (risk-bearer) receives revenue and pays expenses on
   behalf of Bob. If CR is below 85.0%, Lisa refunds Bob 100% of the
   difference.
   - CR 80.0% → Lisa pays Bob 100% × 5.0 pts ÷ 100 × $1,000,000 =
     **$50,000**.
   - CR 90.0% → **$0**; the CR is above the threshold, so Lisa keeps the
     whole gain.
   - CR 105.0% → **$0**; Lisa absorbs the loss.
1. **Loss share**: if CR is above 105.0%, Bob pays Lisa 50% of the
   difference.
   - CR 110.0% → Bob pays Lisa 50% × 5.0 pts ÷ 100 × $1,000,000 =
     **$25,000**.
   - CR 95.0% → **$0**; Lisa keeps the gain.
1. **Full risk share**: if CR is above 101.0%, Bob pays Lisa 30% of the
   difference. If CR is below 99.0%, Lisa refunds Bob 50% of the difference.
   - CR 105.0% → Bob pays Lisa 30% × 4.0 pts ÷ 100 × $1,000,000 =
     **$12,000**.
   - CR 95.0% → Lisa pays Bob 50% × 4.0 pts ÷ 100 × $1,000,000 =
     **$20,000**.
   - CR 100.0% → **$0** (corridor).
1. **Tiered gain share**: 50% from 85.0% down to 80.0%, 80% from 80.0% down to
   75.0%, 0% below 75.0%.
   - CR 70.0% → (50% × 5.0 + 80% × 5.0) = 6.5 pts ÷ 100 × $1,000,000 =
     **$65,000**.
1. **Currency terms**:
   - Gain share: Bob receives 50% of gain above $100,000. Gain $180,000 →
     50% × $80,000 = **$40,000**, Lisa pays Bob.
   - Loss share: Lisa receives 50% of loss above $50,000. Loss $80,000 →
     50% × $30,000 = **$15,000**, Bob pays Lisa.
1. **Minimum payout** (gain share, 100% below 85.0%):
   - All-or-nothing, minimum $60,000: CR 80.0% → tiered $50,000 < $60,000 →
     **$0**. CR 78.0% → **$70,000**.
   - Deductible, minimum $10,000: CR 80.0% → $50,000 − $10,000 =
     **$40,000**.
1. **Caps** (gain share, 100% below 85.0%, max $250,000 and max 5% of
   additions):
   - CR 70.0% → tiered $150,000; caps $250,000 and $50,000 → **$50,000**.
1. **Rounding**: deductions $800,500 / additions $1,000,000 = 80.05% →
   80.1% (half up), 80.0% (banker's), 80.0% (truncate).
1. **Net position**: additions $1,000,000, of which $900,000 is paid by Bob;
   deductions $800,000; CR 80.0%; gain share 100% below 85.0%.
   - Settlement: Lisa pays Bob $50,000.
   - Lisa: $1,000,000 − $800,000 − $50,000 = **$150,000**.
   - Bob: −$900,000 + $50,000 = **−$850,000**.

### 6.7 Templates

The app ships with starter templates: the gain share example (85.0%), the
loss share example (105.0%), the full risk share example (99.0% / 101.0%),
and blank (user picks the type).

## 7. Results

For each scenario, show:

1. Total additions, total deductions, gain/loss, and the rounded cost ratio.
1. The settlement amount and direction (who pays whom).
1. **Net position** per party:
   - Risk-bearer = additions − deductions − settlement paid + settlement
     received.
   - Counterparty = −(additions paid by counterparty, §4.6) + settlement
     received − settlement paid.
1. A **show-the-math** breakdown, step by step (CR before and after rounding,
   each tier's band and amount, minimum, caps, final rounding, and any
   warnings such as §6.3.4), for auditability.

## 8. Scenarios & comparison

1. A **scenario** pairs one set of terms with one amount set. Users can:
   - compare different terms on the same amounts,
   - compare one set of terms across different amounts,
   - or combine both.
1. **Generate grid**: the user picks N sets of terms and M amount sets, and
   the app creates the N × M scenarios. Pairs that already exist are skipped.
   New scenarios are auto-named "‹Terms› · ‹Amount set›" and can optionally be
   tagged.
1. The comparison view should comfortably handle a handful of scenarios and
   scale to larger grids (10+) with a dense table layout, including a
   terms-by-amount-sets matrix.
1. Scenarios have a name, optional markdown notes, any number of **tags**, and
   a per-scenario hide toggle.
1. Terms, amount sets, and scenarios can be duplicated.
1. When an amount set or terms is deleted, the confirmation lists the affected
   scenarios (which are deleted too) and saved sweeps (see §9.7).
1. Scenarios can be reordered. Each scenario records when it was created, so
   reordering never changes which one is the "earliest-created" (§10.1).
   Scenarios created together (e.g. by Generate grid or "Show me") get
   increasing creation times in the order they're created. Any remaining tie,
   which only an imported file can have, goes to the lower id.

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
1. If the user changes the filter after selecting a saved view, the view's
   name shows "(modified)" and offers **Save**, **Save as new view**, and
   **Revert**. A saved view changes only when explicitly saved.
1. The active filter and selected view are remembered across reloads in this
   browser, but are not part of the workspace JSON export. Saved views are
   exported. Importing a file or using "Show me" clears the active filter.
   (The per-scenario hide toggle is scenario data and is exported, so
   manually hidden scenarios stay hidden after import.)
1. Whenever any scenario is hidden, the comparison view and print/PDF export
   show a persistent indicator, e.g. "Showing 6 of 10 scenarios · Filter:
   Board deck · 1 hidden manually". On screen it includes a one-click
   **Show all**, which clears the filter and leaves manually hidden
   scenarios hidden.
1. Results exports (CSV, print/PDF, charts; §11.4) follow the current
   visibility. The workspace JSON export (§11.2) always includes everything.

### 8.2 Tags

1. Tags are workspace objects. Only scenarios carry tags.
1. Tag names are case-insensitive: "Optimistic" and "optimistic" are the
   same tag, displayed with the spelling first entered. Names are trimmed of
   leading/trailing spaces, must be non-empty, and are at most 80 characters.
1. Typing in a scenario's tag field suggests matching existing tags; Enter
   creates a new tag if none matches.
1. A tag persists until explicitly deleted, even when no scenario uses it, so
   saved filter views don't silently change. Tags can also be created in the
   tag manager before any scenario uses them.
1. A **tag manager** panel lists every tag with the number of scenarios using
   it, and supports:
   - **Rename**: applies everywhere. Renaming to an existing tag's name
     merges the two, after a confirmation.
   - **Delete tag**: removes the tag from every scenario; the scenarios are
     otherwise unchanged.
   - **Delete tag and its scenarios**: also deletes every scenario that has
     the tag. Terms and amount sets are never deleted this way.
   - Each delete confirmation lists the affected scenarios (count and names)
     and saved filter views.
   - All tag manager actions are undoable.
1. Saved filter views reference tags by identity, so renames and merges carry
   through. When a tag is deleted, it is removed from any view that uses it;
   a view left with no tags is kept and shows everything.

## 9. Sensitivity view

1. A separate view (scenarios are not used here) for sweeping one input across
   a range.
1. The user picks one amount set as the baseline, one or more sets of terms
   (one series per terms set), and the variable to sweep: total additions,
   total deductions, or any single component.
1. Ways to define the range:
   - min / max / step in currency;
   - ±% around the baseline value, with a step;
   - a cost ratio range (e.g. 70%–110% by 1 pt). This holds additions fixed
     and derives total deductions; deduction components are ignored for the
     sweep, and the counterparty-paid amount is unchanged.
1. A sweep is capped at 200 points. If the range exceeds the cap, the app says
   so and asks the user to increase the step.
1. Cost ratio terms settle on the rounded CR (§5.5), so a series is flat
   across consecutive points that round to the same CR and then jumps (a
   staircase). This is expected. When the step is finer than a selected cost
   ratio terms set's CR precision (for currency sweeps, when consecutive
   points round to the same CR), the sweep view shows a non-blocking note
   next to the chart. For example: "Steps are finer than the 1-decimal CR
   precision of 'Gain share 85%', so its line moves in steps. Settlements
   use the rounded CR."
1. Output:
   - A chart with the swept variable on the x-axis (CR for CR-range sweeps,
     currency otherwise), plotting each terms set's signed settlement (§6.1.6).
     A toggle switches to plotting each party's net position instead.
     Tooltips show the resulting CR.
   - A sweep table (collapsed by default) with x, CR, settlement, direction,
     and net positions per terms set, exportable as CSV.
   - Points where the amounts are invalid (e.g. additions ≤ 0) show as gaps
     in the chart and "—" in the table.
1. Sweeps are named and saved, so a user can keep several and return to them.
   If something a sweep uses is deleted, the sweep is kept: deleted terms
   drop out of its series. A missing baseline amount set, a missing swept
   component, or no remaining terms marks the sweep **needs repair** until
   the user picks a replacement.

## 10. Charts

1. **Settlement vs. cost ratio** (line): signed settlement (§6.1.6) across CR,
   with thresholds and corridor marked. It appears in the terms editor and for
   CR-range sweeps. In the terms editor, the dollar amounts use a "Preview with
   additions of [amount]" field. It defaults to the total additions of the
   amount set in the earliest-created scenario that uses these terms, or
   $1,000,000 if there is none. It
   is a view setting, not saved data.
   - The x-axis is the cost ratio for cost ratio terms. For **currency
     terms** it is gain (+) / loss (−) in currency, so thresholds stay where
     they were entered when the preview additions change.
   - The range is automatic: 15 CR points beyond the outermost thresholds, or
     for currency terms half the span from the outermost loss threshold to
     the outermost gain threshold (including break-even) on each side. If
     every threshold is at break-even, the currency range is ±10% of the
     preview additions.
   - Deductions are never negative, so the cost ratio range never goes below
     0%, and a gain can't exceed the additions: the currency range stops at a
     gain equal to the preview additions. Gain
     thresholds beyond that don't set the range, and the chart's summary
     says they can't be reached with this preview.
1. **Scenarios compared** (bar): settlement per visible scenario.
1. **Net position per party** (grouped bar): both parties' net positions
   for each visible scenario.
1. **Waterfall** (one selected scenario): additions → deductions →
   gain/loss → settlement → net position.

## 11. Persistence, import & export

1. Auto-save the workspace to browser storage (localStorage). Saved data
   survives a reload on the same browser and device.
   - If storage is full or unavailable, the app shows a persistent warning
     and prompts the user to export the workspace to a file.
   - **One active tab**: if the app is opened in another tab on the same
     browser, the newest tab becomes the editor. Older tabs save any
     pending edits first, then go read-only and
     show a "Reload to edit" banner, so tabs never overwrite each other.
1. Export and import the whole workspace as a JSON file, including notes,
   tags, saved sweeps, and filter views. The file includes a schema version.
   - Importing replaces the current workspace after a confirmation, which
     offers to export the current workspace first.
   - Files from older schema versions are migrated, both on import and when
     loading from browser storage. Files from a newer version, or files that
     fail validation (including any timestamp that isn't valid ISO 8601),
     are rejected with an explanation, and the current workspace is left
     unchanged.
1. No URL-based sharing. Data never leaves the browser except through files the
   user exports.
1. Results export:
   - CSV of specific results (a scenario comparison table or sweep table),
     using `.` as the decimal separator and no grouping separators, whatever
     the locale;
   - print/PDF via a print-friendly page with terms, results, charts, and
     notes;
   - each chart as PNG, as SVG, or copied to the clipboard.

## 12. Editing

1. Undo/redo with Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z; Ctrl+Y also redoes on
   Windows.
1. While a text field is focused, these shortcuts use the browser's native
   in-field undo. Elsewhere they use app undo.
1. App undo covers all data changes, including deletes, import, "Show me",
   and currency or precision changes. It does not cover navigation, the
   active filter selection, chart preview settings, or the tour.
1. Undo history holds at least the last 100 steps and is not kept across
   reloads.
1. **Undo steps.** An edit to a text field (including number fields) is one
   undo step, committed when the field loses focus or Enter is pressed;
   Escape discards it. For §12.2, "text field" means text-entry inputs and
   text areas, not checkboxes, radio buttons, or other controls.
1. Undo/redo shortcuts are inactive while a dialog is open, and undo/redo is
   unavailable in a read-only tab (§11.1).

## 13. Accessibility

1. The app meets **WCAG 2.2 Level AA**.
1. **Keyboard**: every feature is usable by keyboard alone, including tier
   editing, tag filters and the tag manager, and the tour. Each chart is
   focusable, and its text summary and data table (§13.3) can be reached by
   keyboard; point-by-point navigation is not required. Focus is
   always visible. Dialogs trap focus while open and return it to the
   triggering control when closed.
1. **Charts**: each chart has a short text summary and an accessible table
   view of its data. For a continuous curve, the table lists its breakpoints
   (the ends of the range and each point where the slope changes) rather than
   every plotted point. Direction (who pays whom), thresholds, and corridors
   are never conveyed by color alone.
1. **Screen readers**: every input has a label, and validation errors are
   programmatically linked to their fields. Result changes, validation
   errors, and undo/redo are announced through polite live regions without
   stealing focus.
1. **Motion and zoom**: the tour and chart animations respect
   `prefers-reduced-motion`. The app remains usable at 200% browser zoom and
   in the operating system's dark and high-contrast (forced colors) modes.
1. **Navigation**: each view has a unique document title, and moving to a
   new view moves focus to its main heading.
