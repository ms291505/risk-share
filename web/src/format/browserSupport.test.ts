import { afterEach, expect, it, vi } from 'vitest'
import { isSupportedBrowser } from './browserSupport'

afterEach(() => {
  vi.unstubAllGlobals()
})

it('detects Intl.NumberFormat v3 and Intl.Segmenter in current engines', () => {
  expect(isSupportedBrowser()).toBe(true)
})

it('flags a browser without Intl.Segmenter (e.g. Firefox 116–124)', () => {
  vi.stubGlobal('Intl', Object.assign(Object.create(Intl), { Segmenter: undefined }))
  expect(isSupportedBrowser()).toBe(false)
})
