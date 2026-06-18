# NewsTrack Frontend

React 18 + Vite + TypeScript SPA for the NewsTrack distribution tracking system.
Talks to the FastAPI backend under `/v1`. Stack: TanStack Query, React Router,
Tailwind CSS + shadcn/ui, React Hook Form + Zod, axios.

See [../docs/frontend_plan.md](../docs/frontend_plan.md) for the full build plan.

## Setup

```bash
npm install
cp .env.example .env      # adjust API/WS URLs if needed
npm run dev               # http://localhost:5173
```

The backend must be running at `http://localhost:8000` with CORS allowing
`http://localhost:5173` (already configured in `backend/app/config.py`).

## Scripts

- `npm run dev` — dev server
- `npm run build` — typecheck + production build
- `npm run preview` — preview the production build
- `npm run gen:api` — regenerate `src/types/api.d.ts` from the OpenAPI contract
- `npm run lint` — eslint

## Demo logins (after `python -m app.seed` in the backend)

Operations console (`/login`):

| Email | Password | Role |
| --- | --- | --- |
| admin@nt.example | admin-pass | Administrator |
| manager@nt.example | manager-pass | DistributionManager |
| operator@nt.example | operator-pass | HubOperator |
| vendor@nt.example | vendor-pass | Vendor |
| press@nt.example | press-pass | HubOperator (Press org — can create products) |

Driver app (`/driver/login`): mobile `9800000001` or `9800000002`, password `driver-pass`.

## Structure

```
src/
  api/         axios client (token injection, error envelope, 401 refresh), query client
  auth/        user + driver auth contexts, token store, route guards
  components/  shared UI (StatusBadge, ActorRefView, PageHeader, ui/* from shadcn)
  features/    one folder per domain (auth, dashboard, driver, ...)
  lib/         env, enums, utils
  routes/      router + app shell
  types/       generated api.d.ts + model aliases
```

## Auth model

Two **independent** JWT systems. Platform-user calls use the user token by
default; driver-app calls pass `{ audience: 'driver' }` to the axios client so
the driver token is attached. Tokens are never interchanged.
