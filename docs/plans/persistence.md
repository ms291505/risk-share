# Plan: saving and loading (§11.1–11.2)

## Context
Risk Share has no server. Today the workspace lives only in memory, so a reload loses everything, and Import is a "coming soon" placeholder. This plan implements §11.1 (auto-save to localStorage, one active tab) and §11.2 (JSON import/export with versioning and migration). The goal is that users can trust their data never leaves their machine, and that a future update can never break or destroy their save files.

Agreed with the user on 2026-10-07:
- **Local only:** a CSP that blocks all network requests, plus a "Saved in this browser" status in the app bar.
- **Durability:** exporting is the only long-term storage, and the copy should say so. `navigator.storage.persist()` is just a quiet safety net for people who forget to export, and is **skipped in Firefox**, which would show a permission prompt. An "unexported changes" reminder is **deferred**: don't nag people, make export easy and obvious instead.
- **Import validation:** hand-written, no new dependency, and strict.
- **Versioning (new requirement):** files carry `schemaVersion` **and** `appVersion`. Before migrating the browser-stored workspace, keep the untouched original as a downloadable backup.
- **Shortcut:** Cmd/Ctrl+S exports the workspace.

## Step 0: save this plan
Copy this file to `docs/plans/persistence.md`. The `docs/` folder exists but is empty.

## What already exists (reuse it)
- `web/src/state/store.ts`
  - `update(label, recipe)`: a recipe that returns a whole new workspace is one undoable step. Use it for import.
  - `load(workspace)`: replaces the workspace and clears history. Use it when loading from storage.
  - `readOnly` and `setReadOnly`: undo/redo and `update` already respect them.
  - The comment at line 44 says persistence should hook in via `subscribe`.
- `web/src/state/workspace.ts`: `SCHEMA_VERSION = 1`, the `Workspace` types, `emptyWorkspace()` and `isEmptyWorkspace()`. `compareCreated` and `nextCreatedAt` expect `createdAt` values that `Date.parse` can read.
- `web/src/io/exportWorkspace.ts`: `downloadWorkspace` and `workspaceFileName`. Change it to use the new serializer.
- `web/src/calc/decimal.ts`: `isDecimalString`. Validation should accept any string in decimal fields, because `''` and bad text are legitimate invalid states (see `blankTerms` in `calc/templates.ts` and `parseAmount` in `calc/amounts.ts`).
- `web/src/calc/currency.ts`: `minorUnits`. Use the `Intl` constructors to check a currency or locale.
- `web/src/state/names.ts`: `sameName`, for the duplicate tag name check.
- `web/src/app/announcer.ts`: `useAnnounce` for live-region messages.
- `web/src/components/IconMenu.tsx` and `web/src/components/CommitTextField.tsx`.
- `web/src/app/useUndoShortcuts.ts`: the existing shortcut pattern, including the dialog-open guard. Cmd/Ctrl+S follows it.
- `web/index.html`: the inline color-scheme script, which needs a CSP hash.

## File format
The browser-stored copy and the exported file use the same format:

```json
{ "schemaVersion": 1, "appVersion": "0.1.0", "settings": {…}, "parties": {…}, "terms": […], … }
```

`appVersion` comes from `package.json` via `define: { __APP_VERSION__ }` in `web/vite.config.ts`, with a type declaration. Bump `package.json` from `0.0.0` to `0.1.0`. `appVersion` is added when writing and removed when reading, so it never enters the `Workspace` type or undo history.

## Phase 1: format, migration, validation (`web/src/io/`, no UI)
- **`serialize.ts`:** `serializeWorkspace(w): string` adds `appVersion`. `downloadWorkspace` uses it, and gains a `downloadText(text, name)` helper so the raw backup can be downloaded too.
- **`migrate.ts`:**
  - `MIGRATIONS: Record<number, (doc) => doc>`, keyed by the version a migration upgrades from. It's empty for now.
  - `migrate(doc, from, migrations = MIGRATIONS)` takes the chain as a parameter so tests can use a fake chain.
  - A test checks that keys `1..SCHEMA_VERSION-1` are all present.
- **`validate.ts`:**
  - Builds a fresh `Workspace` by copying only known fields. Unknown fields are dropped and stray `__proto__` keys can't get in.
  - **Rejects:**
    - wrong types and unknown enum values
    - `crPrecision` that isn't a non-negative integer
    - duplicate ids
    - duplicate tag names (via `sameName`)
    - a currency or locale `Intl` rejects
    - a `createdAt` that isn't ISO 8601 or that `Date.parse` can't read
    - scenarios pointing to missing terms or amount sets
    - scenarios or filter views pointing to missing tags
  - **Accepts:** values that are invalid in the §4.7/§6.4 sense (any string in decimal fields), and sweeps that point to missing objects (§9.7).
  - Errors carry readable locations, e.g. *Scenario "Base · Q3" refers to terms that aren't in the file.*
- **`parse.ts`:**
  - `parseWorkspaceText(text)` returns `{ ok: true, workspace, appVersion?, migratedFrom? }` or `{ ok: false, error }`.
  - It runs `JSON.parse`, checks `schemaVersion`, migrates, then validates.
  - Error kinds:
    - `notJson`
    - `notAWorkspace` (no integer `schemaVersion`)
    - `newerVersion` (includes `appVersion`)
    - `invalid` (the first few problems)
  - The user-facing wording goes in `web/src/format/` (e.g. `loadErrors.ts`), following the convention in `format/issues.ts`.
- **Fixtures:** `io/__fixtures__/v1.json`, a complete workspace using every feature. A test migrates and validates every frozen fixture.

## Phase 2: auto-save and load (§11.1)
- **`io/persistence.ts`:**
  - Takes an injectable `Storage` and the store.
  - Exposes a small zustand status store: `status: 'ok' | 'full' | 'unavailable' | 'blocked'`, `hasBackup`, and the raw text of a blocked copy.
  - Started in `web/src/main.tsx` before `createRoot`. localStorage reads are synchronous, so the Welcome page never flashes.
- **On startup** (key `risk-share-workspace`):

  | What's in storage | What happens |
  |---|---|
  | Nothing | Empty workspace |
  | Current version | `load()` |
  | Older version | Write the raw original to `risk-share-workspace-backup` first, then migrate, `load()` and save. If the backup write fails, don't overwrite the original: status becomes `full`, and the original can be downloaded. |
  | Newer version, corrupt, or invalid | Status `blocked`. Never write, and offer to download the stored text. |
  | Storage access throws | Status `unavailable`, and the app works in memory. |

- **Saving:** a `subscribe` writes synchronously whenever the `workspace` reference changes and `readOnly` is false. There's no debounce, because edits already commit per field (§12.5). A `QuotaExceededError` sets status `full`, and the next successful write clears it.
- **Persistent storage:** `navigator.storage?.persist()` is called once, when the workspace first becomes non-empty, and never in Firefox.
  - Firefox shows a permission prompt for it, and we don't want to interrupt anyone for a safety net.
  - There's no feature test for "would prompt", so this uses a user-agent check (`/Firefox\//`) in a small helper with a comment explaining why. If the check is wrong, the only effect is a skipped or extra request.
  - Failures are ignored.

## Phase 3: one active tab (§11.1)
- **`io/tabLock.ts`:** `BroadcastChannel('risk-share')`. Each tab has `{ startedAt, tabId: crypto.randomUUID() }`.
- **On start:** the tab posts `claim`.
- **A tab that gets a `claim` from a newer tab** (later `startedAt`, then the larger `tabId`):
  1. Calls `(document.activeElement as HTMLElement)?.blur()`, so `CommitTextField` commits its draft and it's saved synchronously.
  2. Calls `setReadOnly(true)`.
  3. Posts `released`.
- **The new tab, on `released`:** re-reads storage and `load()`s it if the text differs from what it loaded.
- **Read-only tabs:** follow `storage` events (`load()` the new value) and show a persistent banner, *"This workspace is open in another tab. Reload to edit."*, with a Reload button.
- **`CommitTextField`:** reads `readOnly` from the store and makes its input read-only. Document this convention in `web/README.md`.

## Phase 4: UI
- **Import:** `web/src/app/ImportWorkspace.tsx`, a hook plus dialog, used by the AppShell menu and by `WelcomePage`, replacing their placeholders.
  1. Pick a file with a hidden `<input type="file" accept=".json,application/json">`. Reject files over 10 MB.
  2. Run `file.text()` and `parseWorkspaceText`. Rejected files get a dialog with the explanation, and the workspace is unchanged.
  3. If the workspace isn't empty, open `ReplaceWorkspaceDialog`: *"Replace your workspace with this file (3 terms, 2 amount sets, 6 scenarios)?"* with **Export current first**, **Replace** and **Cancel**. It's reusable for "Show me" (§1.4).
  4. Call `update('Import workspace', () => imported)`, navigate to `/`, and announce it. Add a comment noting that clearing the active filter (§8.1.7) hooks in here once filters exist.
- **`web/src/app/StorageStatus.tsx`:**
  - An app bar button labelled "Saved in this browser". Its popover explains where the data lives. It also says plainly that browser storage is temporary (clearing browsing data, or some browsers' automatic cleanup, erases it) and that exporting to a file is the way to keep a workspace long term.
  - It has an **Export workspace** button, and **Download pre-update backup** when `hasBackup`.
  - For `full`, `unavailable` or `blocked`, a persistent `Alert` under the app bar with an Export or Download action (§11.1).
- **Cmd/Ctrl+S:** calls `preventDefault()` and exports. It's ignored while a dialog is open, like the undo shortcuts.

## Phase 5: CSP
- A Vite plugin in `web/vite.config.ts` (or `web/csp.ts`) with `apply: 'build'`. Its `transformIndexHtml` hashes the inline script and injects:

  ```
  default-src 'none'; script-src 'self' 'sha256-…'; style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:; font-src 'self'; connect-src 'none';
  form-action 'none'; base-uri 'none'
  ```

- `style-src 'unsafe-inline'` is needed for MUI/Emotion `<style>` tags.
- Note in the README to also send the policy as an HTTP header if the host allows it.

## Docs
- **`REQUIREMENTS.md`:**
  - §11.1: the storage status, `persist()`, and the read-only state disabling edits.
  - §11.2: `appVersion`, the pre-migration backup, and never overwriting a newer or corrupt stored copy.
  - §11.3: the CSP.
  - A new **Deferred** section listing the export reminder.
- **`web/README.md`:**
  - How to change the schema: bump `SCHEMA_VERSION`, add a migration, freeze a fixture, and never edit a released migration.
  - Bump `package.json` `version` each release.
  - The read-only convention for editing controls.
  - Update the `io/` line in the layout section.

## Verification
- `cd web && npm run test:run && npm run lint && npm run build`
- **Unit tests:**
  - `parse`, `validate` and `migrate`: each rejection kind, round trips, removal of unknown fields, fixtures, and a fake v0→v1 migration.
  - Persistence with a Map-backed fake `Storage`: a quota error, throwing access, never overwriting newer or corrupt data, the backup written before migrating, and refusing to migrate when the backup fails.
  - The tab lock with two instances on Node's real `BroadcastChannel`.
  - A jsdom test for the import dialog: reject, confirm, replace, and undo.
- **Manual** (via `npm run dev`, then `npm run build && npm run preview` for the CSP):
  - Edit a party name and reload: it's kept.
  - Export, change something, import: the confirmation appears and undo restores the change.
  - Import a file with `schemaVersion: 99`: a clear error, and nothing changes.
  - Open a second tab: the first becomes read-only with the banner, and edits in the second appear in the first.
  - Fill storage in devtools: the warning appears.
  - In preview, the meta CSP is present, and `fetch('/')` in the console is blocked.
- Make one commit per phase.
