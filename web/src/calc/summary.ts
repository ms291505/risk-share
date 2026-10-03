import type Big from 'big.js'
import { parseDecimal } from './decimal'
import { activeSides, defaultTierName } from './terms'
import type { Parties, Side, SideKey, SideLimits, Terms } from './types'

export interface SummaryFormat {
  money(x: Big): string
  /** A percentage value such as 85.0 → "85.0%", with exactly `decimals` decimals, or up to 2 when omitted. */
  pct(x: Big, decimals?: number): string
}

/** Formats with Intl in the workspace currency and locale. */
export function intlSummaryFormat(currency: string, locale: string): SummaryFormat {
  const money = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    trailingZeroDisplay: 'stripIfInteger',
  })
  const pctFormats = new Map<number | undefined, Intl.NumberFormat>()
  const pctFormat = (decimals: number | undefined) => {
    let f = pctFormats.get(decimals)
    if (!f) {
      f = new Intl.NumberFormat(locale, {
        style: 'percent',
        minimumFractionDigits: decimals ?? 0,
        maximumFractionDigits: decimals ?? 2,
      })
      pctFormats.set(decimals, f)
    }
    return f
  }
  return {
    money: (x) => money.format(x.toFixed() as `${number}`),
    pct: (x, decimals) => pctFormat(decimals).format(x.div(100).toFixed() as `${number}`),
  }
}

/** Formatters bound to one set of terms; values that don't parse yet are shown as typed. */
interface Ctx {
  isCR: boolean
  parties: Parties
  threshold(s: string): string
  share(s: string): string
  money(s: string): string
}

function makeCtx(terms: Terms, parties: Parties, fmt: SummaryFormat): Ctx {
  const isCR = terms.unit === 'costRatio'
  const show = (s: string | undefined, f: (x: Big) => string) => {
    const x = parseDecimal(s)
    return x === null ? (s ?? '') : f(x)
  }
  return {
    isCR,
    parties,
    threshold: (s) => (isCR ? show(s, (x) => fmt.pct(x, terms.crPrecision)) : show(s, fmt.money)),
    share: (s) => show(s, (x) => fmt.pct(x)),
    money: (s) => show(s, fmt.money),
  }
}

function listOf(items: string[]): string {
  return items.length === 2 ? items.join(' and ') : `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`
}

function capsClause(c: Ctx, limits: SideLimits): string {
  const abs = limits.maxPayout ? c.money(limits.maxPayout) : null
  const pct = limits.maxPayoutPctOfAdditions
    ? `${c.share(limits.maxPayoutPctOfAdditions)} of total additions`
    : null
  if (abs && pct) return `, up to the lower of ${abs} and ${pct}`
  return abs || pct ? `, up to ${abs ?? pct}` : ''
}

function sideSentences(c: Ctx, key: SideKey, side: Side): string[] {
  const { isCR, parties } = c
  const [payer, payee] =
    key === 'gain' ? [parties.riskBearer, parties.counterparty] : [parties.counterparty, parties.riskBearer]
  const measure = isCR ? 'the cost ratio' : key === 'gain' ? 'the gain' : 'the loss'
  const beyond = isCR && key === 'gain' ? 'below' : 'above'
  const toward = isCR && key === 'gain' ? 'down to' : 'up to'
  const { tiers } = side
  const named = tiers.length > 1 || tiers[0].name !== defaultTierName(key, 0)
  const label = (i: number) => `${c.threshold(tiers[i].threshold)}${named ? ` (${tiers[i].name})` : ''}`
  const caps = capsClause(c, side.limits)

  let main: string
  if (tiers.length === 1) {
    const what = isCR ? 'of the difference × total additions' : `of ${measure} ${beyond} ${label(0)}`
    main = `If ${measure} is ${beyond} ${label(0)}, ${payer} pays ${payee} ${c.share(tiers[0].sharePct)} ${what}${caps}.`
  } else {
    const bands = tiers.map((t, i) =>
      i + 1 < tiers.length
        ? `${c.share(t.sharePct)} from ${label(i)} ${toward} ${c.threshold(tiers[i + 1].threshold)}`
        : `${c.share(t.sharePct)} ${beyond} ${label(i)}`,
    )
    const of = isCR ? 'the difference × total additions' : measure
    main = `If ${measure} is ${beyond} ${c.threshold(tiers[0].threshold)}, ${payer} pays ${payee} a share of ${of}: ${listOf(bands)}${caps}.`
  }

  const min = side.limits.minimum
  if (!min) return [main]
  return [
    main,
    min.behavior === 'allOrNothing'
      ? `If that amount is less than ${c.money(min.amount)}, nothing is paid.`
      : `${c.money(min.amount)} is deducted from that amount (but not below zero).`,
  ]
}

/** The plain-English summary of a set of terms (§6.5), one string per sentence. */
export function summarizeTerms(terms: Terms, parties: Parties, fmt: SummaryFormat): string[] {
  const c = makeCtx(terms, parties, fmt)
  const sentences: string[] = []
  for (const key of activeSides(terms)) {
    const side = terms[key]
    if (side && side.tiers.length) sentences.push(...sideSentences(c, key, side))
  }
  if (terms.type === 'gain') sentences.push(`${parties.riskBearer} absorbs all losses.`)
  if (terms.type === 'loss') sentences.push(`${parties.riskBearer} keeps all gains.`)
  if (terms.type === 'full' && terms.gain?.tiers.length && terms.loss?.tiers.length) {
    const g = c.threshold(terms.gain.tiers[0].threshold)
    const l = c.threshold(terms.loss.tiers[0].threshold)
    sentences.push(
      c.isCR
        ? `Between ${g} and ${l}, no payment is made.`
        : `Between a loss of ${l} and a gain of ${g}, no payment is made.`,
    )
  }
  return sentences
}
