import type { RouteObject } from 'react-router'
import { AmountSetsPage } from '../pages/AmountSetsPage'
import { ErrorPage } from '../pages/ErrorPage'
import { HomePage } from '../pages/HomePage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { ScenariosPage } from '../pages/ScenariosPage'
import { SensitivityPage } from '../pages/SensitivityPage'
import { TermsPage } from '../pages/TermsPage'
import { WorkspacePage } from '../pages/WorkspacePage'
import { AppShell } from './AppShell'
import { ImportWorkspaceProvider } from './ImportWorkspaceProvider'

/** Routes hold only navigation state, never workspace data (§11.3). */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: (
      <ImportWorkspaceProvider>
        <AppShell />
      </ImportWorkspaceProvider>
    ),
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'workspace', element: <WorkspacePage /> },
      { path: 'amounts/:amountSetId?', element: <AmountSetsPage /> },
      { path: 'terms/:termsId?', element: <TermsPage /> },
      { path: 'scenarios', element: <ScenariosPage /> },
      { path: 'sensitivity/:sweepId?', element: <SensitivityPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
