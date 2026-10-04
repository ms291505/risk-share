import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import type { PartyRole } from '../calc'
import { CommitTextField } from '../components/CommitTextField'
import { MAX_PARTY_NAME_LENGTH, normalizePartyName, partyNameIssues, type PartyNameIssue } from '../state/parties'
import { useWorkspaceStore } from '../state/store'
import { ComingSoon, Page } from './Page'

const ISSUE_MESSAGES: Record<PartyNameIssue, string> = {
  empty: 'Enter a name.',
  tooLong: `Use at most ${MAX_PARTY_NAME_LENGTH} characters.`,
  sameAsOther: 'The two parties need different names.',
}

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
          const issue = issues[role]
          return (
            <CommitTextField
              key={role}
              label={label}
              value={parties[role]}
              onCommit={(name) =>
                update(`Rename ${label.toLowerCase()}`, (w) => {
                  w.parties[role] = normalizePartyName(name)
                })
              }
              error={issue ? ISSUE_MESSAGES[issue] : null}
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
