import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { contentSecurityPolicy } from './csp.ts'

const sha = (s: string) => `'sha256-${createHash('sha256').update(s).digest('base64')}'`

describe('contentSecurityPolicy (§11.3)', () => {
  it('blocks network requests and allows inline scripts only by hash', () => {
    const inline = "\n  document.documentElement.classList.add('dark')\n"
    const html = `<head><script>${inline}</script><script type="module" src="/assets/index.js"></script></head>`
    const policy = contentSecurityPolicy(html)
    expect(policy).toContain("connect-src 'none'")
    expect(policy).toContain("default-src 'none'")
    expect(policy).toContain(`script-src 'self' ${sha(inline)};`)
    expect(policy.match(/sha256-/g)).toHaveLength(1)
  })
})
