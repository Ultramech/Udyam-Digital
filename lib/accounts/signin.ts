import "server-only";
import { get } from "@/lib/db/store";
import { newVisitorId, sessionId, setSessionId } from "@/lib/auth";
import type { Session } from "@/lib/store/types";
import { findOrCreateUser, linkVisitor, startUserSession } from "./users";

/**
 * The single place a proved phone number becomes a signed-in account: find-or-create the user, start a session (hashed token
 * cookie), and link this device's visitor session so everything done before login now belongs to the account.
 */
export async function signInWithVerifiedPhone(phone: string) {
  const sid = (await sessionId()) ?? newVisitorId();
  const visitor = await get<Session>("session", sid);
  const user = await findOrCreateUser(phone, visitor?.lang ?? "en");
  await startUserSession(user.id);
  const { claimed } = await linkVisitor(sid, user);
  await setSessionId(sid);
  return { verified: true, user: { id: user.id, name: user.name, isNew: !user.onboardedAt, onboarded: !!user.onboardedAt }, claimed };
}
