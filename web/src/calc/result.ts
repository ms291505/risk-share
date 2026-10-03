import type { Invalid, Issue } from './types'

export function isInvalid(x: unknown): x is Invalid {
  return typeof x === 'object' && x !== null && (x as Partial<Invalid>).ok === false
}

/** An `Invalid` result holding one issue. */
export function invalid(
  code: Issue['code'],
  path: string[],
  params?: Issue['params'],
  source?: Issue['source'],
): Invalid {
  return { ok: false, issues: [{ code, path, params, source }] }
}

/** Tags issues with the object they came from, when several are combined. */
export function withSource(issues: Issue[], source: NonNullable<Issue['source']>): Issue[] {
  return issues.map((i) => ({ ...i, source }))
}
