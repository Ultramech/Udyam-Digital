import "server-only";
import { list } from "@/lib/db/store";
import { applyOverrides, type Override } from "./overrides";

type G = typeof globalThis & { __udyamCatSync?: { at: number; p?: Promise<void> } };
const TTL_MS = 3000;

/** Load overrides from the store at most every few seconds and apply them. Failure leaves the CSV catalogue in force. */
export async function syncCatalogue(force = false): Promise<void> {
  const g = globalThis as G;
  const st = (g.__udyamCatSync ??= { at: 0 });
  if (!force && Date.now() - st.at < TTL_MS) return st.p;
  st.at = Date.now();
  st.p = list<Override>("catalogue_override", { limit: 100 }).then(applyOverrides).catch(() => undefined);
  return st.p;
}
