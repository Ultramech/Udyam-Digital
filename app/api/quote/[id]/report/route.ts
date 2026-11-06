import { HttpError, route } from "@/lib/api";
import { ownedQuote } from "@/lib/accounts/guard";
import { quoteView } from "@/lib/store/quotes";
import { buildReportPdf } from "@/lib/report/pdf";

/** Personalised business report (PDF). Contains no personal identifiers — business type, city and size only. */
export const GET = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const q = await ownedQuote((await params).id);
  if (!q) throw new HttpError(404, "QUOTE_NOT_FOUND");
  const pdf = await buildReportPdf(quoteView(q));
  return new Response(Buffer.from(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="business-report-${q.id}.pdf"`, "cache-control": "private, no-store" } });
});
