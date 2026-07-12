# TransitOps Backend

## Setup

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL (Neon) and AUTH_SECRET
npx prisma db push
npm run db:seed
npm run dev
```

Generate AUTH_SECRET: `openssl rand -base64 32`

## Login (seeded users, password: `Password123!`)

- admin@transitops.com — ADMIN
- fleet@transitops.com — FLEET_MANAGER
- safety@transitops.com — SAFETY_OFFICER
- finance@transitops.com — FINANCIAL_ANALYST

## Structure
app/                    App Router pages + auth/export route handlers
actions/                Server actions (CRUD + workflows), grouped by module
validations/            Zod schemas per module
services/               Business/query logic (dashboard KPIs, CSV)
utils/                  RBAC guards, action response wrapper
auth/                   NextAuth config
prisma/                 Schema + seed script
types/                  Shared/derived types
## Key Server Actions

| Module | File | Actions |
|---|---|---|
| Vehicles | `actions/vehicle.actions.ts` | createVehicle, getVehicles, getVehicleById, getDispatchableVehicles, updateVehicle, deleteVehicle |
| Drivers | `actions/driver.actions.ts` | createDriver, getDrivers, getDriverById, getDispatchableDrivers, updateDriver, deleteDriver |
| Trips | `actions/trip.actions.ts` | createTrip, getTrips, getTripById, updateTrip, dispatchTrip, completeTrip, cancelTrip |
| Maintenance | `actions/maintenance.actions.ts` | createMaintenance, getMaintenanceLogs, closeMaintenance |
| Fuel | `actions/fuel.actions.ts` | createFuelLog, getFuelLogs |
| Expenses | `actions/expense.actions.ts` | createExpense, getExpenses, updateExpense, deleteExpense |
| Dashboard | `actions/dashboard.actions.ts` | getDashboardData, getVehicleROIData |
| Reports | `actions/report.actions.ts` | getVehiclesReport, getDriversReport, getTripsReport, getMaintenanceReport, getFuelReport, getExpenseReport, getAnalyticsReport |
| Users | `actions/auth.actions.ts` | createUser (ADMIN only) |

All actions return `ActionResult<T>`: `{ success: true, data }` or `{ success: false, error, fieldErrors? }`.

## CSV Export

`GET /api/export/csv?entity=vehicles|drivers|trips|maintenance|fuel|expenses|dashboard`

Requires an authenticated session (cookie-based). Downloads a CSV file directly.

## Trip Lifecycle

`createTrip` → **DRAFT** → `dispatchTrip` (validates + locks vehicle/driver) → **DISPATCHED** → `completeTrip` (odometer, fuel log, releases vehicle/driver) → **COMPLETED**, or `cancelTrip` from DRAFT/DISPATCHED → **CANCELLED**.

## Deployment

### Vercel (recommended)

1. Push this repo to GitHub.
2. Vercel → **Add New Project** → import the repo.
3. Root Directory: `transitops` (the folder containing `package.json`).
4. Framework Preset: Next.js (auto-detected). Leave Build/Install/Output commands as default.
5. Add environment variables (copy values from your local `.env`):
   `DATABASE_URL`, `AUTH_SECRET`, `NEXTAUTH_URL` (set to your Vercel domain, e.g. `https://transitops.vercel.app`), `RESEND_API_KEY`, `RESEND_FROM`, `REMINDER_EMAIL_TO`, `CRON_SECRET`.
6. Deploy.
7. After the first successful deploy, push the schema and seed the database from your local machine (pointed at the same `DATABASE_URL`):
```bash
   npx prisma db push
   npm run db:seed
```
8. The `/api/cron/license-reminders` job runs automatically via the schedule in `vercel.json` — no extra setup.
9. If `NEXTAUTH_URL` wasn't known before the first deploy, update it to the real assigned domain afterward and trigger a redeploy — a stale `NEXTAUTH_URL` breaks auth in production.

### Render (alternative)

`render.yaml` defines a web service, a cron service, and a managed Postgres DB as a Blueprint. In the Render dashboard: **New → Blueprint**, connect the repo, and it provisions all three. Fill in the `sync: false` env vars manually in the dashboard (`AUTH_SECRET`, `NEXTAUTH_URL`, `RESEND_API_KEY`, `RESEND_FROM`, `REMINDER_EMAIL_TO`, `CRON_SECRET`, `APP_URL` on the cron service). Only use one deployment target at a time — don't run both simultaneously against the same database.

## Notes

- `dispatchTrip` is a separate action from `createTrip` so trips can be created as drafts and validated/dispatched independently — all dispatch business rules (retired/in-shop/on-trip vehicle, suspended/expired/on-trip driver, cargo capacity) run at dispatch time.
- Fuel log created on `completeTrip` records liters only (cost defaults to 0); log actual fuel cost separately via `createFuelLog` if needed.
- PDF export and email reminders were intentionally skipped (🟡/🔴 priority) to protect the 5-hour budget — CSV export and all 🟢 essentials are complete.
