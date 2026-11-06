# Architecture — Udyam Digital

**One rule drives the design: _rules decide, AI explains._** Eligibility, price, KYC verdicts and order state come from deterministic,
unit-tested code. The language model (Gemini) turns the owner's words into structured facts and intents, explains the plan, and answers
questions — always from a context the code assembled, and every number it writes is checked against the engine's output.

```
 ┌───────────────────────────────────────────────────────────────────────────────────────────────┐
 │ 1  CHANNELS   Customer PWA (en/hi/mr/ta) · voice · in-app chat · WhatsApp (Meta Cloud API / Twilio) │
 │               · Telegram bot · share-plan links · referral links · rep co-pilot                      │
 └───────────────┬───────────────────────────────────────────────────────────────────────────────┘
                 ▼
 ┌───────────────────────────────┐ facts, ┌──────────────────────────────────────────────────────┐
 │ 2  ADVISOR  (Gemini + rules)  │ intents│ 3  RULES & PRICING ENGINE   (pure, isomorphic TS)       │
 │  facts · corrections · "remove├───────▶│  catalogue (CSV) · eligibility · dependencies · declined│
 │  X" · sizes · language switch │        │  features · quantities · price/GST · schedule · budget  │
 │  grounded Q&A + what-ifs      │◀───────┤  · counterfactuals · decision trace                     │
 │  faithfulness gate on numbers │ result └──────────────┬─────────────────────────────────────────┘
 └───────────────┬───────────────┘                       │ same engine validates every quote & order
                 ▼                                       ▼
 ┌───────────────────────────────────────────────────────────────────────────────────────────────┐
 │ 4  QUOTE · ORDER · TRACKER   quote editing · India Post feasibility + ops coverage · e-sign       │
 │    (PDF + SMS OTP + certificate) · Razorpay · order state machine · engineer slots · notifications │
 └───────────────┬───────────────────────────────────────────────────────────────────────────────┘
                 ▼
 ┌───────────────────────────────────────────────────────────────────────────────────────────────┐
 │ 5  SMART KYC   consent gate → GSTIN (mod-36 + OCR repair) / Udyam registry → only-missing docs   │
 │    (upload or DigiLocker OAuth) → Gemini vision transcription → 20+ validators with reason + fix │
 │    → verdict (verified / re-upload / review / blocked) → automatic re-quote                       │
 └───────────────┬───────────────────────────────────────────────────────────────────────────────┘
                 ▼
 ┌───────────────────────────────────────────────────────────────────────────────────────────────┐
 │ 6  OPS CONSOLE  leads (+propensity, win-back) · KYC review · orders board · coverage & roster ·   │
 │                 overview (live vs historical) · CX scorecard · Scenario Lab · role-based           │
 └───────────────┬───────────────────────────────────────────────────────────────────────────────┘
                 ▼
 ┌─────────────────────────────────────────────┐   ┌──────────────────────────────────────────────┐
 │ 7  DATA   libSQL/SQLite (Turso-ready) typed  │   │ 8  TRUST LAYER                                 │
 │    document store · consent ledger · audit · │   │  consent guards · masking · RBAC · signed      │
 │    supplied CSVs read-only                   │   │  webhooks · fail-closed services · zod         │
 └─────────────────────────────────────────────┘   └──────────────────────────────────────────────┘
```

## External services (every one fails closed: no key → it refuses, nothing is faked)
| Concern | Service | Code |
|---|---|---|
| Language understanding, explanations, Q&A, document reading | Google Gemini (per-model fallback chain; vision only on full-size models) | `lib/ai/gemini.ts`, `lib/advisor/llm.ts`, `lib/kyc/ocr.ts` |
| Phone OTP (login + signing) | 2Factor.in SMS | `lib/otp/flow.ts` |
| Payments | Razorpay (test mode): server order, HMAC signature + payment lookup | `lib/services/razorpay.ts` |
| e-Sign | Own: pdf-lib order form, SHA-256, OTP bound to the hash, certificate page | `lib/esign/pdf.ts` |
| Fibre feasibility | India Post pincode directory + ops coverage overrides | `lib/feasibility` |
| Scheduling | Own engineer roster + unique slot bookings | `lib/scheduling` |
| WhatsApp | Meta Cloud API (preferred) or Twilio | `lib/channels/{meta,twilio,whatsapp}.ts` |
| Telegram | Bot API with secret-token webhook | `lib/channels/telegram.ts` |
| DigiLocker | OAuth 2.0 + PKCE (needs API Setu partner credentials) | `lib/digilocker/client.ts` |
| GSTIN / Udyam lookups | The case's supplied registries (the brief asks for mocked lookups; no free official API exists) | `lib/kyc/registry.ts` |

## Data flow (one journey)
1. Owner chats (web, WhatsApp or Telegram) → **Advisor** extracts facts and intent → asks only what's missing, or answers the question.
2. **Rules engine** returns the plan, exclusions with reasons, counterfactuals and a **decision trace**; the model never sets a price.
3. **Quote** edits go to the server; the engine re-prices and refuses invalid combinations. The owner can share a read-only live link.
4. **Feasibility** per site: India Post data, ops coverage first; a non-fibre site swaps to AirFiber only if the catalogue allows it.
5. **Consent** is recorded per purpose; every KYC call is refused without it.
6. **KYC**: registry first, then only the missing documents; failures carry a reason and a fix; cancelled GST → automatic re-quote.
7. **Sign** (PDF + SMS OTP) → **Pay** (Razorpay) → **Order** → **Tracker**, which reads the same record that **Ops** advances; the owner
   picks an installation slot; every update is pushed to WhatsApp/Telegram (service consent only).

## Deliberate prototype trade-offs
- Persistence is a typed **document store** on libSQL; collections map 1:1 to the plan's entities.
- Prices are **indicative** (catalogue minimum). GSTIN/Udyam use the supplied synthetic registries.
- e-Sign is an IT-Act electronic signature (OTP-bound, hashed, certificated), not Aadhaar eSign, which requires a licensed ASP.
