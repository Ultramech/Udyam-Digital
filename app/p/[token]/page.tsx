"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/components/i18n-provider";
import { CustomerShell } from "@/components/customer/shell";
import { fmtDate, inr } from "@/lib/client/format";

interface Shared {
  plan: string; business: string; city: string; locations: number; monthly: number; gstMonthly: number; setup: number; gstSetup: number; payToday: number;
  contractMonths: number; goLive: string; items: { name: string; benefit: string; qty: number; location: number | null; monthly: number; setup: number }[];
  why: string[]; notIncluded: string[]; expiresAt: number;
}

/** Read-only plan someone shared with a decision-maker. Live: it reflects the owner's latest edits. */
export default function SharedPlan({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { lang } = useI18n();
  const hi = lang === "hi" || lang === "mr";
  const [v, setV] = useState<Shared | null>(null);
  const [gone, setGone] = useState(false);
  useEffect(() => { fetch(`/api/share/${token}?lang=${lang}`).then((r) => (r.ok ? r.json() : Promise.reject())).then(setV).catch(() => setGone(true)); }, [token, lang]);

  if (gone) return <CustomerShell><Card className="p-4 text-sm">{hi ? "यह लिंक पुराना हो गया है या सही नहीं है। प्लान भेजने वाले से नया लिंक माँगें।" : "This link has expired or isn't valid. Ask the person who shared it for a new link."}</Card></CustomerShell>;
  if (!v) return <CustomerShell><div className="space-y-3"><Skeleton className="h-32" /><Skeleton className="h-64" /></div></CustomerShell>;
  return (
    <CustomerShell>
      <div className="space-y-4 pb-10">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{hi ? "आपके साथ शेयर किया गया प्लान" : "A plan shared with you"}</p>
          <h1 className="text-xl font-bold">{v.plan}</h1>
          <p className="text-sm text-muted-foreground">{v.business}{v.city ? ` · ${v.city}` : ""}{v.locations > 1 ? ` · ${v.locations} ${hi ? "लोकेशन" : "locations"}` : ""}</p>
        </div>
        <Card className="space-y-1 p-4">
          <div className="text-3xl font-extrabold">{inr(v.monthly)}<span className="ml-1 text-sm font-medium text-muted-foreground">{hi ? "/माह + GST" : "/month + GST"}</span></div>
          <div className="text-sm text-muted-foreground">{hi ? "एक बार का सेटअप" : "One-time setup"}: {inr(v.setup)} · {v.contractMonths} {hi ? "महीने का अनुबंध" : "month contract"}</div>
          <div className="text-sm text-muted-foreground">{hi ? "ऑर्डर पर भुगतान (GST सहित)" : "Payable at order (incl. GST)"}: <b>{inr(v.payToday)}</b> · {hi ? "चालू होने का अनुमान" : "Expected live"}: {fmtDate(v.goLive, lang)}</div>
        </Card>
        <Card className="divide-y p-0">
          {v.items.map((i, k) => (
            <div key={k} className="flex items-start justify-between gap-3 p-3 text-sm">
              <div className="min-w-0"><div className="font-medium">{i.name}{i.qty > 1 ? ` × ${i.qty}` : ""}{i.location != null && v.locations > 1 ? <span className="text-muted-foreground"> · {hi ? "लोकेशन" : "location"} {i.location + 1}</span> : null}</div><div className="text-xs text-muted-foreground">{i.benefit}</div></div>
              <div className="shrink-0 text-right">{inr(i.monthly)}<div className="text-[11px] text-muted-foreground">/{hi ? "माह" : "mo"}</div></div>
            </div>
          ))}
        </Card>
        {v.why.length > 0 && <Card className="space-y-1 p-3 text-sm"><div className="font-semibold">{hi ? "यह प्लान क्यों" : "Why this plan"}</div><ul className="list-disc pl-5">{v.why.map((w, i) => <li key={i}>{w}</li>)}</ul></Card>}
        {v.notIncluded.length > 0 && <Card className="space-y-1 p-3 text-sm"><div className="font-semibold">{hi ? "शामिल नहीं — और क्यों" : "Not included — and why"}</div><ul className="list-disc pl-5 text-muted-foreground">{v.notIncluded.map((w, i) => <li key={i}>{w}</li>)}</ul></Card>}
        <div className="flex flex-wrap gap-2">
          <a className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium" target="_blank" rel="noreferrer" href={`/api/share/${token}/pdf`}>{hi ? "PDF डाउनलोड करें" : "Download PDF"}</a>
          <Link className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" href="/advisor">{hi ? "अपना प्लान बनाएँ" : "Get a plan for my business"}</Link>
        </div>
        <p className="text-[11px] text-muted-foreground">{hi ? "अनुमानित प्रोटोटाइप कीमत — अंतिम कीमत KYC के बाद चेकआउट पर पक्की होती है।" : "Indicative prototype prices — the final price is confirmed at checkout after KYC."} {hi ? "लिंक की वैधता" : "Link valid until"} {fmtDate(new Date(v.expiresAt).toISOString().slice(0, 10), lang)}.</p>
      </div>
    </CustomerShell>
  );
}
