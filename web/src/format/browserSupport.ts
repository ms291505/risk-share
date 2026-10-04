/**
 * Feature check for the unsupported-browser notice (§1.6). Exact formatting
 * needs Intl.NumberFormat v3, which formats decimal strings without converting
 * them to Number; older engines lose the last digits here.
 */
export function isSupportedBrowser(): boolean {
  try {
    const f = new Intl.NumberFormat('en-US', { useGrouping: false, maximumFractionDigits: 2 })
    return f.format('12345678901234567890.25' as `${number}`) === '12345678901234567890.25'
  } catch {
    return false
  }
}
