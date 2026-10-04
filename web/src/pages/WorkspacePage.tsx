import { useWorkspaceStore } from '../state/store'
import { ComingSoon, Page } from './Page'

export function WorkspacePage() {
  const { settings, parties } = useWorkspaceStore((s) => s.workspace)
  return (
    <Page title="Workspace">
      <ComingSoon>
        Currency {settings.currency}, locale {settings.locale}. Parties: {parties.riskBearer} (risk-bearer) and{' '}
        {parties.counterparty} (counterparty). Settings, party names and notes will be edited here.
      </ComingSoon>
    </Page>
  )
}
