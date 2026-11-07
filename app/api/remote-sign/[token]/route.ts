import { z } from "zod";
import { HttpError, ok, parseBody, route } from "@/lib/api";
import { get, put } from "@/lib/db/store";
import { orderView } from "@/lib/store/orderAccess";
import { addEvent, getOrder, recordSignature } from "@/lib/store/orders";
import { requestOtp, confirmOtp } from "@/lib/otp/flow";
import { appendCertificate, sha256 } from "@/lib/esign/pdf";

type Remote = { orderId: string; orderToken: string; phone: string; expiresAt: number; used: boolean };
type Doc = { b64: string };
const valid = async (token: string) => {
  const r = await get<Remote>("share", `remote-esign:${token}`);
  if (!r || Date.now() > r.expiresAt || r.used) throw new HttpError(404, "SIGN_LINK_EXPIRED");
  const o = await getOrder(r.orderId);
  if (!o || o.token !== r.orderToken) throw new HttpError(404, "SIGN_LINK_EXPIRED");
  if (o.esign || !o.esignDraft) throw new HttpError(409, "SIGNING_UNAVAILABLE");
  return { r, o };
};
const masked = (p: string) => `${p.slice(0, 2)}******${p.slice(-2)}`;
const ip = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";

export const GET = route(async (req: Request, { params }: { params: Promise<{ token: string }> }) => {
  const { token } = await params;
  const { r, o } = await valid(token);
  if (new URL(req.url).searchParams.get("pdf") === "1") {
    const d = await get<Doc>("document", `${o.id}-form`);
    if (!d || sha256(new Uint8Array(Buffer.from(d.b64, "base64"))) !== o.esignDraft!.docHash) throw new HttpError(409, "DOCUMENT_CHANGED");
    return new Response(Buffer.from(d.b64, "base64"), { headers: { "content-type": "application/pdf", "content-disposition": "inline; filename=order-form.pdf", "cache-control": "private, no-store" } });
  }
  return ok({ businessName: o.businessName, plan: o.bundleId, monthly: o.totals.monthly, firstPayment: o.totals.firstPayment, pdf: `/api/remote-sign/${token}?pdf=1`, expiresAt: r.expiresAt });
});

export const POST = route(async (req: Request, { params }: { params: Promise<{ token: string }> }) => {
  const { token } = await params;
  const { r, o } = await valid(token);
  await parseBody(req, z.object({ step: z.literal("send") }));
  const otpId = await requestOtp(r.phone, "esign", o.esignDraft!.docHash);
  return ok({ otpId, expiresInMinutes: 5 });
});

export const PUT = route(async (req: Request, { params }: { params: Promise<{ token: string }> }) => {
  const { token } = await params;
  const { r, o } = await valid(token);
  const b = await parseBody(req, z.object({ otpId: z.string().min(4).max(40), code: z.string().regex(/^\d{4,8}$/), agreed: z.literal(true) }));
  const confirmed = await confirmOtp(b.otpId, b.code, "esign", o.esignDraft!.docHash);
  if (confirmed.phone !== r.phone) throw new HttpError(403, "WRONG_SIGNER");
  const stored = await get<Doc>("document", `${o.id}-form`);
  if (!stored) throw new HttpError(409, "DOCUMENT_NOT_FOUND");
  const form = new Uint8Array(Buffer.from(stored.b64, "base64"));
  if (sha256(form) !== o.esignDraft!.docHash) throw new HttpError(409, "DOCUMENT_CHANGED");
  const signedAt = Date.now();
  const signed = await appendCertificate(form, { signedAtIso: new Date(signedAt).toISOString(), signerPhoneMasked: masked(r.phone), ip: ip(req), userAgent: req.headers.get("user-agent") ?? "unknown", docHash: o.esignDraft!.docHash, method: "SMS one-time code (OTP) to remote authorised signatory" }, o.id);
  await put("document", `${o.id}-signed`, { b64: Buffer.from(signed).toString("base64") });
  await recordSignature(o.id, { signedAt, method: "sms-otp", docHash: o.esignDraft!.docHash, signedHash: sha256(signed), signerPhoneMasked: masked(r.phone), ip: ip(req) });
  await put("share", `remote-esign:${token}`, { ...r, used: true });
  await addEvent(o.id, "action", `Remote authorised signatory signed the order (document hash ${o.esignDraft!.docHash.slice(0, 12)}…).`);
  return ok(await orderView((await getOrder(o.id))!));
});
