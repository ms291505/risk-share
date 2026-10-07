import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createHashRouter, RouterProvider } from 'react-router'
import { AppProviders } from './app/AppProviders'
import { routes } from './app/routes'
import { startPersistence } from './io/persistence'
import { startTabLock } from './io/tabLock'
import { useWorkspaceStore } from './state/store'

// Before the first render, so a saved workspace never flashes the welcome view.
const persistence = startPersistence(() => window.localStorage, useWorkspaceStore)
startTabLock({ store: useWorkspaceStore, persistence })

const router = createHashRouter(routes)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
)
