"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, FileText } from "lucide-react";
import { Empty, OrderStatus, PageTitle, Row, SectionTitle, StageTrack } from "@/components/customer/kit";
import { CustomerShell } from "@/components/customer/shell";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/client/api";
import { fmtDate, inr } from "@/lib/client/format";

interface Me {
  orders: { id: string; token: string; businessName: string; bundle: string; stage: string | null; payment: string; monthly: number; goLive: string; createdAt: number }[];
  quotes: { id: string; bundle: string; orderId: string | null; createdAt: number }[];
}

export default function OrdersPage() { return <CustomerShell><Orders /></CustomerShell>; }

function Orders() {
  const { t, lang } = useI18n();
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => { api<Me>("GET", "/api/me").then(setMe).catch(() => setMe({ orders: [], quotes: [] })); }, []);

  if (!me) return <div className="space-y-3" aria-busy="true"><Skeleton className="h-9 w-1/2" /><Skeleton className="h-40" /><Skeleton className="h-20" /></div>;
  const live = (o: Me["orders"][number]) => o.stage === "ACTIVATED" || o.stage === "CANCELLED";
  const active = me.orders.filter((o) => !live(o));
  const done = me.orders.filter(live);
  const saved = me.quotes.filter((q) => !q.orderId);

  return (
    <div>
      <PageTitle title={t("orders_title")} />
      {me.orders.length === 0 && saved.length === 0 && (
        <Empty title={t("orders_empty")} sub={t("orders_empty_sub")} action={<Link href="/advisor"><Button size="lg">{t("home_get_plan")}<ArrowRight className="size-4" /></Button></Link>} />
      )}

      {active.length > 0 && (
        <section>
          <SectionTitle>{t("orders_active")}</SectionTitle>
          <div className="space-y-3">
            {active.map((o) => (
              <Link key={o.id} href={`/track/${o.id}?t=${o.token}`} className="block rounded-2xl border bg-card p-4 transition-colors hover:bg-muted/60">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><div className="truncate text-base font-bold">{o.bundle}</div><div className="truncate text-sm text-muted-foreground">{o.businessName}</div></div>
                  <OrderStatus stage={o.stage} payment={o.payment} />
                </div>
                <StageTrack stage={o.stage} className="mt-4 text-primary" />
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("home_goes_live")}</span>
                  <span className="num font-semibold">{fmtDate(o.goLive, lang)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-sm"><span className="text-muted-foreground">{t("per_month")}</span><span className="num font-semibold">{inr(o.monthly)}</span></div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {saved.length > 0 && (
        <section>
          <SectionTitle>{t("orders_saved")}</SectionTitle>
          <div className="space-y-2">
            {saved.map((q) => <Row key={q.id} href={`/quote/${q.id}`} icon={<FileText className="size-5" />} title={q.bundle} sub={new Date(q.createdAt).toLocaleDateString(lang === "en" ? "en-IN" : "hi-IN", { day: "numeric", month: "short" })} right={<span className="text-sm font-semibold">{t("home_continue")}</span>} />)}
          </div>
        </section>
      )}

      {done.length > 0 && (
        <section>
          <SectionTitle>{t("orders_done")}</SectionTitle>
          <div className="space-y-2">
            {done.map((o) => <Row key={o.id} href={`/track/${o.id}?t=${o.token}`} title={o.bundle} sub={`${o.businessName}, ${inr(o.monthly)}${t("per_month")}`} right={<OrderStatus stage={o.stage} payment={o.payment} />} />)}
          </div>
        </section>
      )}
    </div>
  );
}
