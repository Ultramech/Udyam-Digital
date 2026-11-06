import { z } from "zod";
import { HttpError, ok, parseBody, route } from "@/lib/api";
import { get, put } from "@/lib/db/store";
import { loadActiveOrder, loadOrder, orderView } from "@/lib/store/orderAccess";
import { addEvent, getOrder, recordSignature } from "@/lib/store/orders";
import { confirmOtp, requestOtp } from "@/lib/otp/flow";
import { appendCertificate, buildOrderForm, sha256 } from "@/lib/esign/pdf";

/**
 * OTP-bound electronic signature over the exact PDF the owner saw.
 *   POST {step:"prepare"} → builds the order form, stores it, returns its SHA-256
 *   POST {step:"send"}    → texts a one-time code to the order's verified phone, bound to that document hash
 *   PUT  {otpId, code}    → verifies the code, appends a signature certificate, records hash + time + IP
 *   GET  ?t=&signed=1     → the PDF (form or signed copy)
 */
interface Doc { b64: string }
const toDoc = (b: Uint8Array): Doc => ({ b64: Buffer.from(b).toString("base64") });
const fromDoc = (d: Doc) => new Uint8Array(Buffer.from(d.b64, "base64"));
const ip = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";

export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const b = await parseBody(req, z.object({ t: z.string().max(40).optional(), step: z.enum(["prepare", "send"]) }));
  const o = await loadActiveOrder(id, b.t ?? null);
  if (o.esign) throw new HttpError(409, "ALREADY_SIGNED");
  if (!o.phone) throw new HttpError(409, "PHONE_NOT_VERIFIED");
  if (b.step === "prepare") {
    const pdf = await buildOrderForm(o);
    const docHash = sha256(pdf);
    await put("document", `${o.id}-form`, toDoc(pdf));
    const fresh = (await getOrder(o.id))!;
    fresh.esignDraft = { docHash, preparedAt: Date.now() };
    await put("order", fresh.id, fresh);
    return ok({ docHash, bytes: pdf.length });
  }
  if (!o.esignDraft) throw new HttpError(409, "PREPARE_FIRST");
  return ok({ sent: true, otpId: await requestOtp(o.phone, "esign", o.esignDraft.docHash) });
});

export const PUT = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const b = await parseBody(req, z.object({ t: z.string().max(40).optional(), otpId: z.string().min(4).max(40), code: z.string().regex(/^\d{4,8}$/), agreed: z.literal(true) }));
  const o = await loadActiveOrder(id, b.t ?? null);
  if (o.esign) throw new HttpError(409, "ALREADY_SIGNED");
  if (!o.phone || !o.esignDraft) throw new HttpError(409, "PREPARE_FIRST");
  const stored = await get<Doc>("document", `${o.id}-form`);
  if (!stored) throw new HttpError(409, "PREPARE_FIRST");
  const form = fromDoc(stored);
  if (sha256(form) !== o.esignDraft.docHash) throw new HttpError(409, "DOCUMENT_CHANGED");
  const { phone } = await confirmOtp(b.otpId, b.code, "esign", o.esignDraft.docHash);
  if (phone !== o.phone) throw new HttpError(403, "WRONG_SIGNER");
  const masked = `${phone.slice(0, 2)}******${phone.slice(-2)}`;
  const signedAt = Date.now();
  const signed = await appendCertificate(form, {
    signedAtIso: new Date(signedAt).toISOString(), signerPhoneMasked: masked, ip: ip(req), userAgent: req.headers.get("user-agent") ?? "unknown",
    docHash: o.esignDraft.docHash, method: "SMS one-time code (OTP) to verified mobile",
  }, o.id);
  await put("document", `${o.id}-signed`, toDoc(signed));
  await recordSignature(o.id, { signedAt, method: "sms-otp", docHash: o.esignDraft.docHash, signedHash: sha256(signed), signerPhoneMasked: masked, ip: ip(req) });
  await addEvent(o.id, "action", `Signature certificate issued (document hash ${o.esignDraft.docHash.slice(0, 12)}…).`);
  return ok(await orderView((await getOrder(o.id))!));
});

export const GET = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const u = new URL(req.url);
  const o = await loadOrder(id, u.searchParams.get("t"));
  const wantSigned = u.searchParams.get("signed") === "1";
  if (wantSigned && !o.esign) throw new HttpError(404, "NOT_SIGNED");
  const d = await get<Doc>("document", `${o.id}-${wantSigned ? "signed" : "form"}`);
  if (!d) throw new HttpError(404, "DOCUMENT_NOT_FOUND");
  return new Response(Buffer.from(d.b64, "base64"), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${o.id}${wantSigned ? "-signed" : ""}.pdf"`, "cache-control": "private, no-store" } });
});
