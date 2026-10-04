import Alert from '@mui/material/Alert'
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
  usePlotArea,
  XAxis,
  YAxis,
} from 'recharts'
import {
  curveBreakpoints,
  intlSummaryFormat,
  isInvalid,
  minorUnits,
  settlementCurve,
  summarizeTerms,
  type CurveAxis,
  type Terms,
} from '../calc'
import { direction, type Formatters } from '../format/formatters'
import { issueMessages } from '../format/issues'
import { useFormatters } from '../format/useFormatters'
import { useWorkspaceStore } from '../state/store'
import { ChartFrame } from './ChartFrame'
import { niceTicks } from './ticks'
import { useChartTheme } from './useChartTheme'

const MARGIN = { top: 28, right: 24, bottom: 56, left: 0 }

interface SettlementCurveChartProps {
  terms: Terms
  /** "Preview with additions of …" (§10.1). */
  additions: Big
}

const AXIS_TITLE: Record<CurveAxis, string> = {
  costRatio: 'Cost ratio',
  currency: 'Gain (+) / loss (−)',
}

function xFormat(axis: CurveAxis, fmt: Formatters, crPrecision: number) {
  return axis === 'costRatio' ? (x: Big | number) => fmt.pct(x, crPrecision) : fmt.signedCurrency
}

/**
 * Signed settlement across cost ratio (cost ratio terms) or gain/loss
 * (currency terms), with thresholds and the corridor marked (§10.1).
 */
export function SettlementCurveChart({ terms, additions }: SettlementCurveChartProps) {
  const parties = useWorkspaceStore((s) => s.workspace.parties)
  const { currency, locale } = useWorkspaceStore((s) => s.workspace.settings)
  const fmt = useFormatters()
  const ct = useChartTheme()

  const curve = useMemo(
    () => settlementCurve(terms, additions, { minorUnits: minorUnits(currency) }),
    [terms, additions, currency],
  )
  if (isInvalid(curve)) {
    return (
      <Alert severity="warning" sx={{ width: '100%' }}>
        This chart appears once the terms are complete:
        <ul style={{ margin: 0 }}>
          {issueMessages(curve.issues).map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </Alert>
    )
  }

  const { axis } = curve
  const formatX = xFormat(axis, fmt, terms.crPrecision)
  // Display only: Recharts needs numbers.
  const data = curve.points.map((p) => ({ x: p.x.toNumber(), signed: p.signed.toNumber() }))
  const { ticks, decimals } = niceTicks(data[0].x, data.at(-1)!.x)
  const summary = [
    ...summarizeTerms(terms, parties, intlSummaryFormat(currency, locale)),
    `Preview with additions of ${fmt.currency(additions)}.`,
  ]
  const table = {
    columns: [AXIS_TITLE[axis], 'Settlement', 'Direction'],
    rows: curveBreakpoints(curve.points).map((p) => [
      formatX(p.x),
      fmt.signedCurrency(p.signed),
      direction(p.signed, parties),
    ]),
  }
  const axisTick = { fill: ct.text, fontSize: 12, fontFamily: ct.fontFamily }

  return (
    <ChartFrame
      title={`Settlement: ${terms.name}`}
      summary={summary.map((s, i) => (
        <p key={i} style={{ margin: 0 }}>
          {s}
        </p>
      ))}
      table={table}
    >
      <ResponsiveContainer width="100%" height={380}>
        {/* The figure in ChartFrame is the single focus target and has the summary and table (§13.2–13.3);
            Recharts' accessibility layer would add a second tab stop with point-by-point navigation. */}
        <LineChart data={data} margin={MARGIN} accessibilityLayer={false}>
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
            dataKey="x"
            domain={['dataMin', 'dataMax']}
            ticks={ticks}
            tick={axisTick}
            stroke={ct.text}
            tickFormatter={(v: number) => (axis === 'costRatio' ? fmt.pct(v, decimals) : fmt.compactCurrency(v))}
          />
          <YAxis tick={axisTick} stroke={ct.text} width={80} tickFormatter={(v: number) => fmt.compactCurrency(v)} />
          <ReferenceLine y={0} stroke={ct.text} />
          {curve.thresholds.map((t) => (
            <ReferenceLine
              key={`${t.side}-${t.tierId}`}
              x={t.x.toNumber()}
              stroke={ct.reference}
              strokeDasharray="6 4"
              // Labels sit on the side of their line away from break-even, so a corridor's two labels face apart.
              // Closely spaced tiers on one side can still overlap.
              label={{
                value: t.name,
                position: (t.side === 'gain') === (axis === 'costRatio') ? 'insideTopRight' : 'insideTopLeft',
                fill: ct.text,
                fontSize: 12,
              }}
            />
          ))}
          <Tooltip
            contentStyle={{ background: ct.tooltipBackground, borderColor: ct.grid, color: ct.text }}
            labelFormatter={(v) => `${AXIS_TITLE[axis]}: ${formatX(Number(v))}`}
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
          <AxisLabels
            title={AXIS_TITLE[axis]}
            up={`↑ ${parties.riskBearer} pays ${parties.counterparty}`}
            down={`↓ ${parties.counterparty} pays ${parties.riskBearer}`}
            fill={ct.text}
            fontFamily={ct.fontFamily}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}

/**
 * The x-axis title and the y-axis direction labels (§6.1.6): "↑ … pays …" above
 * the plot and "↓ … pays …" below it. Drawn inside the SVG so exports keep them.
 */
function AxisLabels(props: { title: string; up: string; down: string; fill: string; fontFamily: string }) {
  const plot = usePlotArea()
  if (!plot) return null
  const bottom = plot.y + plot.height
  return (
    <g fill={props.fill} fontSize={12} fontFamily={props.fontFamily}>
      <text x={plot.x} y={plot.y - 12}>
        {props.up}
      </text>
      <text x={plot.x + plot.width / 2} y={bottom + 36} textAnchor="middle" fontSize={14}>
        {props.title}
      </text>
      <text x={plot.x} y={bottom + 52}>
        {props.down}
      </text>
    </g>
  )
}
