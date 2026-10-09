import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import { cspPlugin } from './csp.ts'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cspPlugin()],
  // Written into saved and exported workspaces (§11.2). Bump package.json `version` each release.
  define: { __APP_VERSION__: JSON.stringify(version) },
})
