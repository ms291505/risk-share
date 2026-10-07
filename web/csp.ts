import { createHash } from 'node:crypto'
import type { Plugin } from 'vite'

const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g

/**
 * The Content Security Policy (§11.3). `connect-src 'none'` means the page
 * can't send data anywhere, even if a dependency tried to. Inline scripts are
 * allowed by hash; MUI's Emotion styles need `'unsafe-inline'` styles; data:
 * and blob: images are for chart export.
 */
export function contentSecurityPolicy(html: string): string {
  const hashes = [...html.matchAll(INLINE_SCRIPT)].map(
    ([, body]) => `'sha256-${createHash('sha256').update(body).digest('base64')}'`,
  )
  return [
    "default-src 'none'",
    `script-src 'self' ${hashes.join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
  ].join('; ')
}

/**
 * Adds the policy as a meta tag to the built index.html. Build only: the dev
 * server needs inline scripts and a websocket for hot reload. Hosts that can
 * set headers should also send it as a `Content-Security-Policy` header, which
 * can add `frame-ancestors 'none'` (not allowed in a meta tag).
 */
export function cspPlugin(): Plugin {
  return {
    name: 'risk-share-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: (html) => [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: contentSecurityPolicy(html) },
          injectTo: 'head-prepend',
        },
      ],
    },
  }
}
