import { expect, it } from 'vitest'
import { isSupportedBrowser } from './browserSupport'

it('detects Intl.NumberFormat v3 in current engines', () => {
  expect(isSupportedBrowser()).toBe(true)
})
