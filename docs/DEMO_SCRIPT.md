# 3-minute demo script

**Before recording:** `npm run dev`, open the Demo drawer → _Reset demo data_. Phone viewport (390 px) for the customer side. OTP is always `123456`.

| Time | On screen | Say |
|---|---|---|
| 0:00 | Landing → pick **Sharma-ji** (Hindi) | "Sharma-ji runs a pharmacy in Indore. He has four minutes between customers." |
| 0:15 | Advisor extracts everything from one Hindi message; plan card | "One message, no form. Dukaan Digital, ₹2,295 a month, one bill. He asked for WhatsApp — it says **no**, because he has no GST number, and tells him what works today and what would unlock it." Open **How I decided**. |
| 0:40 | Quote: change cameras 2→4 (price moves), try adding WhatsApp (blocked with a reason) | "Every change is re-priced and re-checked by the rules engine. The AI never touches price or eligibility." |
| 0:55 | Location → **no fibre** → AirFiber swap + price note | "Fibre can't reach this shop, so it's switched to wireless — live in two days instead of five." |
| 1:10 | Consent screen (marketing off) → KYC with sample docs | "We ask for the least we can. Consent first, marketing off by default." |
| 1:25 | Pay: **fail** → retry → success → tracker | "A failed payment never loses his plan." |
| 1:45 | Switch to **Dr. Menon** (clinic): GSTIN lookup verifies instantly; attach docs → **name mismatch → sent for review** | "The system caught a planted problem — the certificate says 'Shri Physio', the records say 'Neelgiri'. It doesn't guess; it asks a person." |
| 2:05 | Ops console (KYC ops): same case, reasons, **Approve** → customer tracker updates | "The reviewer sees the exact case, and the customer's tracker changes — no phone call." |
| 2:25 | **Spice Route** (3 branches): only branch 3 falls back to AirFiber; lead appears in ops with summary + next action | "High-value multi-site goes to a specialist with the whole conversation. The rep gets the lead; self-serve purchases still credit them." |
| 2:45 | Ops Overview: live vs historical; engine found 56 rule-breaking historical sales | "Re-sort who gets a human: micro goes digital, specialists close the big accounts." |
| 2:55 | Close | "Understand, recommend, quote, verify, purchase, activate, track." |

**Judge stress-tests to offer:** _Scenario Lab_ (paste any description), the KYC sample-set picker (K01–K12), and the Demo drawer (payment outcome, language, reset).
