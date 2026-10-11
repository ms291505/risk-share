import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { issueMessage } from './issues'
import { currencyAffix, formatNumberInput, parseNumberInput, type NumberInputOptions } from './numberInput'

const value = (text: string, opts: NumberInputOptions) => {
  const r = parseNumberInput(text, opts)
  return r.ok ? r.value : null
}

describe('parseNumberInput (§2.4)', () => {
  it.each([
    ['en-US', '1,000,000.50', '1000000.50'],
    ['en-US', '1000000.5', '1000000.5'],
    ['en-US', '  -12.00 ', '-12.00'],
    ['en-US', '.5', '0.5'],
    ['en-US', '5.', '5'],
    ['en-US', '1,000.', '1000'],
    ['en-US', '007', '7'],
    ['en-US', '-0.00', '0.00'],
    ['en-US', '', ''],
    ['de-DE', '1.000,50', '1000.50'],
    ['de-DE', '1000,5', '1000.5'],
    ['fr-FR', '1\u202F234,56', '1234.56'],
    ['fr-FR', '1 234,56', '1234.56'],
    ['fr-FR', '1\u00A0234,56', '1234.56'],
    ['de-CH', "1'234.56", '1234.56'],
    ['de-CH', '1\u2019234.56', '1234.56'],
    ['en-IN', '12,34,567.89', '1234567.89'],
    ['ja-JP', '1,234', '1234'],
    ['es-ES', '1.234', '1234'],
    ['ar-EG', '١٬٢٣٤٫٥', '1234.5'],
  ])('reads %s "%s" as %s', (locale, text, expected) => {
    expect(value(text, { locale })).toBe(expected)
  })

  it.each([
    ['de-DE', '1.5'],
    ['en-US', '1,00'],
    ['en-US', '1,2345'],
    ['en-IN', '1,234,567'],
    ['en-US', '1.2.3'],
    ['de-DE', '1,2,3'],
    ['en-US', '1 000'],
    ['en-US', '1e6'],
    ['en-US', '5k'],
    ['en-US', '+5'],
    ['en-US', '.'],
    ['en-US', '-'],
    ['en-US', '(-5)'],
  ])('rejects %s "%s"', (locale, text) => {
    expect(value(text, { locale })).toBeNull()
  })

  it('accepts the workspace currency, but no other', () => {
    const usd = { locale: 'en-US', currency: 'USD' }
    expect(value('$1,000,000.00', usd)).toBe('1000000.00')
    expect(value('USD 5', usd)).toBe('5')
    expect(value('-$5', usd)).toBe('-5')
    expect(value('€5', usd)).toBeNull()
    expect(value('$5', { locale: 'en-US' })).toBeNull()
    expect(value('1.000,50 €', { locale: 'de-DE', currency: 'EUR' })).toBe('1000.50')
    expect(value("$-1'000.00", { locale: 'de-CH', currency: 'USD' })).toBe('-1000.00')
  })

  it('accepts accounting negatives and the Unicode minus', () => {
    expect(value('(5,000)', { locale: 'en-US' })).toBe('-5000')
    expect(value('($5,000.25)', { locale: 'en-US', currency: 'USD' })).toBe('-5000.25')
    expect(value('\u22125', { locale: 'en-US' })).toBe('-5')
    expect(value('\u22121\u00A0234,5', { locale: 'sv-SE' })).toBe('-1234.5')
  })

  it('accepts a percent sign in percent fields only', () => {
    expect(value('85.5%', { locale: 'en-US', percent: true })).toBe('85.5')
    expect(value('85,5\u00A0%', { locale: 'de-DE', percent: true })).toBe('85.5')
    expect(value('85%', { locale: 'en-US' })).toBeNull()
  })

  it('keeps extra decimals for calc to report (§2.5)', () => {
    expect(value('1.234', { locale: 'en-US', currency: 'USD' })).toBe('1.234')
  })

  it('explains the locale in its error', () => {
    const r = parseNumberInput('1.5', { locale: 'de-DE' })
    expect(!r.ok && issueMessage(r.issue, { riskBearer: 'Lisa', counterparty: 'Bob' })).toBe(
      'Enter a number like 1.234,56. This workspace uses "," for decimals.',
    )
  })
})

describe('formatNumberInput', () => {
  it('groups, and pads to the minor unit without hiding extra decimals', () => {
    expect(formatNumberInput('1000000.5', { locale: 'en-US', minFractionDigits: 2 })).toBe('1,000,000.50')
    expect(formatNumberInput('-12.345', { locale: 'en-US', minFractionDigits: 2 })).toBe('-12.345')
    expect(formatNumberInput('1000.5', { locale: 'de-DE', minFractionDigits: 2 })).toBe('1.000,50')
    expect(formatNumberInput('1234567', { locale: 'en-IN', minFractionDigits: 0 })).toBe('12,34,567')
    expect(formatNumberInput('1234', { locale: 'ja-JP', minFractionDigits: 0 })).toBe('1,234')
  })

  it('is exact', () => {
    expect(formatNumberInput('12345678901234567890.12', { locale: 'en-US', minFractionDigits: 2 })).toBe(
      '12,345,678,901,234,567,890.12',
    )
  })

  it('shows a value with more decimals than Intl can format unchanged', () => {
    const long = `0.${'1'.repeat(101)}`
    expect(formatNumberInput(long, { locale: 'en-US', minFractionDigits: 2 })).toBe(long)
  })

  it('shows text that is not a number unchanged', () => {
    expect(formatNumberInput('', { locale: 'en-US', minFractionDigits: 2 })).toBe('')
    expect(formatNumberInput('abc', { locale: 'en-US', minFractionDigits: 2 })).toBe('abc')
  })

  const canonical = fc
    .tuple(
      fc.boolean(),
      fc.bigInt({ min: 0n, max: 10n ** 18n }),
      fc.option(fc.stringMatching(/^\d{1,6}$/), { nil: undefined }),
    )
    .map(([negative, integer, fraction]) => {
      const abs = fraction === undefined ? `${integer}` : `${integer}.${fraction}`
      return negative && !/^0(\.0*)?$/.test(abs) ? `-${abs}` : abs
    })

  it.each(['en-US', 'de-DE', 'fr-FR', 'de-CH', 'en-IN', 'ja-JP'])('reads back what it shows in %s', (locale) => {
    fc.assert(
      fc.property(canonical, (x) => {
        expect(value(formatNumberInput(x, { locale, minFractionDigits: 0 }), { locale })).toBe(x)
      }),
    )
  })
})

describe('currencyAffix', () => {
  it('follows the locale', () => {
    expect(currencyAffix('en-US', 'USD')).toEqual({ symbol: '$', position: 'start' })
    expect(currencyAffix('de-DE', 'EUR')).toEqual({ symbol: '€', position: 'end' })
  })
})
