import type { Metadata } from "next";
import QRCode from "qrcode";

export const metadata: Metadata = { title: "Chat with us · Udyam Digital" };
export const dynamic = "force-dynamic";

/** Scan-to-chat page for the deck, posters and evaluators: one QR per live chat channel, plus the web app itself. */
export default async function ConnectPage() {
  const wa = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "");
  const join = process.env.NEXT_PUBLIC_WHATSAPP_JOIN?.trim();
  const tg = process.env.NEXT_PUBLIC_TELEGRAM_BOT?.replace(/^@/, "");
  const base = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "");

  const cards: { title: string; url: string; color: string; steps: string[] }[] = [];
  if (wa) cards.push({
    title: "WhatsApp", color: "#008069",
    url: `https://wa.me/${wa}${join ? `?text=${encodeURIComponent(join)}` : ""}`,
    steps: join
      ? [`Scan, then press send on the pre-filled "${join}" — this connects your number once (test line while our Meta business number is under review).`, "Then tell the advisor about your business in your own words, in English or Hindi.", "Type track, human, hindi, stop or delete my data at any time."]
      : ["Scan and say hi.", "Tell the advisor about your business in your own words, in English or Hindi."],
  });
  if (tg) cards.push({
    title: "Telegram", color: "#1A7DAF", url: `https://t.me/${tg}`,
    steps: ["Scan and tap Start — no join step.", "Describe your business; share your contact when asked to see your orders."],
  });
  if (base) cards.push({ title: "Web app", color: "#E40000", url: base, steps: ["Advisor, quote, KYC, e-sign, payment and tracker — on your phone."] });

  const qrs = await Promise.all(cards.map((c) => QRCode.toString(c.url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#111111", light: "#ffffff" } })));

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-[1.625rem] font-extrabold leading-tight tracking-tight">Chat with the Udyam Digital advisor</h1>
      <p className="mt-1 text-sm text-muted-foreground">Same advisor, same rules engine and the same orders on every channel. Prototype · synthetic catalogue.</p>
      {cards.length === 0 && <p className="mt-8 text-sm">No chat channel is configured yet.</p>}
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c, i) => (
          <section key={c.title} className="rounded-xl border bg-card p-5">
            <h2 className="text-lg font-semibold" style={{ color: c.color }}>{c.title}</h2>
            <div className="mx-auto mt-3 w-48 rounded-lg bg-white p-2 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qrs[i] }} />
            <a href={c.url} target="_blank" rel="noreferrer" className="mt-3 block break-all text-center text-xs underline">{c.url}</a>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">{c.steps.map((s) => <li key={s}>{s}</li>)}</ol>
          </section>
        ))}
      </div>
    </main>
  );
}
