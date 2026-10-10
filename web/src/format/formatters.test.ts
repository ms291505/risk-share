import { describe, expect, it } from 'vitest'
import { D } from '../calc'
import { direction, gainOrLoss, makeFormatters, unroundedPct } from './formatters'

describe('makeFormatters', () => {
  const f = makeFormatters('en-US', 'USD')

  it('formats Big values exactly', () => {
    expect(f.currency(D('1234567890123.45'))).toBe('$1,234,567,890,123.45')
    expect(f.signedCurrency(D('-12000'))).toBe('-$12,000.00')
    expect(f.signedCurrency(D('0'))).toBe('$0.00')
  })

  it('shows percentages to their full precision (§5.4)', () => {
    expect(f.pct(D('70'), 1)).toBe('70.0%')
    expect(f.pct(D('80.05'), 2)).toBe('80.05%')
    expect(f.pct(85.5, 1)).toBe('85.5%')
  })

  it('follows the locale', () => {
    expect(makeFormatters('de-DE', 'EUR').currency(D('1000.5'))).toBe('1.000,50 €')
    expect(makeFormatters('ja-JP', 'JPY').currency(D('1000'))).toBe('￥1,000')
  })
})

describe('direction', () => {
  const parties = { riskBearer: 'Lisa', counterparty: 'Bob' }
  it('names the payer from the sign (§6.1.6)', () => {
    expect(direction(D(5), parties)).toBe('Lisa pays Bob')
    expect(direction(-1, parties)).toBe('Bob pays Lisa')
    expect(direction(D(0), parties)).toBe('No payment')
  })
})

describe('accountingCurrency', () => {
  it('puts losses in parentheses, in every locale', () => {
    expect(makeFormatters('en-US', 'USD').accountingCurrency(D('-5000.5'))).toBe('($5,000.50)')
    expect(makeFormatters('en-US', 'USD').accountingCurrency(D('5000.5'))).toBe('$5,000.50')
    expect(makeFormatters('de-DE', 'EUR').accountingCurrency(D('-5000.5'))).toBe('(5.000,50\u00a0€)')
  })
})

describe('gainOrLoss', () => {
  const f = makeFormatters('en-US', 'USD')
  it('says which in words', () => {
    expect(gainOrLoss(D('199500'), f)).toBe('Gain $199,500.00')
    expect(gainOrLoss(D('-5000.5'), f)).toBe('Loss $5,000.50')
    expect(gainOrLoss(D('0'), f)).toBe('Break-even')
  })
})

describe('unroundedPct', () => {
  const f = makeFormatters('en-US', 'USD')
  it('is exact up to 4 decimals, and approximate after', () => {
    expect(unroundedPct(D('80.05'), f)).toBe('80.05%')
    expect(unroundedPct(D('80'), f)).toBe('80%')
    expect(unroundedPct(D('80.04999'), f)).toBe('≈80.0500%')
    expect(unroundedPct(D(100).div(3), f)).toBe('≈33.3333%')
  })
})
