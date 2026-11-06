import { z } from "zod";
import { put, get } from "@/lib/db/store";
import { ok, parseBody, route } from "@/lib/api";
import { sessionId, setSessionId, newVisitorId } from "@/lib/auth";
import type { Session } from "@/lib/store/types";
import { syncVisitorWithAccount } from "@/lib/accounts/users";

const Body = z.object({ lang: z.enum(["en", "hi", "mr", "ta"]).default("en"), attribution: z.object({ source: z.string().max(40).optional(), partnerCode: z.string().max(20).optional(), repId: z.string().max(20).optional() }).default({}) });

/** Creates (or returns) the anonymous visitor session. Exploring recommendations needs no login; OTP comes later. */
export const POST = route(async (req: Request) => {
  const b = await parseBody(req, Body);
  const existing = await sessionId();
  const cur = existing ? await get<Session>("session", existing) : null;
  if (cur) {
    const next = { ...cur, lang: b.lang, attribution: { ...cur.attribution, ...b.attribution } };
    await put("session", next.id, next);
    return ok({ session: next });
  }
  const s: Session = { id: newVisitorId(), verified: false, lang: b.lang, attribution: b.attribution, createdAt: Date.now() };
  await put("session", s.id, s);
  await setSessionId(s.id);
  return ok({ session: s });
});

export const GET = route(async () => {
  const id = await sessionId();
  const user = await syncVisitorWithAccount(id); // a returning signed-in browser gets its visitor session re-linked
  const s = id ? await get<Session>("session", id) : null;
  return ok({
    session: s ? { ...s, phone: s.phone ? s.phone.replace(/^(\d{2})\d{6}(\d{2})$/, "$1••••••$2") : undefined } : null,
    user: user ? { id: user.id, name: user.name, onboarded: !!user.onboardedAt, profileType: user.profileType, phoneMasked: user.phone.replace(/^(\d{2})\d{6}(\d{2})$/, "$1••••••$2"), lang: user.lang } : null,
  });
});
