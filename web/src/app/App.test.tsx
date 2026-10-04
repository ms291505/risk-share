// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { useWorkspaceStore } from '../state/store'
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
    useWorkspaceStore.setState(useWorkspaceStore.getInitialState(), true)
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
})
