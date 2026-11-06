"use client";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Bot, ChevronDown, Send, User, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/components/i18n-provider";
import { CustomerShell } from "@/components/customer/shell";
import { api, ApiError, readJourney, useJourney, writeJourney, type Journey } from "@/lib/client/api";
import { fmtTime } from "@/lib/client/format";
import { FAQ } from "@/lib/support/faq";
import type { PublicTicket } from "@/lib/support/tickets";
import { cn } from "@/lib/utils";

interface Turn { by: "customer" | "assistant"; text: string; handoff?: boolean }

/** ?order= from the tracker's Help button (read once on the client, never during server render). */
function useSearchParamOrder(): string | null {
  return useSyncExternalStore(() => () => {}, () => new URLSearchParams(window.location.search).get("order"), () => null);
}

export default function SupportPage() {
  const { lang } = useI18n();
  const hi = lang === "hi" || lang === "mr";
  const H = (en: string, h: string) => (hi ? h : en);
  const journey = useJourney();
  const j: Journey = journey ?? { orders: [] };
  const [picked, setPicked] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [tickets, setTickets] = useState<PublicTicket[]>([]);
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const pre = useSearchParamOrder();
  // explicit pick → ?order= from the tracker → most recent order on this device
  const orderId = picked ?? (pre && j.orders.some((o) => o.id === pre) ? pre : j.orders[0]?.id ?? "");
  const setOrderId = setPicked;

  const ticketKey = journey ? (journey.tickets ?? []).map((t) => `${t.id}:${t.token}`).join(",") : null;
  const loadTickets = useCallback((ids: string) => {
    if (!ids) { setTickets([]); return; }
    api<{ tickets: PublicTicket[] }>("GET", `/api/support/tickets?ids=${encodeURIComponent(ids)}`).then((r) => setTickets(r.tickets)).catch(() => {});
  }, []);
  useEffect(() => {
    if (ticketKey === null || !ticketKey) return;
    const load = () => loadTickets(ticketKey);
    load();
    const t = setInterval(load, 8000); // replies show up without a refresh
    return () => clearInterval(t);
  }, [ticketKey, loadTickets]);

  const tok = (id: string) => j.orders.find((o) => o.id === id)?.token;

  async function ask() {
    const text = q.trim();
    if (text.length < 2) return;
    setBusy(true); setQ("");
    setTurns((t) => [...t, { by: "customer", text }]);
    try {
      const r = await api<{ text: string; handoff: boolean }>("POST", "/api/support/ask", { question: text, orderId: orderId || undefined, t: orderId ? tok(orderId) : undefined, lang });
      setTurns((t) => [...t, { by: "assistant", text: r.text, handoff: r.handoff }]);
    } catch { setTurns((t) => [...t, { by: "assistant", text: H("Sorry, I couldn't check that right now. You can send it to a person below.", "माफ़ कीजिए, अभी जाँच नहीं हो पाई। नीचे से किसी व्यक्ति को भेजें।"), handoff: true }]); }
    setBusy(false);
  }

  async function raise() {
    const lastQ = [...turns].reverse().find((t) => t.by === "customer")?.text ?? q.trim();
    if (lastQ.length < 5) { toast.warning(H("Please describe the problem in a few words first.", "पहले कुछ शब्दों में समस्या बताएँ।")); return; }
    setBusy(true);
    try {
      const r = await api<{ ticket: PublicTicket; token: string }>("POST", "/api/support/tickets", {
        text: lastQ, orderId: orderId || undefined, t: orderId ? tok(orderId) : undefined, lang,
        transcript: turns.slice(0, -1).slice(-8).map((t) => ({ by: t.by, text: t.text })),
      });
      writeJourney({ tickets: [{ id: r.ticket.id, token: r.token }, ...(readJourney().tickets ?? [])] }); // the store event refreshes the list
      setTurns([]); setQ("");
      toast.success(H(`Request ${r.ticket.id} sent. A person will reply here.`, `अनुरोध ${r.ticket.id} भेजा गया। जवाब यहीं आएगा।`));
    } catch (e) { toast.error(e instanceof ApiError && e.code === "TOO_MANY_OPEN_TICKETS" ? H("You already have 5 open requests — we'll reply to those first.", "आपके 5 अनुरोध पहले से खुले हैं — पहले उनका जवाब देंगे।") : H("Couldn't send. Please try again.", "भेजा नहीं जा सका। फिर कोशिश करें।")); }
    setBusy(false);
  }

  return (
    <CustomerShell>
      <div className="space-y-5 pb-10">
        <h1 className="text-[1.625rem] font-extrabold leading-tight tracking-tight">{H("Help & support", "मदद और सहायता")}</h1>

        {/* assistant */}
        <Card className="space-y-3 p-3.5">
          <div className="text-sm font-semibold">{H("Ask about your order", "अपने ऑर्डर के बारे में पूछें")}</div>
          {j.orders.length > 0 ? (
            <label className="flex items-center gap-2 text-xs">{H("Order", "ऑर्डर")}
              <select className="h-8 flex-1 rounded-md border bg-card px-2 text-sm" value={orderId} onChange={(e) => setOrderId(e.target.value)}>
                {j.orders.map((o) => <option key={o.id} value={o.id}>{o.name} · {o.id}</option>)}
                <option value="">{H("Not about an order", "ऑर्डर से जुड़ा नहीं")}</option>
              </select>
            </label>
          ) : <p className="text-xs text-muted-foreground">{H("No orders on this device yet — general questions are fine too.", "इस डिवाइस पर अभी कोई ऑर्डर नहीं — सामान्य सवाल भी पूछ सकते हैं।")}</p>}
          {turns.length > 0 && (
            <div className="space-y-2" aria-live="polite">
              {turns.map((t, i) => (
                <div key={i} className={cn("flex gap-2 text-sm", t.by === "customer" && "flex-row-reverse")}>
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">{t.by === "customer" ? <User className="size-3.5" /> : <Bot className="size-3.5" />}</span>
                  <div className={cn("max-w-[85%] rounded-xl px-3 py-2", t.by === "customer" ? "bg-primary text-primary-foreground" : "bg-muted")}>{t.text}</div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Textarea rows={2} value={q} onChange={(e) => setQ(e.target.value)} placeholder={H("e.g. When will my internet be installed?", "जैसे: मेरा इंटरनेट कब लगेगा?")} aria-label={H("Your question", "आपका सवाल")}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }} />
            <Button size="icon" className="self-end" disabled={busy || q.trim().length < 2} onClick={ask} aria-label={H("Ask", "पूछें")}><Send className="size-4" /></Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[H("Where is my order?", "मेरा ऑर्डर कहाँ है?"), H("Is my KYC done?", "क्या मेरा KYC हो गया?"), H("How much is my bill?", "मेरा बिल कितना है?"), H("When is the engineer coming?", "इंजीनियर कब आएगा?")].map((s) => (
              <button key={s} type="button" className="rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => setQ(s)}>{s}</button>
            ))}
          </div>
          {turns.length > 0 && (
            <Button variant={turns[turns.length - 1].handoff ? "default" : "outline"} className="w-full gap-2" disabled={busy} onClick={raise}>
              <UserRound className="size-4" />{H("Send to a person", "व्यक्ति को भेजें")}
            </Button>
          )}
          <p className="text-xs text-muted-foreground">{H("Answers come from your live order record. A person sees everything you asked here, so you won't need to repeat it.", "जवाब आपके ऑर्डर के लाइव रिकॉर्ड से आते हैं। व्यक्ति को आपकी पूरी बातचीत दिखती है, दोहराना नहीं पड़ेगा।")}</p>
        </Card>

        {/* requests */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">{H("My requests", "मेरे अनुरोध")}</h2>
          {tickets.length === 0 && <Card className="p-3.5 text-sm text-muted-foreground">{H("No requests yet.", "अभी कोई अनुरोध नहीं।")}</Card>}
          {tickets.map((t) => <TicketCard key={t.id} t={t} token={j.tickets?.find((x) => x.id === t.id)?.token ?? ""} hi={hi} onChange={() => ticketKey && loadTickets(ticketKey)} />)}
        </section>

        {/* FAQs */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">{H("Common questions", "आम सवाल")}</h2>
          <div className="divide-y rounded-2xl border bg-card">
            {FAQ.map((f) => (
              <div key={f.id}>
                <button type="button" className="flex w-full items-center justify-between gap-3 p-3 text-left text-sm font-medium" aria-expanded={openFaq === f.id} onClick={() => setOpenFaq(openFaq === f.id ? null : f.id)}>
                  {hi ? f.q.hi : f.q.en}<ChevronDown className={cn("size-4 shrink-0 transition-transform", openFaq === f.id && "rotate-180")} />
                </button>
                {openFaq === f.id && <p className="px-3 pb-3 text-sm text-muted-foreground">{hi ? f.a.hi : f.a.en}</p>}
              </div>
            ))}
          </div>
        </section>
      </div>
    </CustomerShell>
  );
}

const STATUS: Record<string, [string, string]> = { open: ["Received", "मिला"], in_progress: ["Being handled", "काम चल रहा है"], resolved: ["Resolved", "हल हो गया"] };

function TicketCard({ t, token, hi, onChange }: { t: PublicTicket; token: string; hi: boolean; onChange: () => void }) {
  const [reply, setReply] = useState("");
  const send = async (body: { text?: string; resolve?: boolean }) => {
    try { await api("POST", `/api/support/tickets/${t.id}`, { t: token, ...body }); setReply(""); onChange(); } catch { toast.error(hi ? "भेजा नहीं जा सका" : "Couldn't send"); }
  };
  return (
    <Card className="space-y-2 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold">{t.id}{t.orderId ? ` · ${t.orderId}` : ""}</div>
        <Badge variant={t.status === "resolved" ? "secondary" : "default"}>{STATUS[t.status][hi ? 1 : 0]}</Badge>
      </div>
      <ul className="space-y-1.5 text-sm">
        {t.messages.filter((m) => m.by !== "assistant").map((m, i) => (
          <li key={i} className={cn("rounded-lg px-2.5 py-1.5", m.by === "staff" ? "bg-accent" : "bg-muted")}>
            <div className="text-xs text-muted-foreground">{m.by === "staff" ? `${m.name ?? "Team"} · Airtel Business` : hi ? "आप" : "You"} · {fmtTime(m.at)}</div>{m.text}
          </li>
        ))}
      </ul>
      {t.status !== "resolved" ? (
        <div className="flex gap-2">
          <Textarea rows={1} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={hi ? "जवाब लिखें…" : "Add a reply…"} aria-label={hi ? "जवाब" : "Reply"} />
          <Button size="sm" disabled={!reply.trim()} onClick={() => send({ text: reply })}>{hi ? "भेजें" : "Send"}</Button>
          <Button size="sm" variant="ghost" onClick={() => send({ resolve: true })}>{hi ? "हल हुआ" : "Resolved"}</Button>
        </div>
      ) : <div className="text-xs text-muted-foreground">{hi ? "फिर से खोलने के लिए नीचे जवाब भेजें।" : "Reply to reopen."} <button type="button" className="text-primary underline" onClick={() => send({ text: hi ? "मुझे अभी भी मदद चाहिए।" : "I still need help with this." })}>{hi ? "फिर खोलें" : "Reopen"}</button></div>}
    </Card>
  );
}
