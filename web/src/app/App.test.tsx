// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router'
import { templateTerms } from '../calc'
import { useWorkspaceStore } from '../state/store'
import { emptyWorkspace } from '../state/workspace'
import { AppProviders } from './AppProviders'
import { routes } from './routes'

function renderAt(path: string, routeTable: RouteObject[] = routes) {
  const router = createMemoryRouter(routeTable, { initialEntries: [path] })
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return router
}

const heading = () => screen.getByRole('heading', { level: 1 })

describe('app shell', () => {
  afterEach(() => {
    cleanup()
    useWorkspaceStore.getState().load(emptyWorkspace('en-US'))
  })

  it('renders the nav and the current page', () => {
    renderAt('/workspace')
    const nav = screen.getByRole('navigation', { name: 'Main' })
    const hrefs = [...nav.querySelectorAll('a')].map((a) => [a.textContent, a.getAttribute('href')])
    expect(hrefs).toEqual([
      ['Workspace', '/workspace'],
      ['Amount sets', '/amounts'],
      ['Terms', '/terms'],
      ['Scenarios', '/scenarios'],
      ['Sensitivity', '/sensitivity'],
    ])
    expect(screen.getByRole('heading', { level: 1, name: 'Workspace' })).toBeDefined()
  })

  it('enables undo after a change', () => {
    renderAt('/workspace')
    const undo = screen.getByRole('button', { name: 'Undo' }) as HTMLButtonElement
    expect(undo.disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Redo' }) as HTMLButtonElement).disabled).toBe(true)

    act(() =>
      useWorkspaceStore.getState().update('Edit notes', (w) => {
        w.notes = 'x'
      }),
    )
    expect(undo.disabled).toBe(false)
  })

  it('shows the welcome view for an empty workspace (§1.7)', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome to Risk Share' })).toBeDefined()
    expect(document.title).toBe('Welcome to Risk Share · Risk Share')
  })

  it('commits a party rename as one undo step and flags duplicate names (§3.3, §12.5)', () => {
    renderAt('/workspace')
    const counterparty = screen.getByLabelText('Counterparty') as HTMLInputElement
    fireEvent.change(counterparty, { target: { value: ' risk-BEARER ' } })
    fireEvent.blur(counterparty)
    expect(useWorkspaceStore.getState().workspace.parties.counterparty).toBe('risk-BEARER')
    expect(useWorkspaceStore.getState().past).toHaveLength(1)
    expect(screen.getByText('The two parties need different names.')).toBeDefined()
  })

  it('opens on Scenarios once the workspace has data, without moving focus (§1.7)', () => {
    const ws = emptyWorkspace('en-US')
    ws.terms.push(templateTerms('gainShare'))
    useWorkspaceStore.getState().load(ws)
    renderAt('/')
    expect(heading().textContent).toBe('Scenarios')
    expect(document.activeElement).toBe(document.body)
  })

  it('sets the title and focuses the heading when moving to a new view (§13.6)', () => {
    renderAt('/workspace')
    expect(document.title).toBe('Workspace · Risk Share')
    fireEvent.click(screen.getByRole('link', { name: 'Scenarios' }))
    expect(document.title).toBe('Scenarios · Risk Share')
    expect(document.activeElement).toBe(heading())
  })

  it('keeps focus when only the item within a view changes', async () => {
    const router = renderAt('/sensitivity')
    const link = screen.getByRole('link', { name: 'Sensitivity' })
    link.focus()
    await act(() => router.navigate('/sensitivity/a'))
    await act(() => router.navigate('/sensitivity/b'))
    expect(document.activeElement).toBe(link)
  })

  it('undoes with Ctrl+Z outside a field, and announces it (§12.1, §13.4)', () => {
    renderAt('/workspace')
    const counterparty = screen.getByLabelText('Counterparty') as HTMLInputElement
    fireEvent.change(counterparty, { target: { value: 'Bob' } })
    fireEvent.blur(counterparty)
    expect(useWorkspaceStore.getState().workspace.parties.counterparty).toBe('Bob')

    fireEvent.keyDown(document.body, { key: 'z', code: 'KeyZ', ctrlKey: true })
    expect(useWorkspaceStore.getState().workspace.parties.counterparty).toBe('Counterparty')
    expect(counterparty.value).toBe('Counterparty')
    expect(screen.getByRole('status').textContent).toBe('Undid: Rename counterparty')

    fireEvent.keyDown(document.body, { key: 'Z', code: 'KeyZ', ctrlKey: true, shiftKey: true })
    expect(counterparty.value).toBe('Bob')
    expect(screen.getByRole('status').textContent).toBe('Redid: Rename counterparty')
  })

  it('shows the error view, with export, when a view fails to render', () => {
    // React and the router log the thrown error.
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const Boom = () => {
      throw new Error('boom')
    }
    const { element, errorElement } = routes[0]
    renderAt('/', [{ path: '/', element, errorElement, children: [{ index: true, element: <Boom /> }] }])
    expect(heading().textContent).toBe('Something went wrong')
    expect(screen.getByRole('button', { name: 'Export workspace' })).toBeDefined()
    expect(screen.getByText('boom')).toBeDefined()
    log.mockRestore()
  })
})
