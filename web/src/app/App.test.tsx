// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { useWorkspaceStore } from '../state/store'
import { emptyWorkspace } from '../state/workspace'
import { AppProviders } from './AppProviders'
import { routes } from './routes'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )
}

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
})
