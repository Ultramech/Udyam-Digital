import { HttpError, ok, route } from "@/lib/api";
import { ownedQuote } from "@/lib/accounts/guard";
import { saveQuote } from "@/lib/store/quotes";
import { get, put } from "@/lib/db/store";
import { priceLines } from "@/lib/rules/pricing";
import { geminiConfigured, geminiJson, GeminiError } from "@/lib/ai/gemini";
import { compareBill, type BillFacts } from "@/lib/bill/compare";

/** AI calls stop at their own 40 s budget (lib/ai/gemini.ts); this is Vercel's hard ceiling for the function. */
export const maxDuration = 60;

/**
 * Snap your current phone/internet bill → monthly spend is read → honest comparison with this plan.
 * The image is read in memory and dropped; only the monthly amount is kept on the quote (data minimisation). No account numbers are read.
 */
const MAX = 5 * 1024 * 1024;
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const q = await ownedQuote((await params).id);
  if (!q) throw new HttpError(404, "QUOTE_NOT_FOUND");
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "FILE_REQUIRED");
  if (!["image/png", "image/jpeg", "application/pdf"].includes(file.type)) throw new HttpError(415, "UNSUPPORTED_TYPE");
  if (file.size > MAX) throw new HttpError(413, "FILE_TOO_LARGE");
  if (!geminiConfigured()) throw new HttpError(503, "BILL_READER_UNAVAILABLE");
  // each read costs model quota: at most 5 bill reads per quote per hour
  const rlKey = `bill-rl:${q.id}`, now = Date.now();
  const recent = ((await get<{ times: number[] }>("analytics", rlKey))?.times ?? []).filter((t) => now - t < 3600_000);
  if (recent.length >= 5) throw new HttpError(429, "TOO_MANY_BILLS");
  await put("analytics", rlKey, { times: [...recent, now] });
  let bill: BillFacts;
  try {
    const r = await geminiJson<{ provider: string | null; monthly_total: number | null; services: string[] }>({
      system: "You read an Indian telecom/internet bill. Return ONLY: the provider name, the total amount payable for one month in INR (including taxes; if the bill covers several months, divide to one month), and the kinds of services billed (e.g. mobile postpaid, broadband, landline, DTH). Never return account numbers, names, addresses or phone numbers. If it is not a telecom bill or unreadable, return nulls.",
      parts: [{ text: "Read this bill." }, { inlineData: { mimeType: file.type, data: Buffer.from(await file.arrayBuffer()).toString("base64") } }],
      schema: { type: "OBJECT", properties: { provider: { type: "STRING", nullable: true }, monthly_total: { type: "NUMBER", nullable: true }, services: { type: "ARRAY", items: { type: "STRING" } } }, required: ["services"] },
      timeoutMs: 40_000,
    });
    bill = { provider: typeof r.provider === "string" ? r.provider.slice(0, 40) : null, monthlyTotal: typeof r.monthly_total === "number" ? r.monthly_total : null, services: (r.services ?? []).filter((x) => typeof x === "string").slice(0, 6).map((x) => x.slice(0, 40)) };
  } catch (e) {
    throw new HttpError(503, "BILL_READER_UNAVAILABLE", { reason: e instanceof GeminiError ? e.code : "UNAVAILABLE" });
  }
  const pr = priceLines(q.lines);
  const cmp = compareBill(bill, pr.monthly, pr.gstMonthly, pr.lines);
  if (cmp.currentMonthly) { q.profile = { ...q.profile, currentSpend: cmp.currentMonthly }; await saveQuote(q); }
  return ok(cmp);
});
