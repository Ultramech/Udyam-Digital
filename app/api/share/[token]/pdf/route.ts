import { HttpError, route } from "@/lib/api";
import { sharedPlan } from "@/lib/share";
import { buildQuotePdf } from "@/lib/esign/pdf";

export const GET = route(async (_req: Request, { params }: { params: Promise<{ token: string }> }) => {
  const s = await sharedPlan((await params).token);
  if (!s) throw new HttpError(404, "SHARE_NOT_FOUND");
  const pdf = await buildQuotePdf(s.quote);
  return new Response(Buffer.from(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="quote-${s.quote.id}.pdf"`, "cache-control": "private, no-store" } });
});
