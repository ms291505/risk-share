import type { SideKey, Terms } from './types'

/** The sides used by the terms' type; other stored sides are ignored. */
export function activeSides(terms: Terms): SideKey[] {
  return terms.type === 'full' ? ['gain', 'loss'] : [terms.type]
}

const SIDE_LABEL: Record<SideKey, string> = { gain: 'Gain share threshold', loss: 'Loss share threshold' }

/** §6.1.4: "Gain share threshold", then "Gain share threshold 2", … */
export function defaultTierName(side: SideKey, index: number): string {
  return index === 0 ? SIDE_LABEL[side] : `${SIDE_LABEL[side]} ${index + 1}`
}
