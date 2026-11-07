import "server-only";
import { createHash } from "node:crypto";
import { get, listBy, newSecret, put, update } from "@/lib/db/store";
import { SLOTS, type Slot } from "@/lib/kyc/types";

/**
 * "Send it to the right person." A shop is run by several people: the owner decides, the CA holds the GST papers, a partner is the
 * authorised signatory, a nephew is at the counter. A delegate link lets ONE of them do ONE job (upload specific documents) from their
 * own phone, with no account and no password shared.
 *
 * Safety by construction: the link is an unguessable token (stored only as a hash), it names the exact documents it may add, it
 * expires after 48 hours, the owner can cancel it any time, and the delegate never sees what was read from any document: they only
 * learn whether each one was received. Delegated uploads go through the same checks as the owner's (lib/kyc/ingest.ts).
 */
export const DELEGATE_TTL = 48 * 3600_000;
const MAX_ACTIVE = 5;

export interface Delegate {
  kind: "delegate"; quoteId: string; label: string; slots: Slot[]; ownerFirstName: string | null;
  createdAt: number; expiresAt: number; revokedAt?: number; uploaded: { slot: Slot; at: number }[];
  /** Short public handle (first 12 hex of the token hash) and the storage key. Neither lets anyone act as the delegate. */
  ref: string; key: string;
}

const hash = (token: string) => createHash("sha256").update(token).digest("hex").slice(0, 40);
const docId = (h: string) => `dlg-${h}`;
/** A short label for the owner's list and for the delegate's greeting. Letters, digits, spaces and a few marks only. */
const cleanLabel = (s: string) => s.replace(/[^\p{L}\p{N} .'&/-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 40);

export type DelegateView = Omit<Delegate, "key"> & { state: "waiting" | "partly" | "done" | "expired" | "cancelled" };
const stateOf = (d: Delegate): DelegateView["state"] =>
  d.revokedAt ? "cancelled" : Date.now() > d.expiresAt ? "expired" : d.slots.every((s) => d.uploaded.some((u) => u.slot === s)) ? "done" : d.uploaded.length ? "partly" : "waiting";

export async function listDelegates(quoteId: string): Promise<DelegateView[]> {
  const rows = await listBy<Delegate>("share", "quote_id", quoteId, { newestFirst: true });
  return rows.filter((r) => r.kind === "delegate").map(({ key: _key, ...r }) => ({ ...r, state: stateOf({ ...r, key: _key }) }));
}

export async function createDelegate(quoteId: string, label: string, slots: Slot[], ownerFirstName: string | null): Promise<{ token: string; ref: string }> {
  const uniq = [...new Set(slots)].filter((s) => SLOTS.includes(s));
  if (!uniq.length) throw new Error("NO_SLOTS");
  const active = (await listDelegates(quoteId)).filter((d) => d.state === "waiting" || d.state === "partly");
  if (active.length >= MAX_ACTIVE) throw new Error("TOO_MANY_LINKS");
  const token = newSecret(); // ~187 bits: this link can add documents, so it is as strong as a session secret
  const h = hash(token);
  const now = Date.now();
  const d: Delegate = { kind: "delegate", quoteId, label: cleanLabel(label) || "Someone you trust", slots: uniq, ownerFirstName, createdAt: now, expiresAt: now + DELEGATE_TTL, uploaded: [], ref: h.slice(0, 12), key: docId(h) };
  await put("share", docId(h), d);
  return { token, ref: d.ref };
}

/** The live delegation for a link, or null when it is unknown, expired or cancelled. */
export async function resolveDelegate(token: string): Promise<Delegate | null> {
  if (!/^[A-Za-z0-9]{20,64}$/.test(token)) return null;
  const d = await get<Delegate>("share", docId(hash(token)));
  if (!d || d.kind !== "delegate" || d.revokedAt || Date.now() > d.expiresAt) return null;
  return d;
}

export async function recordDelegateUpload(token: string, slot: Slot) {
  await update<Delegate>("share", docId(hash(token)), (d) => ({ ...d, uploaded: [...d.uploaded.filter((u) => u.slot !== slot), { slot, at: Date.now() }] }));
}

/** Owner cancels a link. Documents already uploaded stay (they are the owner's business documents); only further uploads stop. */
export async function revokeDelegate(quoteId: string, ref: string): Promise<boolean> {
  const rows = await listBy<Delegate>("share", "quote_id", quoteId);
  const hit = rows.find((r) => r.kind === "delegate" && r.ref === ref && !r.revokedAt);
  if (!hit) return false;
  await update<Delegate>("share", hit.key, (d) => ({ ...d, revokedAt: Date.now() }));
  return true;
}
