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
  io/         Getting the workspace in and out of the browser (export now; import,
              migration and persistence later).
  format/     Locale- and currency-aware formatters, validation messages, browser feature check.
  charts/     Recharts charts, wrapped in ChartFrame (summary, data table, export).
```

## Adding a feature

- **New view:** render it inside `Page` (`pages/Page.tsx`). It provides the one
  h1, the unique document title and the focus target after navigation (§13.6).
  Add the route in `app/routes.tsx` and the nav entry in `NAV` in
  `app/AppShell.tsx`.
- **Changing workspace data:** call `update(label, recipe)` from the store. The
  label is what undo/redo announces, so write it for users ("Rename
  counterparty"). `load()` replaces the workspace without an undo step; use it
  only for storage, import and migration, never for user edits.
- **Text inputs:** use `CommitTextField`, so each edit is one undo step,
  committed on blur or Enter (§12.5).
- **Validation:** return calc-style `Issue`s (`calc/types.ts`) and add the
  user-facing sentence to `format/issues.ts`, which holds all validation copy.
  Names (parties, tags) share the rules in `state/names.ts`.
- **New chart:** compute the data in `calc` as `Big`s. Wrap the chart in
  `ChartFrame` with a text summary and a data table, take colors from
  `useChartTheme`, and call `toNumber()` only at the Recharts boundary.
- **Not built yet:** use `ComingSoonButton` for actions and `ComingSoon` for
  placeholder text.

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
