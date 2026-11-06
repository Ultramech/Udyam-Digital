import { HttpError, ok, route } from "@/lib/api";
import { sharedPlan } from "@/lib/share";

export const GET = route(async (req: Request, { params }: { params: Promise<{ token: string }> }) => {
  const lang = new URL(req.url).searchParams.get("lang");
  const s = await sharedPlan((await params).token, lang === "hi" || lang === "mr" || lang === "ta" ? lang : "en");
  if (!s) throw new HttpError(404, "SHARE_NOT_FOUND");
  return ok(s.view);
});
