import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const url = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'

async function waitForVite() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      // not up yet
    }
    await new Promise(r => setTimeout(r, 1000))
  }
  throw new Error(`Vite dev server not reachable at ${url}`)
}

await waitForVite()

const electronPath = require('electron')
const child = spawn(electronPath, ['.'], {
  cwd: root,
  env: { ...process.env, VITE_DEV_SERVER_URL: url },
  stdio: 'inherit',
})
child.on('exit', (code) => process.exit(code ?? 0))