import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import type Big from 'big.js'
import { useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { intlSummaryFormat, isInvalid, minorUnits, settlementCurve, summarizeTerms, type Terms } from '../calc'
import { direction, makeFormatters } from '../format/formatters'
import { useWorkspaceStore } from '../state/store'
import { ChartFrame } from './ChartFrame'
import { useChartTheme } from './useChartTheme'

const TICK_STEP = 5

/** Ticks every 5 CR points within [from, to]. */
function xTicks(from: number, to: number): number[] {
  const ticks = []
  for (let t = Math.ceil(from / TICK_STEP) * TICK_STEP; t <= to; t += TICK_STEP) ticks.push(t)
  return ticks
}

interface SettlementCurveChartProps {
  terms: Terms
  /** "Preview with additions of …" (§10.1). */
  additions: Big
}

/** Signed settlement across cost ratio, with thresholds and the corridor marked (§10.1). */
export function SettlementCurveChart({ terms, additions }: SettlementCurveChartProps) {
  const { settings, parties } = useWorkspaceStore((s) => s.workspace)
  const { currency, locale } = settings
  const ct = useChartTheme()
  const fmt = useMemo(() => makeFormatters(locale, currency), [locale, currency])

  const curve = useMemo(
    () => settlementCurve(terms, additions, { minorUnits: minorUnits(currency) }),
    [terms, additions, currency],
  )
  if (isInvalid(curve)) {
    return (
      <Alert severity="info">
        — These terms can't be charted yet: {curve.issues.map((i) => i.code).join(', ')}.
      </Alert>
    )
  }

  const precision = terms.crPrecision
  // Display only: Recharts needs numbers.
  const data = curve.points.map((p) => ({ cr: p.crPct.toNumber(), signed: p.signed.toNumber() }))
  const summary = [
    ...summarizeTerms(terms, parties, intlSummaryFormat(currency, locale)),
    `Preview with additions of ${fmt.currency(additions)}.`,
  ]
  const table = {
    columns: ['Cost ratio', 'Settlement', 'Direction'],
    rows: curve.points.map((p) => [
      fmt.pct(p.crPct, precision),
      fmt.signedCurrency(p.signed),
      direction(p.signed, parties),
    ]),
  }
  const axisTick = { fill: ct.text, fontSize: 12, fontFamily: ct.fontFamily }

  return (
    <ChartFrame
      title={`Settlement vs. cost ratio: ${terms.name}`}
      summary={summary.map((s) => (
        <p key={s} style={{ margin: 0 }}>
          {s}
        </p>
      ))}
      table={table}
    >
      {/* The y-axis direction label (§6.1.6); too long to fit rotated along the axis. */}
      <Typography variant="caption" component="p" color="text.secondary">
        ↑ {parties.riskBearer} pays {parties.counterparty} / ↓ {parties.counterparty} pays {parties.riskBearer}
      </Typography>
      <ResponsiveContainer width="100%" height={360}>
        <LineChart data={data} margin={{ top: 24, right: 24, bottom: 24, left: 0 }} accessibilityLayer={false}>
          <CartesianGrid stroke={ct.grid} strokeDasharray="3 3" />
          {curve.corridor && (
            <ReferenceArea
              x1={curve.corridor.from.toNumber()}
              x2={curve.corridor.to.toNumber()}
              fill={ct.corridor}
              label={{ value: 'Corridor', position: 'insideBottom', fill: ct.text, fontSize: 12 }}
            />
          )}
          <XAxis
            type="number"
            dataKey="cr"
            domain={['dataMin', 'dataMax']}
            tick={axisTick}
            stroke={ct.text}
            ticks={xTicks(data[0].cr, data.at(-1)!.cr)}
            tickFormatter={(v: number) => fmt.pct(v, 0)}
            label={{ value: 'Cost ratio', position: 'bottom', fill: ct.text }}
          />
          <YAxis
            tick={axisTick}
            stroke={ct.text}
            width={80}
            tickFormatter={(v: number) => fmt.compactCurrency(v)}
          />
          <ReferenceLine y={0} stroke={ct.text} />
          {curve.thresholds.map((t) => (
            <ReferenceLine
              key={t.tierId}
              x={t.crPct.toNumber()}
              stroke={ct.reference}
              strokeDasharray="6 4"
              // Gain labels sit left of their line and loss labels right, so a corridor's labels don't overlap.
              label={{
                value: t.name,
                position: t.side === 'gain' ? 'insideTopRight' : 'insideTopLeft',
                fill: ct.text,
                fontSize: 12,
              }}
            />
          ))}
          <Tooltip
            contentStyle={{ background: ct.tooltipBackground, borderColor: ct.grid, color: ct.text }}
            labelFormatter={(v) => `Cost ratio ${fmt.pct(Number(v), precision)}`}
            formatter={(v) => {
              const n = Number(v)
              return [`${fmt.currency(Math.abs(n))} (${direction(n, parties)})`, 'Settlement']
            }}
          />
          <Line
            type="linear"
            dataKey="signed"
            stroke={ct.line}
            strokeWidth={2}
            dot={false}
            isAnimationActive={ct.animate}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}
