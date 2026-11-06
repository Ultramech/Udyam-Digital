"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Mic, MicOff, Pencil, Send, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/components/i18n-provider";
import { CustomerShell } from "@/components/customer/shell";
import { BundleCard } from "@/components/customer/bundle-card";
import { useVerify } from "@/components/customer/verify";
import { RichText } from "@/components/rich-text";
import { getPersona } from "@/lib/demo/personas";
import { api, ApiError, readJourney, writeJourney } from "@/lib/client/api";
import { KNOWN_CITIES } from "@/lib/rules/normalise";
import { plainName } from "@/lib/catalogue/plain";
import type { Facts, Slot } from "@/lib/advisor/extract";
import type { AdvisorTurn, QuickReply } from "@/lib/advisor/orchestrator";
import type { ChatMsg } from "@/lib/store/types";
import { cn } from "@/lib/utils";
import { speak, speechSupported, stopSpeaking } from "@/lib/client/speech";

interface Resp { conversationId: string; turn: AdvisorTurn; messages: ChatMsg[]; leadId: string | null; lang?: "en" | "hi" | "mr" | "ta"; kind?: string }

const NEED_PRODUCT: Record<string, string> = { payments: "P19", cctv: "P23", whatsapp: "P15", sms: "P14", email: "P16", backup: "P17", uptime: "P09", static_ip: "P11", phone_system: "P12", tollfree: "P13", wifi: "P22", website: "P18", fleet: "P25", machines: "P24", security: "P20", multisite_mgmt: "P10", fast_internet: "P03", sim_only: "P07" };

function Bubble({ m }: { m: ChatMsg }) {
  const mine = m.role === "user";
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[0.9375rem] leading-relaxed", mine ? "rounded-br-md bg-foreground text-background" : "rounded-bl-md border bg-card")}>
        <RichText text={m.text} />
      </div>
    </div>
  );
}

function FactsPanel({ facts, onEdit }: { facts: Facts; onEdit: () => void }) {
  const { t, lang } = useI18n();
  const rows: [string, string | undefined][] = [
    [t("f_businessType"), facts.businessType], [t("f_employees"), facts.employees?.toString()], [t("f_sites"), facts.sites?.toString()], [t("f_city"), facts.city],
    [t("f_gst"), facts.gst ? (facts.gst === "yes" ? t("yes") : t("no")) : undefined],
    [t("f_needs"), facts.needs.length ? facts.needs.map((n) => (NEED_PRODUCT[n] ? plainName(NEED_PRODUCT[n], lang).split(" (")[0] : n)).join(", ") : undefined],
    [t("f_budget"), facts.budget ? `₹${facts.budget.toLocaleString("en-IN")}` : undefined],
  ];
  const known = rows.filter(([, v]) => v);
  if (!known.length) return null;
  return (
    <details className="group rounded-2xl border bg-card">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-2.5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">{t("facts_title")}</span>
          <span className="block truncate text-sm text-muted-foreground">{known.map(([, v]) => v).join(", ")}</span>
        </span>
        <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="space-y-3 border-t px-4 py-3">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-[0.9375rem]">
          {known.map(([k, v]) => <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-semibold">{v}</dd></div>)}
        </dl>
        <Button variant="outline" size="sm" onClick={onEdit}><Pencil className="size-3.5" />{t("facts_edit")}</Button>
      </div>
    </details>
  );
}

function EditFacts({ open, onClose, facts, onSave }: { open: boolean; onClose: () => void; facts: Facts; onSave: (p: Record<string, unknown>) => void }) {
  const { t } = useI18n();
  // initialised from the current facts; the parent remounts this component each time the dialog opens (see `key`)
  const [f, setF] = useState(() => ({ employees: String(facts.employees ?? ""), sites: String(facts.sites ?? ""), city: facts.city ?? "", gst: facts.gst ?? "", budget: facts.budget ? String(facts.budget) : "" }));
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{t("facts_title")}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label htmlFor="e-emp">{t("f_employees")}</Label><Input id="e-emp" inputMode="numeric" value={f.employees} onChange={(e) => setF({ ...f, employees: e.target.value.replace(/\D/g, "") })} /></div>
          <div className="space-y-1"><Label htmlFor="e-sites">{t("f_sites")}</Label><Input id="e-sites" inputMode="numeric" value={f.sites} onChange={(e) => setF({ ...f, sites: e.target.value.replace(/\D/g, "") })} /></div>
          <div className="space-y-1"><Label htmlFor="e-city">{t("f_city")}</Label>
            <input id="e-city" list="cities" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} className="h-12 w-full rounded-xl border border-input bg-card px-3.5 text-base" />
            <datalist id="cities">{KNOWN_CITIES.map((c) => <option key={c} value={c} />)}</datalist></div>
          <div className="space-y-1"><Label htmlFor="e-gst">{t("f_gst")}</Label>
            <select id="e-gst" value={f.gst} onChange={(e) => setF({ ...f, gst: e.target.value })} className="h-12 w-full rounded-xl border border-input bg-card px-3 text-base"><option value="">—</option><option value="yes">{t("yes")}</option><option value="no">{t("no")}</option></select></div>
          <div className="col-span-2 space-y-1"><Label htmlFor="e-bud">{t("budget_label")}</Label><Input id="e-bud" inputMode="numeric" placeholder="1500" value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value.replace(/\D/g, "") })} /></div>
        </div>
        <Button onClick={() => {
          const patch: Record<string, unknown> = {};
          if (f.employees) patch.employees = Number(f.employees);
          if (f.sites) patch.sites = Number(f.sites);
          if (f.city) patch.city = f.city;
          if (f.gst) patch.gst = f.gst;
          patch.budget = f.budget ? Number(f.budget) : null;
          onSave(patch); onClose();
        }}>{t("save")}</Button>
      </DialogContent>
    </Dialog>
  );
}

function AdvisorInner() {
  const { t, lang, ready, setLang } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const { ensureVerified } = useVerify();
  const [convId, setConvId] = useState<string | undefined>();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [turn, setTurn] = useState<AdvisorTurn | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [listening, setListening] = useState(false);
  const [readAloud, setReadAloud] = useState(false);
  const spoken = useRef(0);
  const [multi, setMulti] = useState<string[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const recRef = useRef<{ stop: () => void } | null>(null);
  const persona = getPersona(params.get("persona"));
  const personaId = persona?.id;
  const copilot = params.get("copilot") === "1";

  const send = useCallback(async (body: Record<string, unknown>) => {
    setBusy(true);
    const said = typeof body.text === "string" ? body.text : typeof body.chipLabel === "string" ? body.chipLabel : null;
    if (said) setMessages((m) => [...m, { role: "user", text: said, at: Date.now() }]); // your words appear at once, before the answer
    try {
      const r = await api<Resp>("POST", "/api/advisor", { conversationId: convId, lang, persona: personaId, attribution: readJourney().attribution ?? {}, ...(copilot ? { copilot: true } : {}), ...body });
      setConvId(r.conversationId); writeJourney({ conversationId: r.conversationId });
      setMessages(r.messages); setTurn(r.turn);
      if (r.lang && r.lang !== lang) setLang(r.lang); // the owner asked to switch language in the chat ("hindi mein batao")
    } catch (e) { toast.error(e instanceof ApiError && e.code === "INVALID_INPUT" ? "That message is too long." : t("error_generic")); }
    setBusy(false);
  }, [convId, lang, personaId, t, setLang, copilot]);

  // start: restore a conversation, run a persona, or greet
  useEffect(() => {
    if (!ready || started.current) return; // wait until the chosen language is known, or a Hindi owner gets an English chat
    started.current = true;
    (async () => {
      const shared = params.get("c") ?? (persona ? undefined : readJourney().conversationId);
      if (shared) {
        try {
          const r = await api<{ conversation: { id: string; messages: ChatMsg[]; facts: Facts; stage: string } | null }>("GET", `/api/advisor?id=${shared}`);
          if (r.conversation) {
            setConvId(r.conversation.id); setMessages(r.conversation.messages);
            const re = await api<Resp>("POST", "/api/advisor", { conversationId: r.conversation.id, lang, factsPatch: {}, refresh: true });
            setTurn(re.turn); setMessages(re.messages);
            return;
          }
        } catch { /* fall through to a fresh conversation */ }
      }
      if (persona) { await send({ text: persona.prompt[(lang === "hi" || lang === "mr") ? "hi" : "en"] }); return; }
      await send({});
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, turn]);
  useEffect(() => { queueMicrotask(() => { try { setReadAloud(localStorage.getItem("ud_read_aloud") === "1" && speechSupported()); } catch { /* storage blocked */ } }); return () => stopSpeaking(); }, []);
  useEffect(() => {
    if (!readAloud) return;
    const last = messages.at(-1);
    if (!last || last.role !== "assistant" || spoken.current === messages.length) return;
    spoken.current = messages.length;
    if (!speak(last.text, lang)) toast.info((lang === "hi" || lang === "mr") ? "इस डिवाइस पर इस भाषा की आवाज़ इंस्टॉल नहीं है।" : "This device has no voice installed for this language.");
  }, [messages, readAloud, lang]);
  function toggleReadAloud() {
    if (!speechSupported()) { toast.info("Spoken replies aren't supported in this browser."); return; }
    const next = !readAloud;
    setReadAloud(next); if (!next) stopSpeaking(); else spoken.current = 0;
    try { localStorage.setItem("ud_read_aloud", next ? "1" : "0"); } catch { /* ignore */ }
  }

  const submit = (e?: React.FormEvent) => { e?.preventDefault(); const v = text.trim(); if (!v || busy) return; setText(""); send({ text: v }); };
  const chip = (c: QuickReply) => {
    if (c.slot === "needs" && c.value !== "not_sure") { setMulti((m) => (m.includes(c.value) ? m.filter((x) => x !== c.value) : [...m, c.value])); return; }
    send({ chip: { slot: c.slot as Slot, value: c.value }, chipLabel: c.label });
  };
  const confirmNeeds = () => { if (!multi.length) return; send({ chip: { slot: "needs", value: multi.join(",") }, chipLabel: multi.map((v) => v).join(", ") }); setMulti([]); };

  function mic() {
    type SR = { lang: string; interimResults: boolean; onresult: (e: { results: { 0: { 0: { transcript: string } } } }) => void; onend: () => void; onerror: () => void; start: () => void; stop: () => void };
    const W = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) { toast.info("Voice input isn't supported in this browser — please type instead."); return; }
    if (listening) { recRef.current?.stop(); return; }
    const r = new Ctor();
    r.lang = { en: "en-IN", hi: "hi-IN", mr: "mr-IN", ta: "ta-IN" }[lang];
    r.interimResults = false;
    r.onresult = (e) => setText((p) => (p ? p + " " : "") + e.results[0][0].transcript);
    r.onend = () => setListening(false);
    r.onerror = () => { setListening(false); toast.error("Couldn't hear that — please try again or type."); };
    recRef.current = r; setListening(true); r.start();
  }

  async function buy() {
    if (!convId) return;
    if (!(await ensureVerified())) return;
    setBusy(true);
    try {
      const q = await api<{ quote: { id: string } }>("POST", "/api/quote", { conversationId: convId });
      writeJourney({ quoteId: q.quote.id });
      router.push(`/quote/${q.quote.id}`);
    } catch (e) { toast.error(e instanceof ApiError && e.code === "NO_PLAN_AVAILABLE" ? "No plan available yet." : t("error_generic")); setBusy(false); }
  }

  const rec = turn?.recommendation;
  const lastIsAssistant = messages.at(-1)?.role === "assistant";
  const chips = turn?.stage === "collecting" && lastIsAssistant ? turn.quickReplies : [];

  return (
    <div className="space-y-3 pb-36">
      {copilot && <div role="status" className="mb-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs"><b>Co-pilot mode</b> — you are assisting this customer as a signed-in rep/partner. Your help is recorded on the lead for assist credit.</div>}
      {turn && <FactsPanel facts={turn.facts} onEdit={() => setEditing(true)} />}
      <div className="space-y-2.5" aria-live="polite">
        {messages.map((m, i) => <Bubble key={i} m={m} />)}
        {busy && (
          <div className="flex justify-start" role="status" aria-label={t("adv_think")}>
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border bg-card px-4 py-4" aria-hidden>
              {[0, 1, 2].map((i) => <span key={i} className="size-2 animate-pulse rounded-full bg-muted-foreground" style={{ animationDelay: `${i * 180}ms` }} />)}
            </div>
          </div>
        )}
      </div>
      {rec && turn?.profile && turn.stage !== "collecting" && <BundleCard rec={rec} profile={turn.profile} onBuy={buy} busy={busy} />}
      <div ref={endRef} />

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur">
        <div className="mx-auto max-w-3xl space-y-2.5 px-4 py-3 md:px-6">
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {chips.map((c, i) => {
                const on = c.slot === "needs" && multi.includes(c.value);
                return <button key={i} type="button" onClick={() => chip(c)} disabled={busy} aria-pressed={on}
                  className={cn("min-h-11 rounded-full border px-4 text-[0.9375rem] font-medium transition-colors", on ? "border-foreground bg-foreground text-background" : "border-input bg-card hover:bg-muted")}>{c.label}</button>;
              })}
              {multi.length > 0 && <Button size="sm" onClick={confirmNeeds}>{t("continue")} ({multi.length})</Button>}
            </div>
          )}
          <form onSubmit={submit} className="flex items-center gap-2">
            <Button type="button" variant={readAloud ? "default" : "outline"} size="icon-lg" onClick={toggleReadAloud} aria-pressed={readAloud} aria-label={(lang === "hi" || lang === "mr") ? "जवाब बोलकर सुनाएँ" : "Read replies aloud"}>{readAloud ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}</Button>
            <Button type="button" variant={listening ? "default" : "outline"} size="icon-lg" onClick={mic} aria-label={t("mic")}>{listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}</Button>
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("adv_placeholder")} aria-label={t("adv_placeholder")} className="flex-1" maxLength={1000} />
            <Button type="submit" size="icon-lg" disabled={busy || !text.trim()} aria-label={t("send")}><Send className="size-4" /></Button>
          </form>
        </div>
      </div>
      {turn && editing && <EditFacts key={editing ? "open" : "closed"} open={editing} onClose={() => setEditing(false)} facts={turn.facts} onSave={(p) => send({ factsPatch: p })} />}
    </div>
  );
}

export default function AdvisorPage() {
  const { t } = useI18n();
  return (
    <CustomerShell step={1}>
      <h1 className="sr-only">{t("adv_title")}</h1>
      <Suspense fallback={<div className="text-sm text-muted-foreground">{t("loading")}</div>}><AdvisorInner /></Suspense>
    </CustomerShell>
  );
}
