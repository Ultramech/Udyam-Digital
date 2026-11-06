"use client";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { Database, Hourglass, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/components/i18n-provider";
import { CustomerShell } from "@/components/customer/shell";
import { api, ApiError } from "@/lib/client/api";

type P = { kyc: boolean; service: boolean; digilocker: boolean; marketing: boolean };

export default function ConsentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, lang } = useI18n();
  const router = useRouter();
  const [p, setP] = useState<P>({ kyc: true, service: true, digilocker: false, marketing: false }); // optional purposes start OFF
  const [busy, setBusy] = useState(false);

  async function accept() {
    setBusy(true);
    try {
      await api("POST", "/api/consent", { quoteId: id, lang, purposes: p });
      toast.success(t("consent_saved"));
      router.push(`/order/${id}/kyc`);
    } catch (e) { toast.error(e instanceof ApiError && e.code === "CONSENT_REQUIRED" ? t("consent_needed") : t("error_generic")); setBusy(false); }
  }

  const rows: { key: keyof P; title: string; body: string; required?: boolean }[] = [
    { key: "kyc", title: t("c_kyc"), body: t("c_kyc_d"), required: true },
    { key: "service", title: t("c_service"), body: t("c_service_d"), required: true },
    { key: "digilocker", title: t("c_digilocker"), body: t("c_digilocker_d") },
    { key: "marketing", title: t("c_marketing"), body: t("c_marketing_d") },
  ];
  return (
    <CustomerShell step={4}>
      <div className="space-y-4 pb-28">
        <div>
          <h1 className="text-[1.625rem] font-extrabold leading-tight tracking-tight">{t("consent_title")}</h1>
          <p className="mt-1 text-[0.9375rem] text-muted-foreground">{t("consent_intro")}</p>
        </div>
        {rows.map((r) => (
          <Card key={r.key} className="flex items-start justify-between gap-3 p-3.5">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2 text-[0.9375rem] font-bold">{r.title}<Badge variant={r.required ? "outline" : "secondary"} className="text-xs">{r.required ? t("required") : t("optional")}</Badge></div>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{r.body}</p></div>
            <Switch checked={p[r.key]} disabled={r.required} aria-label={r.title} onCheckedChange={(c) => setP((x) => ({ ...x, [r.key]: !!c }))} />
          </Card>
        ))}
        <Card className="space-y-3 bg-secondary p-3.5 text-sm">
          <div className="flex gap-2"><Hourglass className="mt-0.5 size-4 shrink-0 text-primary" /><div><div className="font-semibold">{t("retention_title")}</div><p className="text-xs text-muted-foreground">{t("retention_body")}</p></div></div>
          <div className="flex gap-2"><UserCheck className="mt-0.5 size-4 shrink-0 text-primary" /><div><div className="font-semibold">{t("rights_title")}</div><p className="text-xs text-muted-foreground">{t("rights_body")}</p></div></div>
          <div className="flex gap-2"><Database className="mt-0.5 size-4 shrink-0 text-primary" /><p className="text-xs text-muted-foreground">{(lang === "hi" || lang === "mr") ? "पहचान-संख्याएँ स्क्रीन और लॉग में छिपाकर दिखती हैं। यह प्रोटोटाइप सहमति, उद्देश्य-सीमा और न्यूनतम डेटा पर बना है — यह किसी कानूनी प्रमाणन का दावा नहीं है।" : "Identifiers are masked on screen and in logs. This prototype is designed around consent, purpose limitation and data minimisation — it does not claim legal certification."}</p></div>
        </Card>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-card"><div className="mx-auto max-w-xl px-4 py-3"><Button size="lg" className="w-full" disabled={busy} onClick={accept}>{t("accept_continue")}</Button></div></div>
    </CustomerShell>
  );
}
