"use client";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, MapPin, Plus, Radio } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/components/i18n-provider";
import { CustomerShell } from "@/components/customer/shell";
import { plainName } from "@/lib/catalogue/plain";
import { api } from "@/lib/client/api";
import type { QuoteView } from "@/lib/client/types";
import { getPersona } from "@/lib/demo/personas";
import { ruleReason } from "@/lib/i18n/reasons";
import { inr } from "@/lib/client/format";

interface SiteRes extends QuoteView { perSite: { index: number; fibre: boolean; connectivity: string | null; basis?: "ops_coverage" | "post_office" | "policy"; confirmed?: boolean; area?: { district: string; state: string } | null; cityMismatch?: boolean }[]; priceDelta: number }

export default function SitesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, lang } = useI18n();
  const router = useRouter();
  const [v, setV] = useState<QuoteView | null>(null);
  const [rows, setRows] = useState<{ address: string; pincode: string }[]>([]);
  const [res, setRes] = useState<SiteRes | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<QuoteView>("GET", `/api/quote/${id}`).then((r) => { setV(r); setRows(r.quote.sites.map((s) => ({ address: s.address, pincode: s.pincode }))); });
  }, [id]);

  const personaId = v?.quote.attribution.source?.startsWith("demo:") ? v.quote.attribution.source.slice(5) : undefined;
  const persona = getPersona(personaId);
  const fillDemo = () => persona && setRows((r) => r.map((_, i) => persona.sites[i] ?? persona.sites[persona.sites.length - 1]));

  async function check() {
    setBusy(true);
    try {
      const r = await api<SiteRes>("POST", "/api/feasibility", { quoteId: id, sites: rows.map((x, index) => ({ index, ...x })) });
      setRes(r); setV(r);
    } catch { toast.error((lang === "hi" || lang === "mr") ? "पता और 6 अंकों का पिनकोड जाँचें।" : "Please check the address and 6-digit pincode."); }
    setBusy(false);
  }

  if (!v) return <CustomerShell step={3}><Skeleton className="h-64" /></CustomerShell>;
  const valid = rows.every((r) => r.address.trim().length >= 5 && /^\d{6}$/.test(r.pincode));

  return (
    <CustomerShell step={3}>
      <div className="space-y-4 pb-28">
        <div><h1 className="text-[1.625rem] font-extrabold leading-tight tracking-tight">{t("sites_title")}</h1><p className="text-sm text-muted-foreground">{(lang === "hi" || lang === "mr") ? "हम हर लोकेशन अलग से जाँचते हैं।" : "We check every location separately."}</p></div>
        {persona && <Button variant="outline" size="sm" onClick={fillDemo}>{(lang === "hi" || lang === "mr") ? "डेमो पता भरें" : "Fill demo address"}</Button>}
        {rows.map((r, i) => {
          const out = res?.perSite.find((s) => s.index === i);
          return (
            <Card key={i} className="space-y-3 p-3.5">
              <div className="flex items-center gap-2 text-sm font-semibold"><MapPin className="size-4" />{t("site_n")} {i + 1}</div>
              <div className="space-y-1.5"><Label htmlFor={`a${i}`}>{t("address")}</Label><Input id={`a${i}`} autoComplete="street-address" value={r.address} onChange={(e) => setRows((x) => x.map((y, k) => (k === i ? { ...y, address: e.target.value } : y)))} /></div>
              <div className="space-y-1.5"><Label htmlFor={`p${i}`}>{t("pincode")}</Label><Input id={`p${i}`} inputMode="numeric" maxLength={6} className="w-32" value={r.pincode} onChange={(e) => setRows((x) => x.map((y, k) => (k === i ? { ...y, pincode: e.target.value.replace(/\D/g, "") } : y)))} /></div>
              {out && (
                <div className={`flex gap-2 rounded-lg p-2.5 text-sm ${out.fibre ? "bg-success/10 text-success" : "bg-accent text-accent-foreground"}`}>
                  {out.fibre ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <Radio className="mt-0.5 size-4 shrink-0" />}
                  <div><div className="font-medium">{out.fibre ? t("fibre_ok") : t("fibre_no")}</div>{out.connectivity && <div className="text-xs opacity-90">{plainName(out.connectivity, lang)}</div>}
                    <div className="mt-0.5 text-xs opacity-80">
                      {out.area ? `${out.area.district}, ${out.area.state} · ` : ""}
                      {out.confirmed ? ((lang === "hi" || lang === "mr") ? "हमारी टीम ने पुष्टि की है" : "Confirmed by our network team")
                        : out.basis === "policy" ? ((lang === "hi" || lang === "mr") ? "यह पिनकोड डाक निर्देशिका में नहीं मिला — अनुमान है, हमारी टीम इंस्टॉलेशन से पहले पक्का करेगी" : "Pincode not found in the postal directory — this is an estimate; our team confirms before installation")
                        : ((lang === "hi" || lang === "mr") ? "अनुमान — हमारी टीम इंस्टॉलेशन से पहले पक्का करेगी" : "Estimate — our team confirms before installation")}
                    </div>
                    {out.cityMismatch && <div className="mt-0.5 text-xs font-medium">{(lang === "hi" || lang === "mr") ? "ध्यान दें: यह पिनकोड आपके बताए शहर से मेल नहीं खाता।" : "Heads-up: this pincode doesn't look like it belongs to the city you gave."}</div>}</div>
                </div>
              )}
            </Card>
          );
        })}
        {res?.notices?.filter((n) => n.code === "EXCL_AIRFIBER_INCOMPATIBLE").map((n, i) => <p key={i} className="rounded-lg bg-secondary p-2.5 text-xs">{ruleReason({ code: n.code, params: n.params, productId: String(n.params?.productId) }, lang)}</p>)}
        {res && res.priceDelta !== 0 && <p className="text-sm">{(lang === "hi" || lang === "mr") ? "कीमत में बदलाव" : "Price change"}: <b>{res.priceDelta > 0 ? "+" : ""}{inr(res.priceDelta)} {t("per_month")}</b> — {(lang === "hi" || lang === "mr") ? "अब नई कीमत" : "new monthly price"} <b>{inr(res.pricing.monthly)}</b></p>}
        <Button variant="outline" size="sm" className="gap-1" onClick={() => { setRows((r) => [...r, { address: "", pincode: "" }]); api("PATCH", `/api/quote/${id}`, { op: "edit", edit: { type: "addSite" } }).then((r) => setV(r as QuoteView)); }}><Plus className="size-3.5" />{t("add_site")}</Button>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-card"><div className="mx-auto flex max-w-xl gap-2 px-4 py-3">
        {!res ? <Button size="lg" className="w-full" disabled={busy || !valid} onClick={check}>{t("check_feas")}</Button>
          : <><Button size="lg" variant="outline" disabled={busy || !valid} onClick={check}>{t("check_feas")}</Button><Button size="lg" className="flex-1" onClick={() => router.push(`/order/${id}/consent`)}>{t("continue")}</Button></>}
      </div></div>
    </CustomerShell>
  );
}
