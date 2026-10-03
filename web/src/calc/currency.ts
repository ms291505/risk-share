/** Digits after the decimal point for an ISO 4217 currency (2 for USD, 0 for JPY). */
export function minorUnits(currency: string): number {
  // Currency digits come from CLDR and don't depend on the locale.
  return (
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2
  )
}
