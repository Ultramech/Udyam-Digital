# Privacy & security note (1 page)

_A privacy-conscious prototype designed around consent, purpose limitation and data minimisation. It does **not** claim legal
certification under the DPDP Act, 2023 — that needs a formal review._ All business data in this repository is synthetic.

## What we collect, why, and for how long
| Data | Purpose | Required? | Retention shown to the user |
|---|---|---|---|
| Phone number (verified by SMS OTP) | Save a quote, order, sign, receive updates | Required to buy | Contract term |
| GSTIN / Udyam number, certificates, signatory ID | Verify the business (KYC) | Required to buy | Images are never stored; extracted fields kept for the contract + statutory period |
| Site address + pincode | Feasibility and installation | Required | Contract term |
| DigiLocker documents | Fetch instead of upload | Optional, **off** | One document per slot; token never stored |
| Bill photo | Compare current spend | Optional | Photo never stored; only the monthly amount |
| SHA-256 of each uploaded document | Spot the same file in two slots; show reviewers a file seen in another application (indicator, never a verdict) | Automatic | Erased with the KYC case on "delete my data" |
| Support requests | Answer the owner's question; hand context to an agent | Optional | Erased on "delete my data" (staff see masked context only) |
| Offers & product updates | Marketing | Optional, **off by default** | Until withdrawn |

## Choices built into the design
- **Consent before collection, enforced in code.** KYC endpoints return `403` without a recorded KYC consent; WhatsApp/Telegram order
  updates are sent only with the "service" purpose; DigiLocker needs its own optional consent. Receipts record id, notice version, purposes, time.
- **Purpose limitation and minimisation.** Registry lookup first, then only the missing documents. A login OTP can never sign an order (codes
  are purpose-bound). Share links show the plan and price only — no phone, GSTIN or address.
- **The AI never sees identifiers.** Only the owner's free text goes to the model; documents go to the vision model only after KYC consent, in
  memory. Model output is untrusted input: facts are range-checked, intents whitelisted, and any number in an answer that the engine didn't
  produce causes the answer to be discarded.
- **Fail closed.** Without its key, each service refuses (`503`) instead of pretending: OTP, payments, document reading, chat channels, DigiLocker.
  The old demo shortcuts (fixed OTP, payment outcome picker, one-click sign) only exist behind `ALLOW_TEST_VERIFY=1`, never in production.
- **Payments and signatures you can verify.** Razorpay signatures are HMAC-checked and the payment is re-read from Razorpay (order id, exact
  amount, status). Signed order forms carry a SHA-256 of the exact PDF shown, the time, masked phone and IP.
- **Webhooks are authenticated.** Meta (`X-Hub-Signature-256`), Twilio (`X-Twilio-Signature`) and Telegram (secret token) are verified with
  constant-time comparisons; retries are de-duplicated. A Telegram number is trusted only when the user shares their **own** contact.
- **Access control.** Ops actions need a role, enforced server-side and audit-logged. Sales credit comes only from a signed-in staff session
  (co-pilot), never from a URL parameter. Tracking links are unguessable tokens.
- **Abuse limits.** OTP: 30-second cooldown, 4 sends/hour per number, 5 attempts, 5-minute expiry, single use. Chat: 12 messages/minute.
- **Masking.** GSTIN, Udyam, phone and ID numbers are masked in the UI and logs; logs never contain message text, phone numbers or tokens.

## Known gaps (honest list)
Field-level encryption at rest for extracted KYC fields and phone numbers (production: KMS); an automated retention/purge job; a formal DPIA;
IP-level rate limiting at the edge; Aadhaar eSign via a licensed ASP.
