// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { D, templateTerms, type Terms } from '../calc'
import { AppProviders } from '../app/AppProviders'
import { useWorkspaceStore } from '../state/store'
import { emptyWorkspace } from '../state/workspace'
import { SettlementCurveChart } from './SettlementCurveChart'

// Recharts draws nothing measurable in jsdom; these tests cover the frame, summary and table (§13.2–13.3).
function renderChart(terms: Terms) {
  render(
    <AppProviders>
      <SettlementCurveChart terms={terms} additions={D(1000000)} />
    </AppProviders>,
  )
}

describe('SettlementCurveChart in ChartFrame', () => {
  beforeAll(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
    // ResponsiveContainer warns that a 0×0 chart can't be drawn.
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterAll(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })
  beforeEach(() => {
    const ws = emptyWorkspace('en-US')
    ws.parties = { riskBearer: 'Lisa', counterparty: 'Bob' }
    useWorkspaceStore.getState().load(ws)
  })
  afterEach(cleanup)

  it('makes the figure focusable, labelled by the title and described by the summary', () => {
    renderChart(templateTerms('fullRiskShare'))
    const figure = screen.getByRole('figure')
    expect(figure.tabIndex).toBe(0)
    const title = document.getElementById(figure.getAttribute('aria-labelledby')!)!
    expect(title.tagName).toBe('H2')
    expect(title.textContent).toBe('Settlement: Full risk share 99% / 101%')
    const summary = document.getElementById(figure.getAttribute('aria-describedby')!)!
    expect(summary.textContent).toContain('Preview with additions of $1,000,000.00.')
  })

  it('toggles the data table', () => {
    renderChart(templateTerms('fullRiskShare'))
    const toggle = screen.getByRole('button', { name: 'Show data table' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(document.getElementById(toggle.getAttribute('aria-controls')!)).not.toBeNull()
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(toggle.textContent).toBe('Hide data table')
  })

  it('lists only the range ends and the thresholds, with direction in party names', () => {
    renderChart(templateTerms('fullRiskShare'))
    const table = screen.getByRole('table', { hidden: true })
    const rows = within(table)
      .getAllByRole('row', { hidden: true })
      .slice(1)
      .map((r) => [...r.querySelectorAll('td')].map((td) => td.textContent))
    expect(rows.map(([x, , dir]) => [x, dir])).toEqual([
      ['84.0%', 'Lisa pays Bob'],
      ['99.0%', 'No payment'],
      ['101.0%', 'No payment'],
      ['116.0%', 'Bob pays Lisa'],
    ])
    expect(rows[0][1]).toContain('75,000.00')
    expect(rows[3][1]).toContain('45,000.00')
  })

  it('shows readable sentences for invalid terms', () => {
    const terms = templateTerms('gainShare')
    terms.gain!.tiers[0].threshold = '120.0'
    renderChart(terms)
    expect(screen.getByText('Gain share thresholds must be at most 100%.')).toBeDefined()
    expect(screen.queryByText(/gainThresholdAbove100/)).toBeNull()
    expect(screen.queryByRole('figure')).toBeNull()
  })

  it('says when a gain threshold is beyond the additions', () => {
    const terms = templateTerms('gainShare')
    Object.assign(terms, { unit: 'currency', name: 'Big gain' })
    terms.gain!.tiers[0].threshold = '2000000'
    renderChart(terms)
    expect(screen.getByRole('figure').textContent).toContain(
      "Gains can't exceed the additions, so this preview can't reach Gain share threshold (+$2,000,000.00).",
    )
  })
})
