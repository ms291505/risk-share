import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import { useMemo, useState } from 'react'
import { D, templateTerms, type TemplateKind } from '../calc'
import { SettlementCurveChart } from '../charts/SettlementCurveChart'
import { ComingSoon, Page } from './Page'

const TEMPLATES: { kind: TemplateKind; label: string }[] = [
  { kind: 'gainShare', label: 'Gain share' },
  { kind: 'lossShare', label: 'Loss share' },
  { kind: 'fullRiskShare', label: 'Full risk share' },
]

const PREVIEW_ADDITIONS = D('1000000')

export function TermsPage() {
  // Demo only: the terms editor will replace this with the workspace's terms.
  const [kind, setKind] = useState<TemplateKind>('gainShare')
  const terms = useMemo(() => templateTerms(kind), [kind])
  return (
    <Page title="Terms">
      <ComingSoon>The terms editor will live here. Meanwhile, a preview of the starter templates (§6.7):</ComingSoon>
      <ToggleButtonGroup
        value={kind}
        exclusive
        size="small"
        aria-label="Template"
        onChange={(_, k: TemplateKind | null) => k && setKind(k)}
      >
        {TEMPLATES.map((t) => (
          <ToggleButton key={t.kind} value={t.kind}>
            {t.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <SettlementCurveChart terms={terms} additions={PREVIEW_ADDITIONS} />
    </Page>
  )
}
