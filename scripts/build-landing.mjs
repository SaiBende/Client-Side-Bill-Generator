// Copies the static landing site into dist/ alongside the SPA (which Vite
// builds into dist/app). Also copies brand logos up to the site root.
import { cpSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const landing = join(root, 'landing')

rmSync(join(dist, 'assets'), { recursive: true, force: true })
rmSync(join(dist, 'robots.txt'), { force: true })
rmSync(join(dist, 'sitemap.xml'), { force: true })
rmSync(join(dist, 'privacy.html'), { force: true })
rmSync(join(dist, 'index.html'), { force: true })

if (!existsSync(join(dist, 'app'))) {
  throw new Error('dist/app not found — run the Vite build first (vite build --base=/app/ --outDir dist/app)')
}

cpSync(landing, dist, { recursive: true, force: true })
cpSync(join(root, 'public', 'logo.ico'), join(dist, 'logo.ico'), { force: true })
cpSync(join(root, 'public', 'logo.png'), join(dist, 'logo.png'), { force: true })

console.log('Landing site copied into dist/ (app ready at dist/app).')