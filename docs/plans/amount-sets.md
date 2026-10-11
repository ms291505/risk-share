# Plan: number entry and the amount sets editor (§2.4, §2.5, §4)

## Context
The app saves reliably (see `persistence.md`), but users can only edit party names. Amount sets are the first input everything else depends on: scenarios (§8) and sweeps (§9). This step builds:

1. A **locale-aware number field**, which the terms editor will reuse.
2. The **amount sets editor**: list, create, duplicate, delete, totals or components, paid by counterparty, and live totals.

The calc layer already does the math (`evaluateAmountSet` in `web/src/calc/amounts.ts`), so this is mostly parsing, state helpers and UI.

Agreed with the user on 2026-10-10:
- **Unreadable number text** stays in the field with an inline error and is **not saved**. The saved value doesn't change. Escape, or leaving the page, shows the saved value again. No file format change.
- **Accepted extras:**
  - the workspace currency's symbol or code, so pasting "$1,000,000.00" works (other currencies are still an error)
  - accounting negatives: "(5,000)" → −5000
  - the Unicode minus "−" as well as "-"
  - no k/m/b suffixes
- **Cost ratio** in the editor is shown **exact and unrounded**, e.g. "Cost ratio 80.05% (before rounding)": up to 4 decimals, with ≈ when it's longer. Rounding belongs to each set of terms (§5).
- **Amount set names** follow the tag rules (trimmed, not empty, ≤ 80 characters, via `state/names.ts`). Duplicates are allowed. Name problems show inline but don't make the set invalid for calculations.

## Changed in review (PR #3)
The parts below are updated to match. In short:
- **Total vs. components is one-way.** "Split into components" turns a total into one component holding the total as entered. "Use a total instead…" asks first, removes the components and keeps their sum. Components are never kept inactive to be restored later.
- **Only components record what the counterparty paid.** Format v2 drops the optional total-mode amount; the v1 → v2 migration turns it into "Paid by ‹counterparty›" and "Other additions" components.
- **Party names everywhere:** "Paid by Bob", including undo labels and validation messages.
- **Accounting style:** the summary says "Gain (loss)", and negative amounts are in parentheses in every locale.

## What already exists (reuse it)
- `calc/amounts.ts`
  - `evaluateAmountSet(set, minorUnits)` returns totals or `Issue`s, with paths such as `['additions','components','<id>','amount']`, `['additions','total']`, and `['additions']` (additions ≤ 0, or counterparty-paid out of range).
  - `sumComponents`, for the sum when going from components to a total.
- `calc/costRatio.ts`: `computeCR`. Use its `unroundedPct` for the exact CR display.
- `calc/decimal.ts`: `isDecimalString`, `parseDecimal`, `decimalPlaces` and `D`. `calc/currency.ts`: `minorUnits`.
- `format/formatters.ts`: `makeFormatters`, which formats `Big` values exactly via Intl decimal strings. `format/useFormatters.ts` is its hook.
- `format/issues.ts`: all validation copy (`issueMessage`). New codes are added to `IssueCode` in `calc/types.ts`, as the name codes were.
- `state/names.ts`: `nameIssues` and `normalizeName`.
- `components/CommitTextField.tsx`: draft, commit on blur or Enter, Escape, and read-only.
- **Store:** `state/store.ts`, `update(label, recipe)`. The read-only convention for other controls is in `web/README.md`.
- `app/ReplaceWorkspaceDialog.tsx` and `components/useLastNonNull.ts`: the dialog pattern to copy for the delete confirmation.
- `app/announcer.ts`: `useAnnounce`.
- `calc/__fixtures__/builders.ts` for tests, and fast-check for property tests.

## Part 1: number entry (`web/src/format/numberInput.ts`)
**`parseNumberInput(text, { locale, currency? })`** returns `{ ok: true, value: DecimalString | '' }` or `{ ok: false, issue }`.

1. Get the locale's symbols from `Intl.NumberFormat(locale).formatToParts(-1234567.5)`: decimal, group, minus sign, and native digits.
2. Trim. Empty text returns `''` (an optional field left blank, or "Enter a number" from calc).
3. If `currency` is set, strip that currency's symbol, narrow symbol or ISO code from the start or end (taken from `formatToParts` with `style: 'currency'`).
4. Negatives: wrapped in parentheses, or a leading `-`, `−` (U+2212) or the locale's minus sign.
5. Normalize spaces: when the locale's group separator is a space (fr-FR uses U+202F), treat space, NBSP and U+202F alike. For de-CH, treat `'` and `’` alike. Map native digits to ASCII.
6. At most one decimal separator (the locale's own). `.5` → `0.5` and `5.` → `5`.
7. **Grouping must match the locale exactly:** if the integer part has group separators, it must equal Intl's `useGrouping: 'always'` formatting of that integer. This handles en-IN lakh grouping and rejects "1.5" in de-DE and "1,00" in en-US. Grouping is optional: "1000" is always fine.
8. Any other character is an error.
9. Output the canonical string: no grouping, leading zeros removed, the typed decimals kept, and `-0` → `0`. Too many decimals still parses; calc then reports `tooManyDecimals` (§2.5).

The single new issue code `unreadableNumber`, with `{ example, decimal }`, gives: *"Enter a number like 1.234,56. This workspace uses "," for decimals."*

**`formatNumberInput(value, { locale, minFractionDigits })`** is the display text. It's grouped, with at least `minFractionDigits` decimals (the minor unit for currency) and never fewer than the value has, so extra decimals stay visible. It's exact, using the same Intl decimal-string approach as `formatters.ts`. If `value` isn't canonical, it's shown unchanged.

## Part 2: the field components
- **`CommitTextField`:** add an optional `parse(text) => { ok: true, value } | { ok: false, error }`.
  - On commit, a failed parse keeps the draft and shows the error, and nothing is saved.
  - Escape, or a change to the `value` prop from outside (undo, another tab), drops the draft.
  - A field that isn't mounted holds no draft, so leaving the page reverts it.
  - Existing callers are unaffected.
- **`components/NumberField.tsx`:** wraps `CommitTextField`.
  - Props: `value: DecimalString | ''`, `onCommit(value)`, `kind: 'currency' | 'percent'` (the terms editor will use percent; it accepts a typed "%"), `decimalKeypad`, and `error` (from calc issues).
  - Shows `formatNumberInput` text and a currency or `%` adornment. The adornment is `aria-hidden`, and the currency name goes into the accessible description.
  - `inputMode="decimal"` only with `decimalKeypad`, which is only for fields where a negative is never valid: iPad's decimal keypad has no minus key.
  - A parse error takes priority over the calc error.

## Part 3: state helpers (`web/src/state/amountSets.ts`, pure functions)
- **`newAmountSet(existing)`:** "Amount set N" (the lowest unused N). Additions and deductions both start in total mode at `'0'`, so the set is invalid until filled in (§4.7).
- **`duplicateAmountSet(set)`:** new ids for the set and its components, named "‹Name› (copy)" (the name is shortened to stay within 80 characters), inserted right after the original (§8.5).
- **`deleteImpact(workspace, id)`** returns `{ scenarios, sweeps }`: scenarios using the set (deleted with it) and saved sweeps whose baseline it is (kept, but they'll need repair, §9.7).
- **`deleteAmountSet(draft, id)`:** removes the set and its scenarios.
- **`splitIntoComponents(set, key)`** (§4.3): one component holding the total exactly as entered, so unreadable text keeps its error. Components stored beside the total (only in imported files) are replaced.
- **`replaceComponentsWithTotal(set, key, minorUnits)`** (§4.3): removes the components and uses their sum as the total (blank if an amount is unreadable). What marked components recorded as paid by the counterparty is dropped, and the confirmation says so.
- **`newComponent(existing)`:** default name "Component N". Component names use `nameIssues` for inline errors only.
- **Undo labels:**
  - "Add amount set", "Duplicate amount set", "Delete amount set", "Rename amount set"
  - "Edit total additions", "Edit total deductions"
  - "Split additions into components", "Use a total for additions" (and the same for deductions)
  - "Add component", "Remove component", "Rename component", "Edit component amount", "Mark as paid by ‹counterparty›"

## Part 4: the amount sets view (`web/src/pages/amountSets/`)
- **`AmountSetsPage`:** a list beside the editor, using `amounts/:amountSetId?`.
  - No sets: an empty state with **New amount set**.
  - `/amounts` with sets: replace-navigate to the first one.
  - An unknown id (e.g. after undoing a create): "This amount set no longer exists", with a link back.
  - Below `md` (tablet), the list becomes a select above the editor.
- **`AmountSetList`:** for each set, its name and either its gain/loss or "Needs attention" (an icon plus text, never color alone).
- **`AmountSetEditor`:**
  - Name, plus **Duplicate** and **Delete**.
  - An **Additions** section and a **Deductions** section (`AmountGroupEditor`):
    - **Total mode:** the total field, and **Split into components**.
    - **Components mode** (`ComponentsTable`): Name, Amount, a "Paid by ‹counterparty›" checkbox (additions only) and Remove; **Add component** right under the rows; then the total (and for additions, the counterparty-paid amount). **Use a total instead…** opens `UseTotalDialog`. Adding focuses the new row's name. Removing focuses the next row, or **Add component**.
    - Each input's accessible label includes its row, e.g. "Amount, Rent rebate".
- **`AmountSetSummary`** (`role="status"`, so changes are announced politely, §13.4):
  - Total additions, total deductions, "Gain (loss)", counterparty-paid, and the exact unrounded CR. Negative amounts are in parentheses (`AccountingAmount`).
  - When the set is invalid, it lists the problems instead.
  - Errors with field paths go inline on their fields. `['additions']` goes on the section.
- **`DeleteAmountSetDialog`:** follows the `ReplaceWorkspaceDialog` pattern.
  - Lists the scenarios that will be deleted (count, then names; after 10, "and N more") and the sweeps that will need repair (§8.6).
  - It's one undo step. Afterwards, replace-navigate to the next set (or `/amounts`), put focus on the list, and announce it.
- **Read-only tabs:** checkboxes and buttons are disabled when the store's `readOnly` is true. Text fields already handle it.

## Docs
- **`REQUIREMENTS.md`:**
  - §2.4: what's accepted (grouping must match the locale, the workspace currency's symbol, accounting negatives, the Unicode minus) and that unreadable text isn't saved.
  - §4: amount set and component name rules, the mode-switch details for paid-by-counterparty, and the exact CR in the editor.
- **`web/README.md`:** use `NumberField` for numbers. Update the `components/` line.

## Verification
- `cd web && npm run test:run && npm run lint && npm run build`
- **`format/numberInput.test.ts`:**
  - Tables for en-US, de-DE, fr-FR (U+202F), de-CH (’), en-IN (lakh) and ja-JP (no minor unit).
  - Rejections: "1.5" in de-DE, "1,00" in en-US, two decimal separators, a foreign currency symbol.
  - Accepted: the workspace currency symbol, parentheses, U+2212.
  - A fast-check round trip: for each of those locales, `parse(formatNumberInput(x)) === x` for random canonical decimals.
- **`state/amountSets.test.ts`:** every mode-switch rule (including the two-component paid split), new ids on duplicate, the delete cascade, and `deleteImpact`.
- **jsdom component tests:**
  - `NumberField`: an invalid draft is kept and not saved, Escape reverts, Enter commits, it's read-only in a read-only tab, and undo replaces the draft.
  - `AmountSetsPage`: create, edit, summary, switch mode, a delete dialog listing scenarios, and undo restoring everything.
- **Manual** (`npm run dev`):
  1. Create a set, enter additions 1,000,000 and deductions 800,500, and see "80.05% (before rounding)".
  2. Switch deductions to components and back.
  3. Mark components as paid by counterparty.
  4. Undo and redo every step.
  5. Import a file with locale `de-DE` (the locale picker comes later, in §2) and check that `1.000,50` is accepted and `1.5` is rejected.
  6. Delete a set used by scenarios (import a file that has some) and check the dialog's list.
- One commit per part.
