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
  calc/      Pure settlement math (no React/DOM). Exact decimals via big.js.
  app/       Theme, providers, app shell, routes, undo shortcuts, live announcer.
  pages/     One component per route (Workspace, Amount sets, Terms, Scenarios, Sensitivity).
  state/     Workspace types and the Zustand store with patch-based undo/redo.
  format/    Locale- and currency-aware formatters.
  charts/    Recharts charts, wrapped in ChartFrame (summary, data table, export).
```

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
