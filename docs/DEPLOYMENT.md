# Deploying Udyam Digital (Vercel + Turso)

> **Live deployment:** https://udyam-digital-kappa.vercel.app (Vercel project `udyam-digital`, Turso database `udyam-digital-db` provisioned through the Vercel Marketplace; health at `/api/health`).
>
> **Auto-deploy:** the Vercel project is linked to this GitHub repo. A push to `main` redeploys production; other branches get protected preview deployments.
> Deploy from this folder with `vercel deploy --prod` (`.vercelignore` keeps local build output out of the upload). The Vercel Turso integration sets
> `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN`; the app accepts those names as well as `DATABASE_URL` / `DATABASE_AUTH_TOKEN`.

The app is a Next.js 16 app with a libSQL database. Locally it uses a SQLite file (`.data/udyam.db`); in production it uses
**Turso** (hosted libSQL — same SQL, same code). Nothing is written to local disk in production: document images are read in
memory and never stored, so no file storage service is needed.

## 1. Database (Turso) — 5 minutes
```bash
brew install tursodatabase/tap/turso      # or: curl -sSfL https://get.tur.so/install.sh | bash
turso auth signup                          # free tier is enough
turso db create udyam-digital --location aws-ap-south-1   # Mumbai, next to the Vercel bom1 region
turso db show udyam-digital --url          # → DATABASE_URL (libsql://…)
turso db tokens create udyam-digital       # → DATABASE_AUTH_TOKEN
```
Apply the schema and seed from your machine once (the Vercel build also does this on every deploy):
```bash
DATABASE_URL=libsql://… DATABASE_AUTH_TOKEN=… npm run db:migrate
DATABASE_URL=libsql://… DATABASE_AUTH_TOKEN=… ADMIN_EMAIL=you@company.com ADMIN_PASSWORD='a-long-passphrase' npm run db:seed
```
Optional — bring your local demo data along: `DATABASE_URL=… DATABASE_AUTH_TOKEN=… npm run db:import-legacy` copies a legacy
`docs` table (pre-migration format) if your local DB has one; otherwise use `turso db shell` to load a dump.

## 2. Vercel
1. Push the repo to GitHub, then **Vercel → Add New → Project → import** it. Framework is detected; `vercel.json` sets the build
   command to `npm run vercel-build` = **migrate → seed → next build**, the region to `bom1` (Mumbai) and the daily cron.
2. **Settings → Environment Variables** (Production + Preview):

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL`, `DATABASE_AUTH_TOKEN` | **yes** | from step 1; the app refuses to boot in production with a local `file:` URL |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` (`ADMIN_NAME`) | yes if `DEMO_MODE=false` | first admin; created once by the seed, never overwritten |
| `DEMO_MODE` | – | `true` for judging (one-click demo staff, sample documents, demo reset); `false` for real use |
| `PUBLIC_BASE_URL` | recommended | `https://<your-domain>` — used in SMS/WhatsApp/Telegram links and webhooks |
| `CRON_SECRET` | recommended | long random string; Vercel Cron sends it to `/api/cron/housekeeping` |
| `NEXT_PUBLIC_REFERENCE_DATE` | – | `2026-07-15` (the dataset's "today") |
| `GEMINI_API_KEY` (+ `GEMINI_MODEL`) | for AI | advisor understanding + document reading; **use a paid key** — the free tier is 20 requests/day/model |
| `TWOFACTOR_API_KEY` | for OTP | without it nobody can sign in or order |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID` | for payments | test keys (`rzp_test_…`) until you go live |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `META_WA_*` / `TWILIO_*` | optional | chat channels |
| `DIGILOCKER_*` | optional | needs API Setu partner onboarding |

**Never set `ALLOW_TEST_VERIFY` on Vercel** (it is ignored in production builds anyway).

3. Deploy. Then check **`https://<domain>/api/health`** → `{"status":"ok","database":{"ok":true,…}}`. A `503` lists what is missing.
4. Webhooks (if you use chat channels): `PUBLIC_BASE_URL=https://<domain> npm run setup:channels`.
5. Sign in at `/ops/login` with `ADMIN_EMAIL`, set your own password, and add your team under **Team**.

## 3. What happens on each deploy
- `db:migrate` applies new files from `./drizzle` (committed SQL). Additive migrations are safe while the old version is still
  serving; for a destructive change, ship it in two deploys (stop using the column → drop it).
- `db:seed` is idempotent: it creates the first admin only if missing, demo staff only in `DEMO_MODE`, and the engineer roster only if empty.

## 4. Changing the schema
1. Edit `lib/db/schema.ts` (and the column extractors in `lib/db/store.ts` if you index a new field).
2. `npm run db:generate -- --name <what-changed>` → review the new SQL in `./drizzle`, commit it.
3. `npm test` (a test fails if the store, schema and migrations drift apart). Locally the dev server applies it automatically.

## 5. Operations checklist
- **Backups:** Turso keeps point-in-time history (`turso db restore` / branching). Take a `turso db shell udyam-digital .dump` before risky migrations.
- **Monitoring:** point an uptime monitor at `/api/health`. Vercel logs show `[env]` warnings at boot.
- **Secrets:** rotate `DATABASE_AUTH_TOKEN`, Razorpay and 2Factor keys from their dashboards; sessions survive (they're DB rows, not signed with an app secret).
- **Sessions:** customers 30 days, staff 8 hours; tokens stored as SHA-256 only. "Sign out other devices" and staff deactivation revoke them server-side.
- **Data rights (DPDP):** owners download (`/api/me/export`) or delete (`/api/me`, `/api/account`) their data themselves; orders are kept anonymised.
- **Cron:** Vercel Hobby runs `/api/cron/housekeeping` once a day; for hourly, call it from any scheduler with `Authorization: Bearer $CRON_SECRET`.

## 6. Evaluators: run it on your own machine (no cloud accounts needed)
```bash
npm install
cp .env.example .env.local        # optional keys; without them each integration says "not configured"
npm run build && npm start        # production mode on http://localhost:3000 — the database file is created and migrated automatically
open http://localhost:3000/api/health    # → {"status":"ok", "database":{"ok":true, "migrations":2}}
```
Ops console: `/ops/login` → one-click demo accounts (while `DEMO_MODE` isn't `false`). Customer pages require an SMS OTP
(`TWOFACTOR_API_KEY`); for scripted checks only, `ALLOW_TEST_VERIFY=1 npm run dev` enables the test sign-in seam.

What was verified before release: a fresh empty database comes up healthy in production mode; every data file the server reads
(registries, leads, sample documents, migrations) is included in the Vercel function bundles; AI calls stop within 40 s so they
never hit Vercel's 60 s limit; account deletion works even where SQLite foreign-key cascades are off (Turso over HTTP);
on Vercel a local-file database or an unmigrated database is refused with a clear message — at build time, before going live.
Not verifiable from the build machine: a live Turso instance (do the step-1 commands, then check `/api/health`).

## 7. Local development
```bash
cp .env.example .env.local      # fill what you have; everything optional locally
npm install
npm run dev                     # migrates .data/udyam.db automatically
npm run db:seed                 # demo staff + roster (+ admin if ADMIN_EMAIL/ADMIN_PASSWORD set)
npm run db:studio               # browse the database
```
