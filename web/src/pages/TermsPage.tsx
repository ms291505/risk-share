import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import { useMemo, useState } from 'react'
import { blankTerms, D, templateTerms, type Terms } from '../calc'
import { SettlementCurveChart } from '../charts/SettlementCurveChart'
import { ComingSoon } from '../components/ComingSoon'
import { Page } from './Page'

/** The §6.6.5 currency example: 50% of gain above $100,000 and 50% of loss above $50,000. */
function currencyExample(): Terms {
  const terms = blankTerms('full', 'currency')
  terms.name = 'Currency 100K / 50K'
  Object.assign(terms.gain!.tiers[0], { threshold: '100000', sharePct: '50' })
  Object.assign(terms.loss!.tiers[0], { threshold: '50000', sharePct: '50' })
  return terms
}

const DEMOS = [
  { key: 'gainShare', label: 'Gain share', make: () => templateTerms('gainShare') },
  { key: 'lossShare', label: 'Loss share', make: () => templateTerms('lossShare') },
  { key: 'fullRiskShare', label: 'Full risk share', make: () => templateTerms('fullRiskShare') },
  { key: 'currency', label: 'Currency', make: currencyExample },
] as const

type DemoKey = (typeof DEMOS)[number]['key']

const PREVIEW_ADDITIONS = D('1000000')

export function TermsPage() {
  // Demo only: the terms editor will replace this with the workspace's terms.
  const [key, setKey] = useState<DemoKey>('gainShare')
  const terms = useMemo(() => DEMOS.find((d) => d.key === key)!.make(), [key])
  return (
    <Page title="Terms">
      <ComingSoon>The terms editor will live here. Meanwhile, a preview of example terms (§6.6–6.7):</ComingSoon>
      <ToggleButtonGroup
        value={key}
        exclusive
        size="small"
        aria-label="Example terms"
        onChange={(_, k: DemoKey | null) => k && setKey(k)}
      >
        {DEMOS.map((d) => (
          <ToggleButton key={d.key} value={d.key}>
            {d.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <SettlementCurveChart terms={terms} additions={PREVIEW_ADDITIONS} />
    </Page>
  )
}
