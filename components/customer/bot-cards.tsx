"use client";
import { useEffect, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import QRCode from "qrcode";
import { useI18n } from "@/components/i18n-provider";
import { tgLink, waLink } from "@/components/customer/channel-links";

function Qr({ url, label }: { url: string; label: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => { QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#1B1416", light: "#FFFFFF" } }).then(setSvg).catch(() => setSvg("")); }, [url]);
  return <div role="img" aria-label={label} className="size-20 shrink-0 rounded-xl border bg-white p-1.5 [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />;
}

/** The two real chat bots, each with its own QR code and a tap-to-open link. Shown only for channels that are configured. */
export function BotCards() {
  const { t } = useI18n();
  const wa = waLink(), tg = tgLink();
  if (!wa && !tg) return null;
  const cards = [
    wa && { url: wa, icon: MessageCircle, title: t("bot_wa"), sub: t("bot_wa_d"), tone: "text-[#008069]" },
    tg && { url: tg, icon: Send, title: t("bot_tg"), sub: t("bot_tg_d"), tone: "text-[#229ED9]" },
  ].filter(Boolean) as { url: string; icon: typeof Send; title: string; sub: string; tone: string }[];
  return (
    <section aria-label={t("bot_title")}>
      <h2 className="mb-2.5 text-base font-bold">{t("bot_title")}</h2>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
        {cards.map((c) => (
          <a key={c.title} href={c.url} target="_blank" rel="noreferrer" className="flex items-center gap-4 rounded-3xl border bg-card p-4 shadow-card transition-colors hover:border-primary">
            <Qr url={c.url} label={`${c.title} QR`} />
            <span className="min-w-0"><span className={`flex items-center gap-2 text-lg font-extrabold ${c.tone}`}><c.icon className="size-5" aria-hidden />{c.title}</span><span className="mt-1 block text-sm text-muted-foreground">{c.sub}</span><span className="mt-1 block text-xs text-muted-foreground">{t("bot_scan")}</span></span>
          </a>
        ))}
      </div>
    </section>
  );
}
