# Udyam Digital — Airtel SYNC · Track A prototype

A mobile-first web app (installable PWA) that takes a small-business owner from **"tell us about your business"** to **an activated, tracked order** — in their language, with one transparent price and near-instant KYC — plus an operations console where sales, partners and KYC reviewers step in only where a person adds value.

> Understand → Recommend → Quote → Verify → Purchase → Activate → Track.
> **Rules decide, AI explains.** Eligibility, price and KYC verdicts are deterministic, unit-tested code; the model (optional) only reads the owner's words.

All business data is synthetic (supplied hackathon pack). Phone OTP (2Factor SMS), payments (Razorpay test mode), e-sign (PDF + SMS OTP),
fibre feasibility (India Post) and installation slots are **real**; prices are **indicative** (catalogue minimum). The Demo drawer shows
exactly which services are live right now.

## Run it
> **Evaluators:** `npm install && npm run build && npm start` works on a fresh clone with no cloud accounts (local database, auto-migrated). Vercel + Turso: see **docs/DEPLOYMENT.md**.

```bash
npm install
cp .env.example .env.local   # then fill in the keys you have (see the table below)
npm run dev                  # http://localhost:3000   (ops console: /ops)
npm run db:seed              # demo staff, engineer roster, + first admin if ADMIN_EMAIL/ADMIN_PASSWORD are set
npm run db:studio            # browse the database (schema: lib/db/schema.ts, migrations: ./drizzle)
```
| Key(s) in `.env.local` | Unlocks |
|---|---|
| `GEMINI_API_KEY` (paid tier recommended) | Free-form advisor in any language, document reading, bill reading |
| `TWOFACTOR_API_KEY` | Real SMS OTP for login and signing |
| `RAZORPAY_KEY_ID`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Test-mode payments (Netbanking → any bank → Success) |
| `TELEGRAM_BOT_TOKEN` (+ the generated `TELEGRAM_WEBHOOK_SECRET`) | Telegram bot |
| `META_WA_*` or `TWILIO_*` | WhatsApp |
| `PUBLIC_BASE_URL` | Links in chat/notifications and webhooks (`npm run tunnel` locally) — then `npm run setup:channels` |
| `SANDBOX_API_KEY`, `SANDBOX_API_SECRET` | DigiLocker + EntityLocker fetch via a licensed provider (no organisation needed); `DIGILOCKER_*` only if you hold API Setu credentials |
| `DATABASE_URL`, `DATABASE_AUTH_TOKEN` | Turso for a deployed site |

Without a key, that feature refuses honestly (the status panel says why); nothing is faked.

## Verify it
```bash
npm test                     # 140+ unit tests: rules engine, 5,000-lead backtest, KYC answer key, advisor conversation, channels
npm run typecheck && npm run build
npm run test:e2e             # 18 browser journeys at phone size (needs the dev server; BASE=… to target another port)
NEXT_DIST_DIR=.next-test npx next dev -p 3200   # a second dev server beside yours, e.g. for e2e
ALLOW_TEST_VERIFY=1 npm run dev   # then, in another terminal:
npm run check:journey        # live end-to-end API checks across the demo scenarios (uses the test-only OTP/payment seams)
npm run check:ai             # real Gemini calls: extraction in 6 languages + faithfulness (+ `-- --ocr` for all 47 specimens)
```

## What to try (judges)
| Try | You'll see |
|---|---|
| Landing → **Sharma-ji** (Hindi) | One-message extraction, plan with decision trace, WhatsApp refused with an honest alternative, AirFiber fallback, failed-payment retry |
| **Dr. Menon** → KYC | GSTIN looked up, planted **name mismatch** caught → human review → reviewer approves in `/ops/kyc` → customer tracker updates |
| **Spice Route** | 3 branches priced per site; only the branch without fibre falls back; lead + AI-style summary land with the assigned rep |
| **Vindhya Tours** | Cancelled GSTIN → live re-quote removes only GST products; blank Udyam number → re-upload |
| **Saffron Dental** | Blurred certificate caught from **measured sharpness**, not a filename |
| `/ops/lab` | Paste any business → extracted facts, every rule applied, priced plan, 0 violations |
| Chat: _"why do I need CCTV?"_, _"remove CCTV"_, _"make it 4 cameras"_, _"actually 2 shops"_, _"hindi mein batao"_ | Grounded answers, engine-checked changes, corrections, language switch — on web, WhatsApp and Telegram |
| Quote → _Ask your partner or CA_ | Read-only live share link + PDF, no personal data |
| Tracker | Pick an installation slot from the real roster; referral link after activation |
| `/catalogue`, Quote → _Compare packages_ | All 25 services with per-business eligibility; Basic / Recommended / Premium side by side |
| Quote → _Your digital score_ → _Download my business report_ | Advisory 0–100 score before/after, roadmap, PDF report |
| `/support` → ask → _Send to a person_ → reply from `/ops/support` | Grounded answers from the live order; agent sees full context; reply shows on Help + Notifications |
| `/ops/analytics`, `/ops/catalogue`, `/ops/customers`, `/ops/audit` | Filterable funnel/CAC/churn/NPS + pilot targets + churn risk; pause a product and watch quotes change |
| KYC page → _Demo · Attach set_ | Run any of the 12 supplied applicants (K01–K12) and compare with `kyc_expected.json` |

## How it's organised
```
app/                customer screens (/, /advisor, /quote, /order/[id]/{sites,consent,kyc,checkout}, /track, /account) and /ops/*
app/api/            advisor, quote, feasibility, consent, kyc, orders, ops/*, lab, mock/{gstin,udyam}
lib/rules/          the engine: normalise · eligibility · pricing/GST/schedule · recommend · quote editing · counterfactuals
lib/kyc/            identifiers (mod-36 GSTIN, OCR repair) · match · 20+ validators · OCR adapters · registries
lib/advisor/        deterministic extractor (en/hi) · orchestrator · Gemini understanding + grounded answers
lib/store, lib/db   orders/tracker state machine · libSQL document store · leads, propensity, stats
data/               the supplied CSVs and KYC images (read-only)       fixtures/   cached extractions + demo docs
tests/              rules (48) · kyc (33) · advisor (13)                scripts/    data generation + live journey check
docs/               ARCHITECTURE · PRIVACY_AND_SECURITY · DEMO_SCRIPT · CHECKLIST
```
See `docs/ARCHITECTURE.md` for the 8-block diagram and `docs/CHECKLIST.md` for what is done, partial or not built.

## Findings from the data (used in the product)
- 1,652 of 5,000 leads (33%) dropped for reasons a digital journey directly fixes → the **win-back** queue.
- 56 of 368 historical sales **violated the catalogue's own rules** and 22 activations used a **Cancelled/Suspended GSTIN**; historical bundles are therefore *not* ground truth for the engine.
- Chase calls correlate with churn (1 call → 6%, 5 → 28%); the app states correlation, never causation.

## Deploying
Step-by-step (Turso + Vercel, env vars, migrations, seeding, health check): **docs/DEPLOYMENT.md**.

Vercel for the Next.js app + a **persistent libSQL database (Turso)**: set `DATABASE_URL` / `DATABASE_AUTH_TOKEN`. Local SQLite files do not persist on serverless. _Not deployed from this environment._
