// Browser end-to-end smoke test (Playwright). Runs against a deployed or local stack seeded with
// `python seed_all.py` (demo users admin/employee/nursery). Not part of CI because it needs live services.
//
//   cd e2e && npm install && npx playwright install chromium
//   WEB_URL=https://windscapes-dev-web.onrender.com API_URL=https://windscapes-dev-api.onrender.com/api/v1 npm run test:live
//
// It creates an "E2E Vendor" and an "E2E Client" order; remove them afterwards (see e2e/README.md).
import { chromium } from 'playwright'

const WEB = process.env.WEB_URL || 'http://localhost:3030'
const API = process.env.API_URL || 'http://localhost:8000/api/v1'
const results = []
const ok = (name) => { results.push(['PASS', name]); console.log('PASS', name) }
const fail = (name, e) => { results.push(['FAIL', name + ' :: ' + String(e).split('\n')[0]]); console.log('FAIL', name, '::', String(e).split('\n')[0]) }

async function step(name, fn) {
  try { await fn(); ok(name) } catch (e) { fail(name, e) }
}

async function apiLogin(username, password) {
  const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_username: username, user_password: password }) })
  return r.json()
}

// Free Render services sleep when idle; wake both before the first browser step
await Promise.all([fetch(WEB), fetch(API.replace(/\/api\/v1$/, '') + '/health')]).catch(() => {})
const browser = await chromium.launch()
const adminCtx = await browser.newContext()
const admin = await adminCtx.newPage()
admin.setDefaultTimeout(60000)

// 1. Login validation (React Hook Form + Zod)
await step('login: empty submit shows Zod messages', async () => {
  await admin.goto(`${WEB}/login`, { waitUntil: 'networkidle' })
  await admin.getByRole('button', { name: /login/i }).click()
  await admin.getByText('Username is required').waitFor()
  await admin.getByText('Password is required').waitFor()
})

await step('login: wrong password shows generic error toast', async () => {
  await admin.getByLabel('User name').fill('admin')
  await admin.getByLabel('Password', { exact: true }).fill('wrong-password')
  await admin.getByRole('button', { name: /login/i }).click()
  await admin.getByText('Invalid username or password').waitFor()
})

await step('login: admin signs in and lands on /admin', async () => {
  await admin.getByLabel('Password', { exact: true }).fill('admin123')
  await admin.getByRole('button', { name: /login/i }).click()
  await admin.waitForURL('**/admin', { timeout: 90000 })
})

// 2. Vendor create: Zod email validation then success
let vendorUrl = ''
await step('vendor create: invalid email blocked, valid email creates vendor', async () => {
  await admin.goto(`${WEB}/admin/nursery/create`, { waitUntil: 'networkidle' })
  await admin.getByPlaceholder('e.g. Green Valley Nursery').fill('E2E Vendor')
  await admin.getByPlaceholder('contact@vendor.com').fill('not-an-email')
  await admin.getByRole('button', { name: /create vendor/i }).click()
  await admin.getByText('Enter a valid email address').waitFor()
  await admin.getByPlaceholder('contact@vendor.com').fill(`e2e+${Date.now()}@example.com`)
  await admin.getByRole('button', { name: /create vendor/i }).click()
  await admin.waitForURL((u) => /\/admin\/nursery\/[^/]+$/.test(u.pathname) && !u.pathname.endsWith('/create'), { timeout: 90000 })
  vendorUrl = admin.url()
})

// 3. Zones: Zod range validation
await step('zones: zone number 0 rejected by schema', async () => {
  await admin.goto(`${WEB}/admin/zones`, { waitUntil: 'networkidle' })
  await admin.locator('form input[type=number]').first().fill('0')
  await admin.getByRole('button', { name: /add zone/i }).click()
  await admin.getByText('Zone number must be at least 1').waitFor()
})

// 4. Order create: line items via useFieldArray
await step('order create: empty order blocked, then order with 2 units created', async () => {
  await admin.goto(`${WEB}/admin/orders/create`, { waitUntil: 'networkidle' })
  await admin.getByPlaceholder('Enter client or company name').fill('E2E Client')
  await admin.getByPlaceholder('e.g., ADM001').fill('ADM001')
  if (!(await admin.getByRole('button', { name: /create order/i }).isDisabled())) throw new Error('Create Order should be disabled with no products')
  await admin.getByRole('button', { name: /add product/i }).click()
  await admin.getByPlaceholder(/search by name/i).waitFor()
  // pick the first in-stock product card
  const card = admin.locator('div.cursor-pointer.group').first()
  await card.waitFor()
  await card.click()
  const qty = admin.locator('input[type=number][min="1"]').first()
  await qty.waitFor()
  await qty.fill('2')
  await admin.getByRole('button', { name: /create order/i }).click()
  await admin.waitForURL('**/admin/orders', { timeout: 90000 })
})

// find the order through the API
const adminTok = (await apiLogin('admin', 'admin123')).access_token
const H = { Authorization: `Bearer ${adminTok}`, 'Content-Type': 'application/json' }
let orderId = null
await step('order create: order exists in API with 1 line item of quantity 2', async () => {
  const list = await (await fetch(`${API}/orders/all?page=1&page_size=50`, { headers: H })).json()
  const items = list.items ?? list
  const mine = items.find((o) => o.client_name === 'E2E Client')
  if (!mine) throw new Error('order not found in API')
  orderId = mine.order_id
  const detail = await (await fetch(`${API}/orders/${orderId}`, { headers: H })).json()
  if (detail.items.length !== 1 || detail.items[0].quantity !== 2) throw new Error('unexpected items ' + JSON.stringify(detail.items))
})

// 5. Live updates: employee page open, someone else scans -> page updates without reload
await step('live updates: scan by admin appears on employee page without refresh', async () => {
  const start = await fetch(`${API}/orders/${orderId}/start`, { method: 'PATCH', headers: H })
  if (!start.ok) throw new Error('start failed ' + start.status)
  const detail = await (await fetch(`${API}/orders/${orderId}`, { headers: H })).json()
  const productId = detail.items[0].product_id

  const empCtx = await browser.newContext()
  const emp = await empCtx.newPage()
  emp.setDefaultTimeout(60000)
  await emp.goto(`${WEB}/login`, { waitUntil: 'networkidle' })
  await emp.getByLabel('User name').fill('employee')
  await emp.getByLabel('Password', { exact: true }).fill('emp123')
  await emp.getByRole('button', { name: /login/i }).click()
  await emp.waitForURL('**/employee', { timeout: 90000 })
  await emp.goto(`${WEB}/employee/orders/${orderId}`, { waitUntil: 'networkidle' })
  await emp.getByText('Live', { exact: true }).waitFor({ timeout: 60000 })

  const scan = await fetch(`${API}/employees/scan`, { method: 'POST', headers: H, body: JSON.stringify({ order_id: orderId, product_id: productId, quantity_scanned: 1 }) })
  if (!scan.ok) throw new Error('scan failed ' + scan.status + ' ' + (await scan.text()))
  await emp.getByText(/scanned 1/i).first().waitFor({ timeout: 30000 })
  await empCtx.close()
})

// 5b. Product notes modal (two small RHF forms): add, Zod-blocked empty edit, delete
await step('notes modal: add note, empty edit blocked by Zod, delete note', async () => {
  let opened = false
  const list = await (await fetch(`${API}/nursery/all?page=1&page_size=20`, { headers: { Authorization: `Bearer ${adminTok}` } })).json()
  const ids = list.items.filter((v) => v.products_count > 0).map((v) => v.nursery_id)
  for (const id of ids) {
    await admin.goto(`${WEB}/admin/nursery/${id}`, { waitUntil: 'networkidle' })
    const btn = admin.locator('button[title="Product notes"]').first()
    if (await btn.count()) { await btn.click(); opened = true; break }
  }
  if (!opened) throw new Error('no vendor with products found')
  await admin.getByPlaceholder('Enter your note here...').waitFor()
  if (!(await admin.getByRole('button', { name: /save note/i }).isDisabled())) throw new Error('Save Note should be disabled when empty')
  await admin.getByPlaceholder('Enter your note here...').fill('E2E note')
  await admin.getByRole('button', { name: /save note/i }).click()
  await admin.getByText('E2E note', { exact: true }).last().waitFor()
  const card = () => admin.locator('div.rounded-lg', { hasText: 'E2E note' }).last()
  await card().getByRole('button', { name: /^edit$/i }).click()
  await admin.locator('textarea').last().fill('   ')
  await admin.getByRole('button', { name: /^save$/i }).click()
  await admin.getByText('Note is required').waitFor()
  await admin.getByRole('button', { name: /^cancel$/i }).click()
  admin.once('dialog', (d) => d.accept())
  await card().locator('button:has(svg.lucide-trash2)').click()
  await admin.getByText('E2E note', { exact: true }).waitFor({ state: 'detached' })
})

// 6. Nursery role sees its own dashboard (RBAC in the UI)
await step('RBAC: nursery login lands on /nursery and is refused admin pages', async () => {
  const ctx = await browser.newContext()
  const p = await ctx.newPage()
  p.setDefaultTimeout(60000)
  await p.goto(`${WEB}/login`, { waitUntil: 'networkidle' })
  await p.getByLabel('User name').fill('nursery')
  await p.getByLabel('Password', { exact: true }).fill('nursery123')
  await p.getByRole('button', { name: /login/i }).click()
  await p.waitForURL('**/nursery', { timeout: 90000 })
  await p.goto(`${WEB}/admin`, { waitUntil: 'networkidle' })
  await p.waitForURL((u) => !u.pathname.startsWith('/admin'), { timeout: 30000 })
  await ctx.close()
})

console.log(JSON.stringify({ orderId, vendorUrl }))
await browser.close()
const failed = results.filter((r) => r[0] === 'FAIL')
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
