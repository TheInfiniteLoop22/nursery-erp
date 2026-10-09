// Captures screenshots from a running stack seeded with scripts/seed_all.py + scripts/seed_demo.py.
//   WEB_URL=... API_URL=... SHOTS_DIR=./screenshots node capture-screenshots.mjs
// Output goes to SHOTS_DIR (default ./screenshots, which is git-ignored). Note: it performs one real scan
// on ord_demo04 to capture the live update.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const WEB = process.env.WEB_URL || 'http://localhost:3030'
const API = process.env.API_URL || 'http://localhost:8000/api/v1'
const OUT = (process.env.SHOTS_DIR || './screenshots').replace(/\/?$/, '/')
mkdirSync(OUT, { recursive: true })

await Promise.all([fetch(WEB), fetch(API.replace(/\/api\/v1$/, '') + '/health')]).catch(() => {})
const browser = await chromium.launch()

async function session(user, pass, landing) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 820 } })
  const page = await ctx.newPage()
  page.setDefaultTimeout(60000)
  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle' })
  await page.getByLabel('User name').fill(user)
  await page.getByLabel('Password', { exact: true }).fill(pass)
  await page.getByRole('button', { name: /login/i }).click()
  await page.waitForURL(`**/${landing}`, { timeout: 90000 })
  return page
}
const snap = async (page, path, file, wait = 2500) => {
  await page.goto(`${WEB}${path}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(wait)
  await page.screenshot({ path: OUT + file })
  console.log('saved', file)
}

if (!process.env.LIVE_ONLY) {
const admin = await session('admin', 'admin123', 'admin')
await snap(admin, '/admin', '01-admin-dashboard.png')
await snap(admin, '/admin/orders', '02-orders-all-statuses.png')
await snap(admin, '/admin/analytics', '03-analytics.png', 4000)
await snap(admin, '/admin/planning', '04-planning.png')
await snap(admin, '/admin/zones', '05-zones.png')

}
// Scan -> live update: employee page open, admin scans (own scans are skipped by design), page updates without reload
const login = await (await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_username: 'admin', user_password: 'admin123' }) })).json()
const H = { Authorization: `Bearer ${login.access_token}`, 'Content-Type': 'application/json' }
const orderId = 'ord_demo04'
const detail = await (await fetch(`${API}/orders/${orderId}`, { headers: H })).json()
const item = detail.items.find((i) => (i.scanned_quantity ?? 0) < i.quantity) || detail.items[0]

const emp = await session('employee', 'emp123', 'employee')
await emp.goto(`${WEB}/employee/orders/${orderId}`, { waitUntil: 'networkidle' })
await emp.getByText('Live', { exact: true }).waitFor({ timeout: 60000 })
await emp.screenshot({ path: OUT + '06-live-before-scan.png' })
const before = (await emp.getByText(/\d+ \/ \d+ scanned/).first().innerText()).match(/(\d+) \/ (\d+)/)
const r = await fetch(`${API}/employees/scan`, { method: 'POST', headers: H, body: JSON.stringify({ order_id: orderId, product_id: item.product_id, quantity_scanned: 1 }) })
console.log('scan status', r.status)
const m = before
await emp.getByText(new RegExp(`(${Number(m[1]) + 1}) / ${m[2]} scanned`)).first().waitFor({ timeout: 30000 })
await emp.screenshot({ path: OUT + '07-live-after-scan.png' })
await browser.close()
