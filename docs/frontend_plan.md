# NewsTrack Frontend Plan

Stack: **React 18 + Vite + TypeScript**, **TanStack Query** (server state), **React Router v6**,
**Tailwind CSS + shadcn/ui** (Radix), **React Hook Form + Zod** (forms/validation),
**native WebSocket** for live boards. Scope: ops web app (4 user roles) + a mobile-friendly
driver UI.

Backend reference: FastAPI under `/v1`, two JWT systems (user + driver), WebSocket at
`/v1/realtime?token=<jwt>`. Contract: `docs/api_docs/open_api.yaml`.

---

## Phase 0 — Backend prerequisites (blocker)

1. **CORS**: `main.py` has no `CORSMiddleware`. Add it with allowed origin
   `http://localhost:5173` (Vite dev) + the deployed origin. Without this the SPA cannot call the API.
2. Confirm `python -m app.seed --reset` runs; demo logins (from `seed.py`):
   - `admin@nt.example` / `admin-pass` (Administrator)
   - `manager@nt.example` / `manager-pass` (DistributionManager)
   - `operator@nt.example` / `operator-pass` (HubOperator)
   - `vendor@nt.example` / `vendor-pass` (Vendor)
   - `press@nt.example` / `press-pass` (product creation)
   - Driver: mobile `9800000001` / `driver-pass`
3. Run backend at `http://localhost:8000`; base URL = `http://localhost:8000/v1`.

## Phase 1 — Scaffold & infra

- `npm create vite@latest frontend -- --template react-ts`; add Tailwind + `shadcn/ui init`.
- Folder layout:
  ```
  src/
    api/          # axios instance, generated/typed endpoints, query hooks
    auth/         # AuthContext, token storage, route guards
    components/   # shared UI (DataTable, StatusBadge, ActorRef, Pagination)
    features/     # one folder per domain (deliveries, products, issues, ...)
    realtime/     # useWebSocket hook + channel subscriptions
    routes/       # router config, layouts
    lib/          # utils, formatters, enums mirrored from API
    types/        # TS types derived from open_api.yaml
  ```
- **Typegen**: run `openapi-typescript docs/api_docs/open_api.yaml -o src/types/api.d.ts`
  so request/response types stay in sync with the contract.
- `.env`: `VITE_API_BASE_URL`, `VITE_WS_URL`.

## Phase 2 — API client & auth

- Axios instance with base URL; request interceptor injects the right bearer token
  (user vs driver — two separate stores, since tokens are **not** interchangeable).
- Response interceptor maps the standard `{ error: { code, message, details } }` envelope to
  toast/form errors; on `401` → refresh via `POST /auth/refresh`, else logout.
- **AuthContext**: user login (`POST /auth/login`), `GET /auth/me` bootstrap, role kept in state.
  Persist refresh token; keep access token in memory.
- **Route guards**: `<RequireAuth>` + `<RequireRole roles={[...]}>`. Role drives nav + page access:
  - Administrator: everything (users, orgs, access grants, all reports).
  - DistributionManager: deliveries, assignments, issues, analytics.
  - HubOperator: deliveries/manifests at their hub, confirmations.
  - Vendor: their inbound deliveries, confirmations, their performance.

## Phase 3 — Shared building blocks

- `DataTable` (sortable, server-paginated using `page`/`page_size`/`sort` params + `Pagination` schema).
- `StatusBadge` for `DeliveryStatus`, `IssueStatus`, `DeliveryItemStatus` (color-coded).
- `ActorRef` renderer (expands `{entity_type, name}` for sender/recipient/created_by).
- Filter bar primitives (status select, date range `from`/`to`, entity pickers).
- Toast system, confirm dialogs, empty/error/loading states.

## Phase 4 — Core ops features (web)

1. **Auth pages**: login, "me" guard, logout.
2. **Dashboard**: KPI cards from `GET /reports/daily-summary` (created/dispatched/delivered/
   pending/missed/delays/issues). Refetch on interval + live nudges from WS.
3. **Deliveries**
   - List/board: `GET /deliveries` with status filter, date range, has_issue, route keys.
     Render as a **status board** (columns = lifecycle stages) and a table view.
   - Detail: `GET /deliveries/{id}` — header, sender/recipient, driver/vehicle, items,
     timeline. Tabs: Manifest (`/manifest`), Logs (`/logs`), Assignment history
     (`/assignment-logs`), Access grants (`/access`), Issues.
   - Create delivery (sender/recipient via universal_id picker, address pickers, inline items).
   - Actions: advance status (`/status`), assign driver/vehicle (`/assign`),
     confirm with photo + per-item quantities (`/confirm`), edit mutable fields (handle `409` frozen).
4. **Products / bundles**: list, create (Press/Admin only — gate the button by role/org),
   detail + stock edit (guard 403).
5. **Issues**: list/filter, detail with audit log (`/logs`), raise, assign (+deadline),
   change status (resolve requires `resolution_note`), add comment.
6. **Drivers & Vehicles**: registries, create/edit, availability, assignment.
7. **Organizations & Users** (Admin): CRUD, soft-disable, org `performance` view.
8. **Addresses**: picker + simple management.
9. **Notifications**: bell with `unread_count`, list, mark read (`/read`), clear (`/clear`).
10. **Analytics/Reports**: route performance (`/routes/performance`), delivery success by
    route/vendor/hub, org performance; **PDF export** via `GET /reports/export` (download blob).

## Phase 5 — Driver UI (mobile-first, separate auth)

- Separate login (`POST /driver/auth/login`, mobile + password) → driver token store.
- `GET /driver/me/deliveries`: assigned route list + manifest.
- Per-delivery: advance transit status (`/status` accepts driver JWT), confirm delivery
  with photo proof + quantities, raise an issue.
- Minimal nav, large touch targets, offline-tolerant query caching.

## Phase 6 — Real-time

- `useWebSocket` hook: connect to `VITE_WS_URL/realtime?token=`, send
  `{action:"subscribe", channels:["transit_board","alerts"]}`.
- On events, surface live + invalidate TanStack Query caches:
  - `delivery.status_changed`, `delivery.confirmed`, `delivery.assignment_changed`,
    `delivery.delay_flagged` → update board/detail.
  - `issue.raised`, `issue.status_changed` → alerts feed + issues list.
  - `notification.new` (per-user) → notification bell.
- Auto-reconnect with backoff; resubscribe on reconnect.

## Phase 7 — Polish & delivery

- Role-based nav shell + breadcrumbs; responsive layout.
- Error boundaries; skeleton loaders; optimistic updates where safe.
- `.env` config for staging/prod; build + preview.
- Tests: Vitest + React Testing Library for auth guard, delivery actions, WS hook;
  optional Playwright happy-path (login → create delivery → dispatch → confirm).
- README: setup, env vars, demo logins.

## Suggested build order (incremental, demoable)

1. Phase 0 + 1 + 2 (scaffold, auth, API client) → can log in.
2. Deliveries list + detail + dashboard → core value visible.
3. Delivery actions (status/assign/confirm) + products + issues.
4. Notifications + analytics/reports + admin (users/orgs).
5. Driver UI.
6. Real-time wiring across boards.
7. Polish + tests.

## Key risks / decisions

- **CORS must land first** (Phase 0) — otherwise nothing works in the browser.
- **Two token systems**: never send a user token to driver endpoints or vice versa; keep stores separate.
- **Universal ID**: sender/recipient/assignee pickers must emit `universal_id`; use
  `GET /universal-ids/resolve` when only `{id,type}` is known.
- **Frozen/immutable states**: handle `409` (frozen delivery, already-confirmed) and `403`
  (role/stock guards) with clear UI, not generic errors.
- **PDF export** returns `application/pdf` — fetch as blob and trigger download.
