import { defaultTierName } from './terms'
import type { Side, SideKey, Terms, TermsType, ThresholdUnit } from './types'

type NewId = () => string
const uuid: NewId = () => crypto.randomUUID()

function makeSide(key: SideKey, threshold: string, sharePct: string, newId: NewId): Side {
  return { tiers: [{ id: newId(), name: defaultTierName(key, 0), threshold, sharePct }], limits: {} }
}

function base(name: string, type: TermsType, unit: ThresholdUnit, newId: NewId): Terms {
  return { id: newId(), name, unit, type, crPrecision: 1, roundingMode: 'halfUp' }
}

export type TemplateKind = 'gainShare' | 'lossShare' | 'fullRiskShare'

/** §6.7 starter templates, matching the §6.6 worked examples. */
export function templateTerms(kind: TemplateKind, newId: NewId = uuid): Terms {
  switch (kind) {
    case 'gainShare':
      return { ...base('Gain share 85%', 'gain', 'costRatio', newId), gain: makeSide('gain', '85.0', '100', newId) }
    case 'lossShare':
      return { ...base('Loss share 105%', 'loss', 'costRatio', newId), loss: makeSide('loss', '105.0', '50', newId) }
    case 'fullRiskShare':
      return {
        ...base('Full risk share 99% / 101%', 'full', 'costRatio', newId),
        gain: makeSide('gain', '99.0', '50', newId),
        loss: makeSide('loss', '101.0', '30', newId),
      }
  }
}

/** Blank terms of the chosen type; invalid until the thresholds and shares are filled in. */
export function blankTerms(type: TermsType, unit: ThresholdUnit, newId: NewId = uuid): Terms {
  const terms = base('New terms', type, unit, newId)
  if (type !== 'loss') terms.gain = makeSide('gain', '', '', newId)
  if (type !== 'gain') terms.loss = makeSide('loss', '', '', newId)
  return terms
}
