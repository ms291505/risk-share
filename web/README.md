# Risk Share (web)

A browser-only React app for estimating risk share settlements. See
[`../REQUIREMENTS.md`](../REQUIREMENTS.md) for the spec; section numbers (§) in
code comments refer to it.

## Scripts

| Command            | What it does                         |
| ------------------ | ------------------------------------ |
| `npm run dev`      | Start the Vite dev server            |
| `npm run build`    | Type-check and build to `dist/`      |
| `npm run lint`     | Lint with oxlint                     |
| `npm test`         | Run Vitest in watch mode             |
| `npm run test:run` | Run the tests once                   |

## Layout

```
src/
  calc/       Pure settlement math (no React/DOM). Exact decimals via big.js.
  app/        Theme, providers, app shell, routes, undo shortcuts, live announcer.
  pages/      One component per route, plus the welcome and error views.
  components/ Shared UI: CommitTextField, IconMenu, ComingSoon(Button), visuallyHidden.
  state/      Workspace types, the Zustand store with patch-based undo/redo, name rules.
  io/         The workspace file format (serialize, migrate, validate, parse),
              auto-save to browser storage, and the one-active-tab lock.
  format/     Locale- and currency-aware formatters, validation messages, browser feature check.
  charts/     Recharts charts, wrapped in ChartFrame (summary, data table, export).
```

## Adding a feature

- **New view:** render it inside `Page` (`pages/Page.tsx`). It provides the one
  h1, the unique document title and the focus target after navigation (§13.6).
  Add the route in `app/routes.tsx` and the nav entry in `NAV` in
  `app/AppShell.tsx`. Focus moves only when the first path segment changes,
  and never on `navigate(path, { replace: true })`, which is treated as a
  redirect. If a replace navigation moves the user to a different view (e.g.
  after deleting the open item), focus the new view's h1 yourself.
- **Changing workspace data:** call `update(label, recipe)` from the store. The
  label is what undo/redo announces, so write it for users ("Rename
  counterparty"). `load()` replaces the workspace without an undo step; use it
  only for loading from browser storage and for migration. Import and "Show
  me" are undoable (§12.3): use `update(label, () => newWorkspace)`.
- **Text inputs:** use `CommitTextField`, so each edit is one undo step,
  committed on blur or Enter (§12.5).
- **Read-only tabs:** while another tab is the editor, the store's `readOnly`
  is true and `update` does nothing (§11.1). `CommitTextField` already turns
  read-only; any other editing control (checkboxes, selects, buttons that
  change data) should read `readOnly` from the store and be disabled.
- **Validation:** return calc-style `Issue`s (`calc/types.ts`) and add the
  user-facing sentence to `format/issues.ts`, which holds all validation copy.
  Names (parties, tags) share the rules in `state/names.ts`.
- **New chart:** compute the data in `calc` as `Big`s. Wrap the chart in
  `ChartFrame` with a text summary and a data table, take colors from
  `useChartTheme`, and call `toNumber()` only at the Recharts boundary.
- **Not built yet:** use `ComingSoonButton` for actions and `ComingSoon` for
  placeholder text.

## Changing the workspace format

Saved workspaces and exported files share one format (`io/serialize.ts`),
stamped with `schemaVersion` and `appVersion`. To change it:

1. Bump `SCHEMA_VERSION` in `state/workspace.ts`.
2. Add a migration from the previous version to `MIGRATIONS` in
   `io/migrate.ts`.
3. Update `io/validate.ts` for the new shape.
4. Add a fixture of the new version to `io/__fixtures__/` and keep the old
   ones: the tests open every fixture.

Never edit a migration or fixture once released; saved files depend on them.
Bump `version` in `package.json` with each release, since it is written into
every file as `appVersion`.

## Security

The build adds a Content Security Policy meta tag (`csp.ts`) that blocks all
network requests, so workspace data can't leave the browser (§11.3). If the
host can set headers, send the same policy as a `Content-Security-Policy`
header too, adding `frame-ancestors 'none'`, which a meta tag can't set. Check
it with `npm run build && npm run preview`.

## Stack

- **UI:** MUI, with a light/dark/system color scheme via CSS variables.
- **Charts:** Recharts. Colors come from the MUI theme through `useChartTheme`.
- **State:** Zustand + Immer. Every data change goes through `update(label, recipe)`, so it can be undone.
- **Routing:** React Router with hash routes (`#/terms`), so any static host works.

UI code formats `Big` values from `calc` and converts them to numbers only for
charts. It never does arithmetic on them.

## Tests

Tests run in Node by default. Component tests opt into the DOM with a
`// @vitest-environment jsdom` comment at the top of the file.
