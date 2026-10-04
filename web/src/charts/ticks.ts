/** Display-only axis ticks. Numbers are fine here: these never feed a calculation. */

const TARGET_TICKS = 8

/** The smallest 1, 2 or 5 × 10ⁿ that is ≥ x (x > 0). */
function niceStep(x: number): number {
  const exp = Math.floor(Math.log10(x))
  const base = 10 ** exp
  const nice = [1, 2, 5, 10].find((n) => n * base >= x * (1 - 1e-9))!
  return nice * base
}

/** About 8 evenly spaced ticks on 1/2/5 × 10ⁿ steps within [from, to], and the decimals they need. */
export function niceTicks(from: number, to: number): { ticks: number[]; decimals: number } {
  if (!(to > from)) return { ticks: [from], decimals: 0 }
  const step = niceStep((to - from) / TARGET_TICKS)
  const decimals = Math.max(0, -Math.floor(Math.log10(step)))
  const ticks: number[] = []
  for (let i = Math.ceil(from / step); i * step <= to + step * 1e-9; i++) {
    // Rounds away float noise such as 0.30000000000000004.
    ticks.push(Number((i * step).toFixed(decimals)))
  }
  return { ticks, decimals }
}
