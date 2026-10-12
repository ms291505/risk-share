// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { amounts } from '../../calc/__fixtures__/builders'
import { AppProviders } from '../../app/AppProviders'
import { routes } from '../../app/routes'
import { useWorkspaceStore } from '../../state/store'
import { emptyWorkspace, type SavedSweep, type Scenario, type Workspace } from '../../state/workspace'

const store = useWorkspaceStore

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return router
}

const input = (name: string) => screen.getByRole('textbox', { name }) as HTMLInputElement
function enter(name: string, text: string) {
  fireEvent.change(input(name), { target: { value: text } })
  fireEvent.keyDown(input(name), { key: 'Enter' })
}
const summary = () => within(screen.getByRole('region', { name: 'Summary' })).getByRole('status')
/** The value next to a term in the summary, e.g. "Cost ratio". */
const summaryValue = (term: string) => within(summary()).getByText(term).nextElementSibling?.textContent
const undo = () => act(() => void store.getState().undo())
const section = (name: string) => screen.getByRole('region', { name })
/** The amount in a components table's footer row, e.g. "Total deductions". */
const footerValue = (rowHeader: string) =>
  screen.getByRole('rowheader', { name: rowHeader }).nextElementSibling?.textContent
const LISA_AND_BOB = { riskBearer: 'Lisa', counterparty: 'Bob' }

function workspaceWith(patch: Partial<Workspace>): Workspace {
  return { ...emptyWorkspace('en-US'), ...patch }
}

describe('amount sets view (§4)', () => {
  beforeEach(() => store.getState().load(emptyWorkspace('en-US')))
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('creates a set, ready to name, that needs filling in (§4.7)', () => {
    const router = renderAt('/amounts')
    fireEvent.click(screen.getByRole('button', { name: 'New amount set' }))
    const [set] = store.getState().workspace.amountSets
    expect(router.state.location.pathname).toBe(`/amounts/${set.id}`)
    expect(document.activeElement).toBe(input('Name'))
    expect(input('Name').value).toBe('Amount set 1')
    expect(summary().textContent).toContain('Total additions must be greater than zero.')
    expect(screen.getByRole('link', { name: /Amount set 1/ }).textContent).toContain('Needs attention')
  })

  it('shows totals and the cost ratio before rounding (§5)', () => {
    store.getState().load(workspaceWith({ amountSets: [amounts('0', '0')] }))
    renderAt('/amounts')
    enter('Total additions', '1,000,000')
    enter('Total deductions', '800,500')
    expect(summaryValue('Gain (loss)')).toBe('$199,500.00')
    expect(summaryValue('Cost ratio')).toBe('80.05% (before rounding)')
    expect(input('Total additions').value).toBe('1,000,000.00')
    expect(store.getState().past.map((e) => e.label)).toEqual(['Edit total additions', 'Edit total deductions'])
  })

  it('keeps unreadable text out of the workspace (§2.4)', () => {
    store.getState().load(workspaceWith({ amountSets: [amounts('1000', '0')] }))
    renderAt('/amounts')
    enter('Total deductions', '1.2.3')
    expect(input('Total deductions').value).toBe('1.2.3')
    expect(store.getState().workspace.amountSets[0].deductions.total).toBe('0')
    expect(store.getState().past).toEqual([])
  })

  it('splits a total into components, and shows what they add up to (§4.3)', () => {
    store.getState().load(workspaceWith({ amountSets: [amounts('1000000', '800500')] }))
    renderAt('/amounts')
    fireEvent.click(within(section('Deductions')).getByRole('button', { name: 'Split into components' }))
    expect(document.activeElement).toBe(input('Name, component 1'))
    expect(input('Amount, Component 1').value).toBe('800,500.00')
    expect(footerValue('Total deductions')).toBe('$800,500.00')

    fireEvent.click(within(section('Deductions')).getByRole('button', { name: 'Add component' }))
    expect(document.activeElement).toBe(input('Name, component 2'))
    enter('Amount, Component 2', '-500')
    expect(footerValue('Total deductions')).toBe('$800,000.00')
    expect(summaryValue('Total deductions')).toBe('$800,000.00')

    fireEvent.click(screen.getByRole('button', { name: 'Remove Component 1' }))
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove Component 2' }))
  })

  it('goes back to a total only after confirming, keeping the sum (§4.3)', async () => {
    const set = amounts('1000000', '0')
    set.deductions = { mode: 'components', total: '5', components: [{ id: 'c1', name: 'Claims', amount: '900000' }] }
    store.getState().load(workspaceWith({ amountSets: [set] }))
    renderAt('/amounts')
    fireEvent.click(within(section('Deductions')).getByRole('button', { name: 'Use a total instead…' }))
    const dialog = screen.getByRole('dialog', { name: 'Use a total for deductions?' })
    expect(within(dialog).getByText(/^Remove the component and use a total of \$900,000\.00 instead\?/)).toBeDefined()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(store.getState().past).toEqual([])
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    fireEvent.click(within(section('Deductions')).getByRole('button', { name: 'Use a total instead…' }))
    fireEvent.click(screen.getByRole('button', { name: 'Use a total' }))
    expect(store.getState().workspace.amountSets[0].deductions).toEqual({
      mode: 'total',
      total: '900000.00',
      components: [],
    })
    expect(store.getState().past.at(-1)?.label).toBe('Use a total for deductions')
    await waitFor(() => expect(document.activeElement).toBe(input('Total deductions')))
    expect(input('Total deductions').value).toBe('900,000.00')
  })

  it('records what the counterparty paid only in components, by its name (§3.2, §4.6)', () => {
    store.getState().load(workspaceWith({ amountSets: [amounts('1000', '0')], parties: LISA_AND_BOB }))
    renderAt('/amounts')
    expect(screen.queryByRole('textbox', { name: /Paid by/ })).toBeNull()
    expect(summaryValue('Paid by Bob')).toBe('$0.00')

    fireEvent.click(within(section('Additions')).getByRole('button', { name: 'Split into components' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Paid by Bob, Component 1' }))
    expect(footerValue('Paid by Bob')).toBe('$1,000.00')
    expect(summaryValue('Paid by Bob')).toBe('$1,000.00')
    expect(store.getState().past.at(-1)?.label).toBe('Mark as paid by Bob')

    fireEvent.click(within(section('Additions')).getByRole('button', { name: 'Use a total instead…' }))
    expect(screen.getByRole('dialog').textContent).toContain("The $1,000.00 marked as paid by Bob won't be kept")
  })

  it('duplicates a set right after the original, and opens it', () => {
    store.getState().load(workspaceWith({ amountSets: [amounts('1', '0'), amounts('2', '0')] }))
    renderAt('/amounts')
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }))
    expect(store.getState().workspace.amountSets.map((s) => s.name)).toEqual(['Amounts', 'Amounts (copy)', 'Amounts'])
    expect(input('Name').value).toBe('Amounts (copy)')
    expect(document.activeElement).toBe(input('Name'))
  })

  it('says when the set in the URL no longer exists, e.g. after undoing its creation', () => {
    renderAt('/amounts')
    fireEvent.click(screen.getByRole('button', { name: 'New amount set' }))
    undo()
    expect(screen.getByText(/This amount set no longer exists/)).toBeDefined()
    expect(screen.getByRole('link', { name: 'Show amount sets' }).getAttribute('href')).toBe('/amounts')
  })

  it('disables editing controls in a read-only tab (§11.1)', () => {
    store.getState().load(workspaceWith({ amountSets: [amounts('1', '0')] }))
    renderAt('/amounts')
    act(() => store.getState().setReadOnly(true))
    for (const name of ['New amount set', 'Duplicate', 'Delete…', 'Split into components']) {
      expect((screen.getAllByRole('button', { name })[0] as HTMLButtonElement).disabled).toBe(true)
    }
    expect(input('Total additions').readOnly).toBe(true)
    act(() => store.getState().setReadOnly(false))
  })

  it('disables the components controls in a read-only tab too (§11.1)', () => {
    store.getState().load(workspaceWith({ amountSets: [amounts('1000', '0', '250')] }))
    renderAt('/amounts')
    act(() => store.getState().setReadOnly(true))
    const additions = within(section('Additions'))
    const buttons = ['Use a total instead…', 'Add component', 'Remove Paid by counterparty', 'Remove Other additions']
    for (const name of buttons)
      expect((additions.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true)
    for (const box of additions.getAllByRole('checkbox')) expect((box as HTMLInputElement).disabled).toBe(true)
    expect(input('Amount, Other additions').readOnly).toBe(true)
    act(() => store.getState().setReadOnly(false))
  })

  it('shows negative totals in parentheses, as in the summary (§4.8)', () => {
    const set = amounts('1000000', '0')
    set.deductions = {
      mode: 'components',
      total: '0',
      components: [
        { id: 'c1', name: 'Claims', amount: '10000' },
        { id: 'c2', name: 'Rebates', amount: '-25000' },
      ],
    }
    store.getState().load(workspaceWith({ amountSets: [set] }))
    renderAt('/amounts')
    expect(footerValue('Total deductions')).toBe('($15,000.00)')
    expect(summaryValue('Total deductions')).toBe('($15,000.00)')
    fireEvent.click(within(section('Deductions')).getByRole('button', { name: 'Use a total instead…' }))
    expect(screen.getByRole('dialog').textContent).toContain('Remove both components and use a total of ($15,000.00)')
  })

  it('lists sets in a select below md (§1.5)', async () => {
    vi.stubGlobal('matchMedia', (media: string) => ({
      matches: true,
      media,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    }))
    const a = { ...amounts('1', '0'), id: 'a', name: 'Actuals' }
    const b = { ...amounts('0', '0'), id: 'b', name: 'Forecast' }
    store.getState().load(workspaceWith({ amountSets: [a, b] }))
    const router = renderAt('/amounts/a')
    const nav = screen.getByRole('navigation', { name: 'Amount sets' })
    const select = within(nav).getByRole('combobox', {
      name: 'Switch amount set',
      description: '1 of 2',
    }) as HTMLSelectElement
    expect([...select.options].map((o) => o.text)).toEqual(['Actuals', 'Forecast (needs attention)'])
    expect(within(nav).getByRole('button', { name: 'New amount set' })).toBeDefined()
    fireEvent.change(select, { target: { value: 'b' } })
    await waitFor(() => expect(router.state.location.pathname).toBe('/amounts/b'))
  })

  describe('deleting (§8.6)', () => {
    const scenarios = Array.from({ length: 12 }, (_, i) => ({
      id: `s${i}`,
      name: `Scenario ${i + 1}`,
      amountSetId: 'a',
    }))

    function setup() {
      const a = { ...amounts('1', '0'), id: 'a', name: 'Actuals' }
      const b = { ...amounts('2', '0'), id: 'b', name: 'Forecast' }
      store.getState().load(workspaceWith({ amountSets: [a, b], scenarios: scenarios as Scenario[] }))
      const router = renderAt('/amounts/a')
      fireEvent.click(screen.getByRole('button', { name: 'Delete…' }))
      return { router, dialog: screen.getByRole('dialog', { name: 'Delete “Actuals”?' }) }
    }

    it('lists the scenarios that will be deleted too', () => {
      const { dialog } = setup()
      expect(within(dialog).getByText('These 12 scenarios use it and will be deleted too:')).toBeDefined()
      const items = within(dialog)
        .getAllByRole('listitem')
        .map((li) => li.textContent)
      expect(items).toHaveLength(11)
      expect(items.at(-1)).toBe('and 2 more')
    })

    it('deletes the set and its scenarios in one undo step, and opens the next set', async () => {
      const { router } = setup()
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
      expect(store.getState().workspace.amountSets.map((s) => s.id)).toEqual(['b'])
      expect(store.getState().workspace.scenarios).toEqual([])
      expect(router.state.location.pathname).toBe('/amounts/b')
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(document.activeElement).toBe(screen.getByRole('link', { name: /Forecast/ }))
      expect(screen.getByText('Deleted Actuals and 12 scenarios.')).toBeDefined()

      undo()
      expect(store.getState().workspace.amountSets.map((s) => s.id)).toEqual(['a', 'b'])
      expect(store.getState().workspace.scenarios).toHaveLength(12)
    })

    it('deletes the last set, then offers a new one', async () => {
      const a = { ...amounts('1', '0'), id: 'a', name: 'Actuals' }
      const sweep = { id: 'w', name: 'Claims sweep', baselineAmountSetId: 'a' } as SavedSweep
      store.getState().load(workspaceWith({ amountSets: [a], sweeps: [sweep] }))
      const router = renderAt('/amounts/a')
      fireEvent.click(screen.getByRole('button', { name: 'Delete…' }))
      const dialog = screen.getByRole('dialog', { name: 'Delete “Actuals”?' })
      expect(within(dialog).getByText(/This saved sweep uses it as the baseline/)).toBeDefined()
      expect(within(dialog).getByRole('listitem').textContent).toBe('Claims sweep')

      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
      expect(router.state.location.pathname).toBe('/amounts')
      expect(store.getState().workspace.sweeps).toEqual([sweep])
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'New amount set' }))
      expect(screen.getByText('Deleted Actuals.')).toBeDefined()
    })

    it('changes nothing when cancelled', () => {
      setup()
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(store.getState().workspace.amountSets).toHaveLength(2)
      expect(store.getState().past).toEqual([])
    })
  })
})
