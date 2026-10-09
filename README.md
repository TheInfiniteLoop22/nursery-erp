# Nursery ERP

[![Backend CI/CD](https://github.com/TheInfiniteLoop22/nursery-erp/actions/workflows/backend.yml/badge.svg)](https://github.com/TheInfiniteLoop22/nursery-erp/actions/workflows/backend.yml)
[![Frontend CI/CD](https://github.com/TheInfiniteLoop22/nursery-erp/actions/workflows/frontend.yml/badge.svg)](https://github.com/TheInfiniteLoop22/nursery-erp/actions/workflows/frontend.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A role-based inventory and work-order system for a plant nursery and landscaping business. Vendors submit products, admins price and approve them, labels get EAN-13 barcodes, work orders reserve stock, and crews scan barcodes to pick items while every open screen updates live.

**Live demo:** https://windscapes-dev-web.onrender.com · **API docs:** https://windscapes-dev-api.onrender.com/docs
Demo logins (synthetic data): `admin / admin123` · `employee / emp123` · `nursery / nursery123`
*Free-tier hosting sleeps when idle, so the first load can take about a minute.*

> **Provenance.** This is a personal re-implementation of an ERP I worked on during an internship. The company's code, data, branding and credentials are not included, and all demo data is synthetic.

## Highlights

- **Transactional scanning.** A scan locks the order line and the product row (`SELECT … FOR UPDATE`, fixed lock order), caps the quantity at what the order still needs and what is in stock, deducts inventory and writes an audit row. A test fires 8 concurrent scans at a line with 3 units left and asserts exactly 3 succeed; it fails without the locks.
- **Live updates.** Server-Sent Events from a thread-safe in-process event bus with bounded per-client queues and heartbeats; a React hook updates open order pages without a refresh.
- **Role-based access in three layers.** Database CHECK constraint, API enforcement (`require_admin`, per-route rules such as heads only touching their own order type, vendors only their own submissions) and role-specific UI areas.
- **Barcode pipeline.** Deterministic 8-digit product IDs, EAN-13 with check digit, TSPL label printing over WebUSB (browser-print fallback), keyboard-wedge scanner support.
- **Validated forms end to end.** React Hook Form + Zod on every data-entry form (18 forms, 21 schema tests); Pydantic re-validates on the server.
- **Delivery pipeline.** GitHub Actions runs tests on a real Postgres service container, lint, type-check, builds, Docker builds, then deploys to Render through its API, waits until the deploy is live and smoke-tests the result.

## Tech stack

| Layer | Technology |
|---|---|
| API | Python 3.11, FastAPI, Pydantic, SQLAlchemy, Alembic, Uvicorn |
| Database | PostgreSQL (Neon in production, branches for test and dev) |
| Auth | JWT (HS256), bcrypt via passlib, login rate limiting |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Forms and charts | React Hook Form, Zod, Recharts |
| Barcodes | JsBarcode (EAN-13), TSPL over WebUSB |
| Realtime | Server-Sent Events |
| Quality | pytest (real PostgreSQL), Vitest, ESLint, `tsc`, Playwright end-to-end |
| Delivery | Docker, GitHub Actions, Render |

## Architecture

```mermaid
flowchart LR
    subgraph Clients
      A[Admin]
      E[Employee / scanner]
      V[Vendor]
    end
    subgraph Render["Render (Docker)"]
      W["Next.js app"]
      API["FastAPI<br/>14 routers, JWT + bcrypt"]
      BUS(("event bus"))
    end
    DB[("PostgreSQL<br/>Neon")]
    A & E & V -->|HTTPS| W
    W -->|REST + Bearer JWT| API
    API -->|SQLAlchemy + Alembic| DB
    API --- BUS
    BUS -.->|SSE| A
    BUS -.->|SSE| E
```

```mermaid
sequenceDiagram
    participant S as Scanner (user A)
    participant API as FastAPI
    participant DB as PostgreSQL
    participant B as Order page (user B)
    B->>API: GET /stream/events (SSE)
    S->>API: POST /employees/scan
    API->>DB: lock order line + product, deduct stock, log scan, COMMIT
    API-->>S: remaining quantity
    API-->>B: event: scan
    B->>B: progress updates without reload
```

The backend is layered as routes → services → SQLAlchemy models, with Pydantic schemas at the boundary. 14 routers are mounted under `/api/v1`; interactive docs are served at `/docs`.

### Domain at a glance

| Area | What it does |
|---|---|
| Products and vendors | Vendor submissions, admin pricing and approval, barcode label status, live inventory, low-stock threshold |
| Work orders | Header, line items and scan log (normalised), status `CREATED → IN_PROGRESS → COMPLETED`, invoice and paid timestamps |
| Scanning | Barcode lookup, locked scan transaction, per-employee audit trail |
| Zones | Admin-configured zones and subzones (1A, 1B, …) validated on every product |
| Planning | Day sheets with labour and cost entries, submit and approve workflow |
| Analytics | Revenue and order trends, top products, designer and vendor views |
| Notifications | Admin activity feed and low-stock list |

### Roles

| Role | Can |
|---|---|
| `admin` | Everything: approve orders and submissions, manage vendors, employees, zones, planning, analytics |
| `nursery` (vendor) | Submit products, track submissions, add stock, mark labels printed, edit order lines, vendor analytics |
| `employee` | See approved orders and scan items |
| `head_installation`, `head_maintenance` | Employee abilities limited to their work type, plus day-sheet management |

## Getting started

### Option 1: Docker Compose (recommended)

```bash
docker compose up --build
docker compose exec api python scripts/seed_all.py     # schema, zones, vendors, products, demo users
docker compose exec api python scripts/seed_demo.py    # optional: orders in every status, scans, day sheets
```

Open http://localhost:3030 and sign in with `admin / admin123`. API docs: http://localhost:8000/docs.

### Option 2: run the apps directly

Requirements: Python 3.11, Node 20+, a PostgreSQL database (a free Neon project works).

```bash
# backend
cd backend
python -m venv .venv && source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env                                     # set DATABASE_URL and SECRET_KEY
python scripts/seed_all.py
python scripts/seed_demo.py                              # optional
uvicorn app.main:app --reload --port 8000

# frontend (second terminal)
cd frontend
cp .env.example .env.local
npm ci && npm run dev                                    # http://localhost:3030
```

To see a live update, open the same order as two different users (a user's own scans are applied locally and not echoed back).

### Configuration

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | backend | `postgresql+psycopg://USER:PASSWORD@HOST/DB?sslmode=require` |
| `TEST_DATABASE_URL` | backend (optional) | separate database for `pytest` |
| `SECRET_KEY` | backend | JWT signing secret (set a long random value) |
| `CORS_ORIGINS` | backend | comma-separated allowed origins (default includes `http://localhost:3030`) |
| `NEXT_PUBLIC_API_URL` | frontend (build time) | API base URL including `/api/v1` |

## Testing

```bash
cd backend  && pytest                                   # 15 tests against a real PostgreSQL
cd frontend && npm test && npm run lint && npx tsc --noEmit
cd e2e && npm install && npx playwright install chromium && npm run test:live   # see e2e/README.md
```

Set `TEST_DATABASE_URL` so the backend tests never touch your working data. Tests create uniquely named rows and clean up after themselves.

## Project structure

```
nursery-erp/
├── backend/
│   ├── app/
│   │   ├── api/v1/routes/     HTTP layer (one router per area)
│   │   ├── services/          business rules, event bus
│   │   ├── models/            SQLAlchemy tables
│   │   ├── schemas/           Pydantic contracts
│   │   ├── core/              config, database, security, deps, rate limit, migrations
│   │   └── utils/             pricing, product IDs, size and zone helpers
│   ├── alembic/               migrations
│   ├── scripts/               seed_all.py, seed_database.py, seed_demo.py
│   ├── tests/                 pytest suite
│   └── Dockerfile
├── frontend/
│   ├── app/
│   │   ├── (auth)/login
│   │   ├── (dashboard)/{admin,employee,nursery}
│   │   ├── components/        layout, barcode, zones, planning, calendar, ui
│   │   └── lib/               API client, Zod schemas, live-events hook, barcode printing
│   ├── tests/                 Vitest schema tests
│   └── Dockerfile
├── e2e/                       Playwright end-to-end checks
├── .github/workflows/         CI/CD (backend.yml, frontend.yml)
├── docker-compose.yml         local stack: PostgreSQL + API + web
└── render.yaml                Render Blueprint
```

## CI/CD and deployment

Both workflows run on pushes to `main` and on pull requests (path-filtered):

1. **Test.** Backend: pytest against a PostgreSQL 16 service container. Frontend: ESLint, `tsc --noEmit`, Vitest, production build.
2. **Docker build.** Proves both images build.
3. **Deploy to Render** (push to `main` only, behind the `RENDER_DEPLOY_ENABLED` repo variable): trigger a deploy through the Render API, poll until `live`, then smoke-test `/health` and `/login`.

Required repository configuration: secret `RENDER_API_KEY`; variables `RENDER_DEPLOY_ENABLED`, `RENDER_BACKEND_SERVICE_ID`, `RENDER_FRONTEND_SERVICE_ID`, `RENDER_BACKEND_URL`, `RENDER_FRONTEND_URL`, `NEXT_PUBLIC_API_URL`. The Blueprint (`render.yaml`) describes both Docker services. The database runs on Neon.

## Design notes and limitations

- Live updates use an **in-process** event bus, so the API runs a single worker. Scaling out means moving the bus to PostgreSQL `LISTEN/NOTIFY` or Redis pub/sub behind the same interface.
- Authentication uses short-lived JWTs without refresh tokens or revocation, and the token lives in `localStorage` (an httpOnly-cookie design is the natural next step).
- A few endpoints require authentication but not a specific role; a central permission map would tighten this.
- The login rate limiter is per process.
- `rate_percentage` on products and order lines is a price **multiplier** (for example `2.25`), not a percentage.

## License

[MIT](LICENSE)
