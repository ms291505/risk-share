import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'
import { useRouteError } from 'react-router'
import { downloadWorkspace } from '../state/exportWorkspace'
import { useWorkspaceStore } from '../state/store'
import { Page } from './Page'

/** Shown instead of the app when rendering fails, with a way to save the workspace first. */
export function ErrorPage() {
  const error = useRouteError()
  const detail = error instanceof Error ? error.message : String(error)
  return (
    <Container sx={{ py: 4 }}>
      <Page title="Something went wrong">
        <Alert severity="error">
          The app hit an error and can't show this view. Your workspace is still in this browser. Export it to a
          file to keep a copy, then reload.
        </Alert>
        <Stack direction="row" spacing={2}>
          <Button variant="contained" onClick={() => downloadWorkspace(useWorkspaceStore.getState().workspace)}>
            Export workspace
          </Button>
          <Button onClick={() => window.location.reload()}>Reload</Button>
        </Stack>
        <details>
          <summary>Technical details</summary>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{detail}</pre>
        </details>
      </Page>
    </Container>
  )
}
