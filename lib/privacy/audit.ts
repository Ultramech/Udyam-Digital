import "server-only";
import { newId, put } from "@/lib/db/store";
import type { AuditEntry } from "@/lib/store/types";

/** Append-only record of staff actions. Stores ids only — never raw identifiers. */
export async function audit(actor: { id: string; role: string }, action: string, entity: string, entityId: string) {
  const e: AuditEntry = { id: newId("AU"), at: Date.now(), actor: actor.id, role: actor.role, action, entity, entityId };
  await put("audit", e.id, e);
}
