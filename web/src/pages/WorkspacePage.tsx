import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { PartyRole } from '../calc'
import { CommitTextField } from '../components/CommitTextField'
import { issueMessage } from '../format/issues'
import { normalizeName } from '../state/names'
import { partyNameIssues } from '../state/parties'
import { useWorkspaceStore } from '../state/store'
import { ComingSoon } from '../components/ComingSoon'
import { Page } from './Page'

const ROLES: { role: PartyRole; label: string }[] = [
  { role: 'riskBearer', label: 'Risk-bearer' },
  { role: 'counterparty', label: 'Counterparty' },
]

export function WorkspacePage() {
  const settings = useWorkspaceStore((s) => s.workspace.settings)
  const parties = useWorkspaceStore((s) => s.workspace.parties)
  const update = useWorkspaceStore((s) => s.update)
  const issues = partyNameIssues(parties)

  return (
    <Page title="Workspace">
      <Stack component="section" spacing={2} aria-labelledby="parties-heading" sx={{ width: '100%', maxWidth: 480 }}>
        <Typography id="parties-heading" variant="h6" component="h2">
          Parties
        </Typography>
        {ROLES.map(({ role, label }) => {
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
              error={issue ? issueMessage(issue) : null}
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
