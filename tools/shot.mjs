// Captura de tela de uma página (bancada ou configurador) com o Chromium do Playwright.
// Uso: node tools/shot.mjs --url "<url>" --out capturas/x.png [--width 1440] [--height 900] [--delay 800]
// Espera window.__READY (quando a página define) e imprime erros de console.
import { chromium } from 'playwright-core'
import { existsSync } from 'node:fs'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const args = process.argv.slice(2)
const opcao = (n, padrao) => {
  const i = args.indexOf(`--${n}`)
  return i >= 0 ? args[i + 1] : padrao
}
const url = opcao('url')
const out = opcao('out', 'captura.png')
const width = Number(opcao('width', 1440))
const height = Number(opcao('height', 900))
const delay = Number(opcao('delay', 800))
if (!url) {
  console.error('informe --url')
  process.exit(2)
}

const candidatos = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].filter(Boolean)
const executablePath = candidatos.find((c) => existsSync(c))

const browser = await chromium.launch({ executablePath, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] })
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
const erros = []
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') erros.push(`${m.type()}: ${m.text()}`)
})
page.on('pageerror', (e) => erros.push(`pageerror: ${e.message}`))
await page.goto(url, { waitUntil: 'networkidle' })
try {
  await page.waitForFunction(() => window.__READY === true, null, { timeout: 30000 })
} catch {
  erros.push('aviso: a página não definiu window.__READY em 30 s')
}
await page.waitForTimeout(delay)
mkdirSync(dirname(out), { recursive: true })
await page.screenshot({ path: out })
const info = await page.evaluate(() => window.__modelInfo ?? null)
if (info) console.log(JSON.stringify(info))
for (const e of erros) console.log(e)
console.log('captura em', out)
await browser.close()
