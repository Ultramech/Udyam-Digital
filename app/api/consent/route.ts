import { createHash } from "node:crypto";
import { ownedQuote } from "@/lib/accounts/guard";
import { z } from "zod";
import { get, newId, put } from "@/lib/db/store";
import { HttpError, ok, parseBody, route } from "@/lib/api";
import { sessionId } from "@/lib/auth";
import { saveQuote } from "@/lib/store/quotes";
import type { ConsentRecord, Session } from "@/lib/store/types";

const NOTICE_VERSION = "2026-11-v1";

const Body = z.object({
  quoteId: z.string().max(40),
  lang: z.enum(["en", "hi", "mr", "ta"]).default("en"),
  purposes: z.object({ kyc: z.boolean(), service: z.boolean(), digilocker: z.boolean().default(false), marketing: z.boolean().default(false) }),
});

/** Purpose-specific consent. KYC and service communication are required to buy; DigiLocker and marketing are optional and OFF by default. */
export const POST = route(async (req: Request) => {
  const b = await parseBody(req, Body);
  if (!b.purposes.kyc || !b.purposes.service) throw new HttpError(400, "CONSENT_REQUIRED", { required: ["kyc", "service"] });
  const q = await ownedQuote(b.quoteId);
  if (!q) throw new HttpError(404, "QUOTE_NOT_FOUND");
  const sid = await sessionId();
  const s = sid ? await get<Session>("session", sid) : null;
  const rec: ConsentRecord = {
    id: newId("CN"), quoteId: q.id, sessionId: sid, noticeVersion: NOTICE_VERSION, at: Date.now(), lang: b.lang, purposes: b.purposes,
    phoneHash: s?.phone ? createHash("sha256").update(s.phone).digest("hex").slice(0, 16) : undefined,
  };
  await put("consent", rec.id, rec);
  q.consentId = rec.id;
  await saveQuote(q);
  return ok({ receipt: { id: rec.id, at: rec.at, version: rec.noticeVersion, purposes: rec.purposes } });
});

export const GET = route(async (req: Request) => {
  const id = new URL(req.url).searchParams.get("id");
  const c = id ? await get<ConsentRecord>("consent", id) : null;
  if (!c) throw new HttpError(404, "CONSENT_NOT_FOUND");
  await ownedQuote(c.quoteId);
  return ok({ receipt: { id: c.id, at: c.at, version: c.noticeVersion, purposes: c.purposes } });
});

/** Withdraw optional consents (marketing, DigiLocker). Required purposes cannot be withdrawn without cancelling the order. */
export const PATCH = route(async (req: Request) => {
  const b = await parseBody(req, z.object({ id: z.string().max(40), marketing: z.boolean().optional(), digilocker: z.boolean().optional() }));
  const c = await get<ConsentRecord>("consent", b.id);
  if (!c) throw new HttpError(404, "CONSENT_NOT_FOUND");
  await ownedQuote(c.quoteId);
  c.purposes = { ...c.purposes, ...(b.marketing !== undefined ? { marketing: b.marketing } : {}), ...(b.digilocker !== undefined ? { digilocker: b.digilocker } : {}) };
  await put("consent", c.id, c);
  return ok({ receipt: { id: c.id, purposes: c.purposes } });
});
