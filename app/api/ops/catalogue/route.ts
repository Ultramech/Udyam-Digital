import { z } from "zod";
import { HttpError, ok, parseBody, route } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { CATALOGUE } from "@/lib/catalogue";
import { checkOverride, original, type CatalogueChange, type Override } from "@/lib/catalogue/overrides";
import { syncCatalogue } from "@/lib/catalogue/sync";
import { del, get, list, newId, put } from "@/lib/db/store";
import { audit } from "@/lib/privacy/audit";

/** Catalogue admin: current values vs the published CSV, plus the full change history. Ops/admin only. */
export const GET = route(async () => {
  await requireRole("ops", "admin");
  const overrides = await list<Override>("catalogue_override", { limit: 100 });
  const history = await list<CatalogueChange>("catalogue_change", { limit: 200 });
  const products = CATALOGUE.map((p) => ({ ...p, original: original(p.id), override: overrides.find((o) => o.productId === p.id) ?? null }));
  return ok({ products, history });
});

const Body = z.object({
  productId: z.string().regex(/^P\d{2}$/),
  paused: z.boolean().optional(), priceMin: z.number().int().optional(), setup: z.number().int().optional(), installDays: z.number().int().optional(),
  note: z.string().trim().min(3).max(200),
  reset: z.boolean().optional(),
});

/** Change one product. Every field change is validated against the published catalogue and written to the change history. */
export const PUT = route(async (req: Request) => {
  const staff = await requireRole("ops", "admin");
  const b = await parseBody(req, Body);
  const base = original(b.productId);
  if (!base) throw new HttpError(404, "UNKNOWN_PRODUCT");
  const cur = (await get<Override>("catalogue_override", b.productId)) ?? { productId: b.productId };
  const next: Override = b.reset ? { productId: b.productId } : {
    productId: b.productId,
    paused: b.paused ?? cur.paused, priceMin: b.priceMin ?? cur.priceMin, setup: b.setup ?? cur.setup, installDays: b.installDays ?? cur.installDays,
  };
  const err = checkOverride(next);
  if (err) throw new HttpError(422, err, { min: base.priceMin, max: CATALOGUE.find((p) => p.id === b.productId)?.priceMax });

  const changes: CatalogueChange[] = [];
  for (const f of ["paused", "priceMin", "setup", "installDays"] as const) {
    const from = cur[f] ?? base[f] ?? false, to = next[f] ?? base[f] ?? false;
    if (from !== to) changes.push({ id: newId("CC"), at: Date.now(), by: staff.id, productId: b.productId, field: f, from, to, note: b.note });
  }
  if (!changes.length) return ok({ changed: 0 });
  // store only fields that differ from the CSV, so "reset" and no-op edits leave no override behind
  const clean: Override = { productId: b.productId };
  for (const f of ["paused", "priceMin", "setup", "installDays"] as const) if (next[f] !== undefined && next[f] !== (base[f] ?? false)) (clean as unknown as Record<string, unknown>)[f] = next[f];
  if (Object.keys(clean).length > 1) await put("catalogue_override", b.productId, clean); else await del("catalogue_override", b.productId);
  for (const c of changes) await put("catalogue_change", c.id, c);
  await audit(staff, "catalogue.update", "product", b.productId);
  await syncCatalogue(true);
  return ok({ changed: changes.length });
});
