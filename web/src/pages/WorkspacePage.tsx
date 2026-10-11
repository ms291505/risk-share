import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { CommitTextField } from '../components/CommitTextField'
import { useIssueMessage } from '../format/useIssueMessage'
import { normalizeName } from '../state/names'
import { PARTY_ROLES, ROLE_LABELS } from '../format/parties'
import { partyNameIssues } from '../state/parties'
import { useWorkspaceStore } from '../state/store'
import { ComingSoon } from '../components/ComingSoon'
import { Page } from './Page'

export function WorkspacePage() {
  const settings = useWorkspaceStore((s) => s.workspace.settings)
  const parties = useWorkspaceStore((s) => s.workspace.parties)
  const update = useWorkspaceStore((s) => s.update)
  const issues = partyNameIssues(parties)
  const message = useIssueMessage()

  return (
    <Page title="Workspace">
      <Stack component="section" spacing={2} aria-labelledby="parties-heading" sx={{ width: '100%', maxWidth: 480 }}>
        <Typography id="parties-heading" variant="h6" component="h2">
          Parties
        </Typography>
        {PARTY_ROLES.map((role) => {
          const label = ROLE_LABELS[role]
          const issue = issues.find((i) => i.path[0] === role)
          return (
            <CommitTextField
              key={role}
              label={label}
              value={parties[role]}
              onCommit={(name) =>
                update(`Rename ${label.toLowerCase()}`, (w) => {
                  w.parties[role] = normalizeName(name)
                })
              }
              error={issue ? message(issue) : null}
              fullWidth
            />
          )
        })}
      </Stack>
      <ComingSoon>
        Currency {settings.currency}, locale {settings.locale}. Currency, locale and notes will be edited here.
      </ComingSoon>
    </Page>
  )
}
