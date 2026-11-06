/**
 * Server-side gates for the customer journey. The UI also redirects, but THIS is what enforces "verify your phone first":
 *   requireCustomer() — a signed-in account (phone proved by OTP) that has completed profile setup;
 *   ownedQuote(id) / ownedConversation(id) — the record belongs to that account (staff may open any). Others get 404, so ids
 *   can't be probed. A record started on this device before an earlier sign-in is claimed by the account on first access.
 */
import "server-only";
import { HttpError } from "@/lib/api";
import { currentStaff, sessionId } from "@/lib/auth";
import { get, put } from "@/lib/db/store";
import type { Conversation, Quote } from "@/lib/store/types";
import { currentUser, type User } from "./users";

export async function requireCustomer(): Promise<User & { sessionId: string }> {
  const u = await currentUser();
  if (!u) throw new HttpError(401, "SIGN_IN_REQUIRED");
  if (!u.onboardedAt) throw new HttpError(403, "PROFILE_SETUP_REQUIRED");
  return u;
}

async function signedIn() { if (!(await currentStaff())) await requireCustomer(); }

async function owns<T extends { userId?: string; sessionId?: string }>(rec: T): Promise<{ ok: boolean; claim: boolean; user: (User & { sessionId: string }) | null }> {
  if (await currentStaff()) return { ok: true, claim: false, user: null };
  const u = await requireCustomer();
  if (rec.userId) return { ok: rec.userId === u.id, claim: false, user: u };
  const sid = await sessionId();
  return { ok: !!sid && rec.sessionId === sid, claim: true, user: u };
}

export async function ownedQuote(id: string): Promise<Quote> {
  await signedIn(); // who you are is checked before anything about the record is revealed
  const q = await get<Quote>("quote", id);
  if (!q) throw new HttpError(404, "QUOTE_NOT_FOUND");
  const o = await owns(q);
  if (!o.ok) throw new HttpError(404, "QUOTE_NOT_FOUND");
  if (o.claim && o.user) { q.userId = o.user.id; await put("quote", q.id, q); }
  return q;
}

export async function ownedConversation(id: string): Promise<Conversation> {
  await signedIn(); // who you are is checked before anything about the record is revealed
  const c = await get<Conversation>("conversation", id);
  if (!c) throw new HttpError(404, "CONVERSATION_NOT_FOUND");
  const o = await owns(c);
  if (!o.ok) throw new HttpError(404, "CONVERSATION_NOT_FOUND");
  if (o.claim && o.user) { c.userId = o.user.id; await put("conversation", c.id, c); }
  return c;
}
