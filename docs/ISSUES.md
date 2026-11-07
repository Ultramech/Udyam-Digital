# Open issues and gaps (audit of 2026-11-07)

Audited against `Airtel_SYNC_Case.pdf` and the data README, on `main` at `5dbc95d`.
Method: type check, 231 unit tests, production build, 25 browser journeys, route audit, 65-check live API journey, a live OCR run, and a manual phone/desktop/dark-mode walk-through of advisor → quote → sites → consent → KYC.
Severity: **P0** can fail a judged demo, **P1** visible defect or missing requirement, **P2** polish.

## What passed
- Type check clean · 231/231 unit tests · production build · 25/25 browser journeys · route audit (every link/API resolves) · live journey 65/65.
- Advisor, quote (one price, toggles), consent screen, KYC registry lookups and planted-problem catches, tracker logic, ops console, WhatsApp and Telegram all behave as the case asks.
- Real KYC read on the sample set caught a genuine address mismatch ("Shop 14" vs "Shop 4") and sent it to review without blocking payment.

## P0 — can fail a live demo
| # | Issue | Evidence | Fix |
|---|---|---|---|
| 1 | **Gemini free-tier quota is exhausted.** Document reading, free-form advisor answers and bill reading all need it. Judges upload KYC documents live. | Live probe returns HTTP 429 "exceeded your current quota". The two OCR accuracy runs I did on 2026-11-07 likely consumed the day's quota; the "UNAVAILABLE" stop in both runs was probably the same cause. | Enable billing on the Gemini key (paid tier), or add a second key/project. Do not run `check:ai` again on the free tier before the demo. |
| 2 | **Live OCR accuracy on all 47 specimens is still unproven.** Both runs stopped at K05, so K06–K12 were never read live. | On the 5 documents read: 89/96 fields exact (92.7%); all 7 misses are a stray space inside an address word ("A ndhra"), which `addressesMatch` already tolerates. One real miss: `K05_address_proof` document type came back `null` (expected "Electricity bill"). | After enabling billing: `npm run check:ai -- --only=ocr`. Treat the K05 null document type as a bug to investigate. K06 (planted typo must be read literally) and K07 ("Shri Physio" name) are unverified live. |

## P1 — missing or visible defects
| # | Issue | Detail | Fix |
|---|---|---|---|
| 3 | **DigiLocker + EntityLocker via a licensed provider (branch `digilocker-sandbox-api`) — built, not yet tested live.** | Adapter for Sandbox.co.in (`lib/digilocker/aggregator.ts`): owner consents on DigiLocker's own screen; Aadhaar (DigiLocker) fills Signatory ID / Address proof, EntityLocker fills GST and Udyam. Unit-tested against a mocked provider (auth, token reuse, re-auth, status, download, size cap, no-keys). **Open:** (a) the key in `.env.local` is a `key_live` (billed) key, not a free `key_test` one; (b) DigiLocker needs a public https redirect, so a real run only works on the deployed site with `SANDBOX_API_KEY/SECRET` and `PUBLIC_BASE_URL` set in Vercel; (c) the exact Aadhaar XML layout DigiLocker returns has not been seen (parser accepts both known attribute spellings); (d) EntityLocker documents are read by Gemini, so they depend on its quota. | Decide on using the live key; set Vercel env; run once with a real DigiLocker. |
| 4 | **Aadhaar verification: built as Paperless Offline e-KYC (branch `kyc-aadhaar-digilocker`).** | Owner uploads UIDAI's signed ZIP + their share phrase; we open it, verify UIDAI's XML-DSig signature locally against UIDAI's published key, and keep only name, address and the last 4 digits (photo, hashed mobile/email, file and phrase discarded). Works in the Signatory ID and Address proof slots. 8 new tests: valid file, wrong phrase, edited name, wrong signer, unsigned, non-UIDAI XML, non-ZIP, smuggled unsigned element. **Not verified against a real UIDAI file** (needs someone to download their own at myaadhaar.uidai.gov.in); UIDAI's published certificate itself expired in 2019, so we verify with its public key only. Check UIDAI's offline-verification registration rules before production. Online Aadhaar eKYC / Aadhaar eSign remain out of scope (licensed agency). | Test once with a real downloaded file before the demo. |
| 5 | **Fresh KYC slots say "Please re-upload".** | On first visit, untouched slots show an amber "Please re-upload — This document hasn't been provided". It reads like an error before the owner has done anything. | Show "Needed" for a never-uploaded slot; keep "Please re-upload" for a rejected one. |
| 6 | **Installation form does not use the saved address.** | The account already has a business location (address + pincode) but `/order/[id]/sites` is empty and asks again. | Prefill location 1 from the selected business's first saved location. |
| 7 | **Demo sign-in can collide with a real phone number.** | `/api/demo/signin` picks a random 10-digit number starting with 9 and signs in as that phone. About 1 in 10^9 per click it would land on a real registered user. Rate limit is 20/hour/IP. | Use a reserved, non-routable range for demo numbers (and refuse to reuse an existing real account). |
| 8 | **Production sign-in for evaluators without a +91 number.** | Real OTP only works for Indian numbers. The new "Try the demo" button solves this while `DEMO_MODE` is on. | Keep `DEMO_MODE` on for judging; confirm the production env var is set. |

## P2 — polish
| # | Issue | Detail |
|---|---|---|
| 9 | KYC "Check results" repeats what the slot cards above it already say. | Remove, or collapse into one summary line. |
| 10 | Advisor repeats "Got it — Pharmacy in Indore." on every turn. | Acknowledge once, then go straight to the next question. |
| 11 | Desktop Home is a phone-width column in a 1280px window; Plans uses the width well. | Widen Home to a two-column layout from `lg`. |
| 12 | Marathi and Tamil: a few inline strings fall back to Hindi / English. | Listed in `docs/CHECKLIST.md`; finish the dictionary entries. |
| 13 | A stale quote id in browser storage causes a harmless 404 in the console on Home. | Clear the stored id when the API returns 404. |
| 14 | `docs/DESIGN.md` still describes the v1 paper-and-ink tokens ("warm paper", "no shadows"). | Update to the current red/pink system and dark mode. |

## Not verified by hand (covered by automated tests only)
Tracker with a real paid order, installation-slot picker, cancel/refund, referral, ops screens other than the e2e paths, Support and Notifications visuals, share page, WhatsApp/Telegram live delivery today, Marathi/Tamil visuals, the teammate's new Plans/Orders/Rewards/Account screens beyond Plans.

## Remaining from the problem statement
| Item | State |
|---|---|
Key Questions 1, 4 and 5 are answerable from `/ops/playbook` and `/ops/analytics`. |
| Architecture diagram | `docs/ARCHITECTURE.md` is a text block diagram; a rendered image for the submission is still to do. |
| 1-page privacy and security note | `docs/PRIVACY_AND_SECURITY.md` (39 lines); check it fits one page when exported. |

## How the supplied data is used
| File | Used for | Where |
|---|---|---|
| `product_catalogue.csv` (25) | Generated into `lib/catalogue/catalogue.generated.json`; eligibility, dependencies, price band, install days; shown on `/catalogue`; ops can pause or re-price within band | `lib/catalogue`, `lib/rules`, `app/catalogue`, `app/ops/catalogue` |
| `smb_leads.csv` (5,000) | Rules-engine backtest (0 violations), funnel/CAC/churn/NPS analytics reproducing the case funnel exactly, segment × channel playbook, win-back queue, propensity/churn-risk model (AUC 0.625, stated as modest), reconciliation of 56 rule-violating sales and 22 cancelled-GSTIN activations | `lib/leads/*`, `/ops/analytics`, `/ops/playbook`, `/ops/leads` |
| `mock_gstin_registry.csv` (3,534) | Real mod-36 checksum, registry lookup incl. Cancelled/Suspended, mock API | `lib/kyc/registry.ts`, `/api/mock/gstin/[g]` |
| `mock_udyam_registry.csv` (2,723) | Udyam lookup and name/address match | `lib/kyc/registry.ts`, `/api/mock/udyam/[u]` |
| `kyc_documents/` (47) | All 12 applicants run through validators and compared with the answer key (12/12); sample-set attach in the KYC screen; live OCR accuracy script | `tests/kyc/specimens.test.ts`, `kyc_expected.json`, `scripts/check-ai.ts` |

## Suggested order
1. Enable Gemini billing (P0 #1), then re-run the OCR check (P0 #2).
2. Fix #5, #6, #7, #10 (small, safe), then #9, #11.
3. Decide on DigiLocker (#3): apply for partner access or hide the toggle.
