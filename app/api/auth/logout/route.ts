import { ok, route } from "@/lib/api";
import { signOutUser } from "@/lib/accounts/users";

/** Signs this device out: the session is revoked server-side and the visitor session loses its verified flag. */
export const POST = route(async () => {
  await signOutUser();
  return ok({ ok: true });
});
