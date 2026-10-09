// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { templateTerms } from '../calc'
import { startPersistence, STORAGE_KEY, usePersistence } from '../io/persistence'
import { serializeWorkspace } from '../io/serialize'
import { useWorkspaceStore } from '../state/store'
import { emptyWorkspace, type Workspace } from '../state/workspace'
import { AppProviders } from './AppProviders'
import { routes } from './routes'

const store = useWorkspaceStore
let downloads: string[]

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return router
}

function withTerms(name: string): Workspace {
  const ws = emptyWorkspace('en-US')
  ws.terms.push({ ...templateTerms('gainShare'), name })
  return ws
}

async function importFile(text: string, name = 'deal.json') {
  const input = document.querySelector<HTMLInputElement>('input[type=file]')!
  const file = new File([text], name, { type: 'application/json' })
  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } })
  })
}

beforeEach(() => {
  downloads = []
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:test')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push(this.download)
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  store.getState().setReadOnly(false)
  store.getState().load(emptyWorkspace('en-US'))
  usePersistence.setState({ status: 'ok', hasBackup: false, blockedBy: null })
})

describe('import (§11.2)', () => {
  it('explains a rejected file and leaves the workspace unchanged', async () => {
    store.getState().load(withTerms('Mine'))
    renderAt('/workspace')
    await importFile(JSON.stringify({ schemaVersion: 99, appVersion: '9.0.0' }))
    const dialog = screen.getByRole('alertdialog')
    expect(dialog.textContent).toContain('This workspace was saved by a newer version of Risk Share.')
    expect(dialog.textContent).toContain('It needs Risk Share 9.0.0 or later')
    expect(dialog.textContent).toContain("Your workspace hasn't changed.")
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    // Still readable while it fades out.
    expect(dialog.textContent).toContain('This workspace was saved by a newer version of Risk Share.')
    expect(store.getState().workspace.terms[0].name).toBe('Mine')
    expect(store.getState().past).toEqual([])
  })

  it('lists validation problems', async () => {
    renderAt('/workspace')
    const doc = JSON.parse(serializeWorkspace(withTerms('Theirs')))
    doc.terms[0].unit = 'percent'
    await importFile(JSON.stringify(doc))
    expect(screen.getByRole('alertdialog').textContent).toContain(
      'Terms "Theirs", unit: has an unknown value "percent" (expected "costRatio", "currency").',
    )
  })

  it('confirms before replacing, and the replacement can be undone', async () => {
    store.getState().load(withTerms('Mine'))
    const router = renderAt('/workspace')
    await importFile(serializeWorkspace(withTerms('Theirs')), 'theirs.json')

    const dialog = screen.getByRole('dialog', { name: 'Replace your workspace?' })
    expect(dialog.textContent).toContain('replaced by theirs.json (1 set of terms)')
    fireEvent.click(screen.getByRole('button', { name: 'Export current first' }))
    expect(downloads).toEqual([expect.stringMatching(/^risk-share-\d{4}-\d{2}-\d{2}\.json$/)])
    expect(within(dialog).getByRole('status').textContent).toBe(`Exported to ${downloads[0]}.`)
    expect(store.getState().workspace.terms[0].name).toBe('Mine')

    fireEvent.click(screen.getByRole('button', { name: 'Replace' }))
    expect(store.getState().workspace.terms[0].name).toBe('Theirs')
    expect(router.state.location.pathname).toBe('/scenarios')
    // Announced once the dialog has closed and the live region is exposed again.
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Imported theirs.json.'))

    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true })
    expect(store.getState().workspace.terms[0].name).toBe('Mine')
  })

  it('cancelling keeps the workspace', async () => {
    store.getState().load(withTerms('Mine'))
    renderAt('/workspace')
    await importFile(serializeWorkspace(withTerms('Theirs')), 'theirs.json')
    const dialog = screen.getByRole('dialog', { name: 'Replace your workspace?' })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(dialog.textContent).toContain('replaced by theirs.json (1 set of terms)')
    expect(store.getState().workspace.terms[0].name).toBe('Mine')
  })

  it('asks before replacing a workspace that has only notes', async () => {
    store.getState().load({ ...emptyWorkspace('en-US'), notes: 'Call Bob' })
    renderAt('/')
    await importFile(serializeWorkspace(withTerms('Theirs')))
    expect(screen.getByRole('dialog', { name: 'Replace your workspace?' })).toBeDefined()
  })

  it('explains, and changes nothing, if another tab became the editor before Replace', async () => {
    store.getState().load(withTerms('Mine'))
    const router = renderAt('/workspace')
    await importFile(serializeWorkspace(withTerms('Theirs')))
    act(() => store.getState().setReadOnly(true))
    fireEvent.click(screen.getByRole('button', { name: 'Replace' }))
    expect(screen.getByRole('alertdialog').textContent).toContain('This workspace is now open in another tab.')
    expect(store.getState().workspace.terms[0].name).toBe('Mine')
    expect(router.state.location.pathname).toBe('/workspace')
  })

  it('replaces an empty workspace without asking', async () => {
    renderAt('/')
    expect(screen.getAllByRole('button', { name: 'Import a workspace' })).toHaveLength(1)
    // The welcome view and the app bar menu share one file input and one set of dialogs.
    expect(document.querySelectorAll('input[type=file]')).toHaveLength(1)
    await importFile(serializeWorkspace(withTerms('Theirs')))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(store.getState().workspace.terms[0].name).toBe('Theirs')
  })

  it("can't import while another tab is the editor", () => {
    store.getState().setReadOnly(true)
    renderAt('/workspace')
    fireEvent.click(screen.getByRole('button', { name: 'Import or export' }))
    expect(screen.getByRole('menuitem', { name: 'Import workspace…' }).getAttribute('aria-disabled')).toBe('true')
  })
})

describe('export', () => {
  it('exports with Cmd/Ctrl+S, including a field being edited', () => {
    renderAt('/workspace')
    const counterparty = screen.getByLabelText('Counterparty') as HTMLInputElement
    counterparty.focus()
    fireEvent.change(counterparty, { target: { value: 'Bob' } })
    const event = new KeyboardEvent('keydown', { key: 's', metaKey: true, bubbles: true, cancelable: true })
    act(() => void counterparty.dispatchEvent(event))
    expect(event.defaultPrevented).toBe(true)
    expect(store.getState().workspace.parties.counterparty).toBe('Bob')
    expect(downloads).toHaveLength(1)
    expect(document.activeElement).toBe(counterparty)
    expect(screen.getByRole('status').textContent).toBe('Exported the workspace to a file.')
  })

  it('exports once while Cmd/Ctrl+S is held', () => {
    renderAt('/workspace')
    fireEvent.keyDown(document.body, { key: 's', metaKey: true })
    fireEvent.keyDown(document.body, { key: 's', metaKey: true, repeat: true })
    expect(downloads).toHaveLength(1)
  })
})

describe('storage status (§11.1)', () => {
  it('says where the workspace is saved and offers export and the backup', () => {
    usePersistence.setState({ hasBackup: true })
    renderAt('/workspace')
    fireEvent.click(screen.getByRole('button', { name: 'Saved in this browser' }))
    const popover = screen.getByRole('dialog', { name: 'Saved in this browser' })
    expect(popover.textContent).toContain("Browser storage isn't permanent")
    expect(screen.getByRole('button', { name: 'Export workspace' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Download pre-update backup' })).toBeDefined()
  })

  it('warns while storage is full', () => {
    renderAt('/workspace')
    act(() => usePersistence.setState({ status: 'full' }))
    expect(screen.getByRole('alert').textContent).toContain("Browser storage is full, so changes aren't being saved.")
    expect(screen.getByRole('button', { name: 'Not saved: storage full' })).toBeDefined()
  })

  it('explains a stored copy that can’t be opened, and confirms before replacing it', () => {
    usePersistence.setState({ status: 'blocked', blockedBy: { kind: 'notJson' } })
    renderAt('/workspace')
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain("The workspace saved in this browser can't be opened")
    expect(alert.textContent).toContain("It isn't valid JSON.")
    fireEvent.click(screen.getByRole('button', { name: 'Replace saved copy…' }))
    expect(screen.getByRole('dialog', { name: 'Replace the saved workspace?' })).toBeDefined()
  })

  it('confirms replacing the stored copy and moves focus to the page heading', async () => {
    localStorage.setItem(STORAGE_KEY, '{"schemaVer')
    const { stop } = startPersistence(() => localStorage, store)
    try {
      renderAt('/workspace')
      fireEvent.click(screen.getByRole('button', { name: 'Replace saved copy…' }))
      fireEvent.click(screen.getByRole('button', { name: 'Replace' }))
      expect(screen.queryByRole('alert')).toBeNull()
      expect(localStorage.getItem(STORAGE_KEY)).toBe(serializeWorkspace(store.getState().workspace, 0))
      await waitFor(() =>
        expect(screen.getByRole('status').textContent).toBe(
          'Replaced the saved workspace. Changes are being saved again.',
        ),
      )
      expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }))
    } finally {
      stop()
      localStorage.clear()
    }
  })

  it("doesn't offer to replace the stored copy from a read-only tab", () => {
    usePersistence.setState({ status: 'blocked', blockedBy: { kind: 'notJson' } })
    store.getState().setReadOnly(true)
    renderAt('/workspace')
    expect(screen.getByRole('button', { name: 'Download saved copy' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Replace saved copy…' })).toBeNull()
  })
})
