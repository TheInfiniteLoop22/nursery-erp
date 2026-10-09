# End-to-end checks (Playwright)

Drives the real UI against a running stack (local Docker Compose or a deployment) seeded with
`backend/scripts/seed_all.py` and `backend/scripts/seed_demo.py`.

```bash
cd e2e
npm install && npx playwright install chromium

# local stack (docker compose up) uses the defaults below
WEB_URL=http://localhost:3030 API_URL=http://localhost:8000/api/v1 npm run test:live
```

`live.mjs` runs ten checks:

1. login: empty submit shows the Zod messages
2. login: wrong password shows a generic error
3. login: admin signs in and lands on `/admin`
4. vendor create: invalid email blocked, valid email creates the vendor
5. zones: zone number 0 rejected by the schema
6. order create: empty order blocked, then an order with 2 units is created
7. the order exists in the API with one line of quantity 2
8. **live updates**: a scan by one user appears on another user's open order page without a refresh
9. product notes modal: add, blocked empty edit, delete
10. RBAC: the nursery user lands on `/nursery` and is refused admin pages

The run leaves an `E2E Vendor` and an `E2E Client` order. `npm run clean` removes the vendor and its notes
(there is no order-delete endpoint, so remove test orders with SQL if you want a pristine database).

`npm run screenshots` (`capture-screenshots.mjs`) saves UI screenshots to `SHOTS_DIR` (default `./screenshots`,
git-ignored). It performs one real scan on the seeded order `ord_demo04` to capture the live update.
