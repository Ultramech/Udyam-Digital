import { z } from "zod";
import { get, newId, put } from "@/lib/db/store";
import { ok, parseBody, route } from "@/lib/api";
import { sessionId, setSessionId, newVisitorId } from "@/lib/auth";
import { handleChat } from "@/lib/channels/chat";
import { publicBaseUrl } from "@/lib/channels/twilio";
import type { Session } from "@/lib/store/types";

export const maxDuration = 60;

/** The in-app WhatsApp-style chat. Same controller as the real WhatsApp webhook; the phone is only trusted once the OTP flow has verified it. */
export const POST = route(async (req: Request) => {
  const { text } = await parseBody(req, z.object({ text: z.string().min(1).max(1000) }));
  let sid = await sessionId();
  let s = sid ? await get<Session>("session", sid) : null;
  if (!sid || !s) {
    sid = newVisitorId();
    s = { id: sid, lang: "en", verified: false, attribution: { source: "whatsapp-web" }, createdAt: Date.now() };
    await put("session", sid, s);
    await setSessionId(sid);
  }
  const phone = s.verified && s.phone ? s.phone : undefined;
  const out = await handleChat({ channel: "web", userId: sid, phone, text, baseUrl: publicBaseUrl() ?? new URL(req.url).origin });
  return ok(out);
});
