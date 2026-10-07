import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router'
import { useImportWorkspace } from '../app/useImportWorkspace'
import { ComingSoonButton } from '../components/ComingSoonButton'
import { useWorkspaceStore } from '../state/store'
import { Page } from './Page'

/** The landing view for an empty workspace (§1.2, §1.4). */
export function WelcomePage() {
  const importWorkspace = useImportWorkspace()
  const readOnly = useWorkspaceStore((s) => s.readOnly)
  return (
    <Page title="Welcome to Risk Share">
      <Typography sx={{ maxWidth: '60ch' }}>
        Estimate who pays whom under gain share, loss share and full risk share terms. Your data stays in this
        browser.
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <ComingSoonButton variant="contained" reason="Load a worked example and take a short tour (coming soon)">
          Show me
        </ComingSoonButton>
        <Button variant="outlined" component={RouterLink} to="/terms">
          Start from a template
        </Button>
        <Button variant="outlined" onClick={importWorkspace.pick} disabled={readOnly}>
          Import a workspace
        </Button>
      </Stack>
      {importWorkspace.ui}
    </Page>
  )
}
