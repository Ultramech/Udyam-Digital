# Implementation checklist — what is done, what waits on a key, what needs you

Legend: ✅ built and verified live · 🔑 built, verified with tests, live run waits on a key · 🧑 needs the team.
"Verified" = unit tests, browser journeys (`npm run test:e2e`), live API checks and/or a real run against the real service.

## Judged must-builds
| Item | Status | Evidence |
|---|---|---|
| Rules engine (eligibility, dependencies, quantities, price, GST, contract, schedule, declined features) | ✅ | 0 violations across 5,000 lead profiles; fuzzed; conversation tests |
| Advisor: free-form conversation (questions, changes, corrections, what-ifs, language switch) | ✅ | live: install time, leased-line eligibility, "remove backup internet", "4 cameras", "actually 2 shops", Hindi switch |
| Advisor languages (en/hi/mr/ta/te + Hinglish) and faithfulness gate | ✅ | `npm run check:ai` 13/13 |
| Quote & checkout (one monthly price, toggleable add-ons, budget, lighter/fuller) | ✅ | e2e + live API |
| Smart KYC: GSTIN/Udyam registry, validators, consent, re-quote | ✅ | 12/12 applicants vs `kyc_expected.json` |
| Smart KYC: document reading (Gemini vision) | 🔑 | accuracy run on 47 specimens blocked by the free tier (20 req/day/model) |
| Tracker (real state, lanes, delay, action card, slot picker, notifications) | ✅ | ops advances → tracker follows |

## Real services
| Item | Status | Evidence |
|---|---|---|
| Phone OTP — 2Factor SMS | ✅ | real SMS to a real phone, verified session |
| Payments — Razorpay test mode | ✅ | ₹10,284 captured; forged signature refused |
| e-Sign — PDF + SMS OTP + certificate | 🔑 | built; live run needs an order (needs document reading) |
| Fibre feasibility — India Post + ops coverage | ✅ | 110001 → Central Delhi |
| Installation slots — roster + unique bookings | ✅ | book / rebook / release verified |
| DigiLocker — OAuth 2.0 + PKCE | 🔑 | needs API Setu partner credentials (registered organisation) |
| WhatsApp — Meta Cloud API / Twilio | 🔑 | webhook + pushes unit-tested; needs keys + public URL |
| Telegram bot | 🔑 | unit-tested incl. contact verification; needs BotFather token |

## Plan differentiators (MASTER_PLAN Part D)
| Item | Status |
|---|---|
| D1 decision trace · D2 Scenario Lab · D3 counterfactuals · D4 budget · D6 backtest + win-back · D7 zero-chase tracker · D9 self-healing KYC · D10 consent-aware LLM · D14 lead summary + NBA | ✅ |
| D8 share plan with the decision-maker (live link + PDF) | ✅ live: link reflects edits, no PII, PDF |
| D11 bill-photo savings (honest comparison) | 🔑 comparison unit-tested; reading needs Gemini quota |
| D12 voice notes | ✅ wired (browser speech API); not testable headless |
| D13 CX scorecard | ✅ ops overview |
| Rep/partner co-pilot with verified assist credit | ✅ live: URL rep id ignored, staff session credited |
| Referral after activation | ✅ (checked in `check:journey`) |
| Marathi + Tamil UI | ✅ full dictionaries (205 keys each); a few inline strings fall back to Hindi (mr) / English (ta) |
| Mobile layout: no sideways scroll at 390 px | ✅ fixed header overflow; e2e asserts it |

## Blueprint gap-fill (2026-11-06)
| Item | Status | Evidence |
|---|---|---|
| Basic / Recommended / Premium side-by-side, needs coverage, one-tap switch | ✅ | `lib/rules/packages.ts`, unit + e2e |
| Product catalogue screen (search, category/price filters, per-business status, add to plan) | ✅ | `/catalogue`, e2e |
| Digital maturity score (advisory) + roadmap + downloadable business report PDF | ✅ | `lib/maturity`, `/api/quote/[id]/report`, unit + e2e |
| Support centre: FAQs, grounded order assistant, tickets, human handoff with context, ops queue | ✅ | `/support`, `/ops/support`, route tests + e2e |
| Notifications inbox + header bell | ✅ | `/notifications`, e2e |
| Cancel before install (real Razorpay refund, once — concurrency-locked), upgrade / new-branch reorder | ✅ | route tests (refund request shape, double-cancel) |
| KYC: PDF uploads, magic-byte sniffing, same-file detection, cross-application indicator, review score | ✅ | `lib/kyc/{anomaly,confidence}.ts`; clean controls all score above planted cases |
| Ops: customers (multi-business per phone), catalogue admin (pause/price-in-band + history), audit log, analytics with filters + pilot targets | ✅ | route tests + e2e; analytics reproduces the case funnel exactly |
| Churn-risk model at activation (6 features, no leakage) | ✅ | 5-fold CV AUC 0.625, top-quartile lift 1.5× — modest, stated as such |
| Price changed during checkout → order refused with new price | ✅ | route test |
| Live Gemini OCR accuracy on all 47 specimens | 🔑 | free-tier quota exhausted on 2026-11-06; run `npm run check:ai -- --only=ocr` after reset or with a paid key |

## Accounts, database, deployment (2026-11-06)
| Item | Status | Evidence |
|---|---|---|
| Relational schema (35 tables) + versioned migrations (drizzle), Turso-ready; legacy importer | ✅ | `lib/db/schema.ts`, `drizzle/`, schema-sync test |
| Customer accounts: phone-OTP sign-in, hashed 30-day sessions, visitor records claimed, profile + notification prefs, multiple businesses + locations, devices, export, delete | ✅ | `tests/features/accounts.test.ts`, `e2e/accounts.spec.ts` |
| Staff accounts: email + scrypt password, lockout, team admin, forced password change; demo logins only in DEMO_MODE; forged id cookie refused | ✅ | same |
| Sign-up flow: `/login` (sign in or create account) → `/account/setup` (name, profile type, email, language, first business; skippable) → back to where they were; profile type editable on `/account` | ✅ | accounts tests + e2e |
| OTP-first: every customer page (proxy.ts + AuthGate) and API (lib/accounts/guard.ts) needs a verified phone + completed profile; quotes/orders/KYC open only for their owner (others → 404/403) | ✅ | accounts tests, e2e "signed out → sign in first", journey S0 |
| Mandatory validated setup: name (Indian scripts), profile type, email, business type + city from reference lists, staff/sites ranges, address, pincode checked live with India Post, GSTIN checksum, Udyam format | ✅ | accounts tests (422 per field), e2e sign-up walk-through |
| Route audit (`npm run check:routes`): every link/API call in code resolves, every page 200, every API clean signed-out | ✅ | 33 pages · 82 targets · 73 APIs, 0 failures |
| Deploy: env check at boot (fail-fast), `/api/health`, security headers, migrate+seed on Vercel build, `docs/DEPLOYMENT.md` | ✅ | prod start with a local DB refuses to boot with a clear message |

## Delivery
| Item | Status |
|---|---|
| Unit tests, type check, production build | ✅ |
| Committed Playwright journeys (`npm run test:e2e`) | ✅ 9/9 |
| Live API journey (`npm run check:journey`) | ✅ script updated (roster seeding, share, referral); run with `ALLOW_TEST_VERIFY=1` |
| Deployment (Vercel + Turso) | 🧑 |
| Paid Gemini key, chat keys, Firebase key rotation | 🧑 |
| Business-case deck, demo video | 🧑 (deferred by the team) |

## Funnel & experience features (added after the plan)
| Item | Status | Notes |
|---|---|---|
| Pincode availability on the first screen (`/api/availability`) | ✅ | real India Post lookup + ops coverage; labelled estimate; names the catalogue's 5G AirFiber when fibre is unlikely |
| GSTIN help card (what it unlocks, official registration steps) | ✅ | driven by the rules engine's own counterfactual; free self-service portal |
| Reserve-now / pay-the-rest checkout (`NEXT_PUBLIC_DEPOSIT_*`) | 🔑 | server decides the amount; activation held until the balance is paid; unit-tested, live Razorpay run not done (no payments made) |
| Engineer "on the way" (ops button → tracker badge + WhatsApp/Telegram) | ✅ | unit-tested; delivery waits on channel keys |
| Stuck-order sweep → proactive delay notice | ✅ | real-clock SLA (`STAGE_SLA_HOURS`), once per stage |
| One-time resume reminder | 🔑 | only verified phone + "service" consent; WhatsApp needs the 24h window or Telegram link; needs `CRON_SECRET` + a scheduler |
| Partner book (`/ops/partners`) | ✅ | real paid-order figures; commission rate is never assumed (`PARTNER_COMMISSION_PERCENT`) |
| "Request a call" with day + window | ✅ | needs OTP-verified phone; lands on the ops lead as a callback |
| First-bill summary (first bill / monthly / contract total) | ✅ | in the quote breakdown sheet |
| Read replies aloud (advisor) | 🔑 | browser speech API; not testable headless; says so when the device has no voice for the language |


## Case Key Questions 1 and 4 (added 2026-11-06)
| Item | Status | Notes |
|---|---|---|
| Segment & channel playbook (`/ops/playbook`): segments ranked by year-one revenue per ₹1 of acquisition spend, advisor bundle + price per segment, cheapest and wasteful channels, segment × channel CAC grid, GSTIN effect | ✅ | computed from smb_leads.csv; thin cells (<30 leads) never used for a conclusion; unit test pins totals to the case funnel. Page not yet opened in a browser. |
