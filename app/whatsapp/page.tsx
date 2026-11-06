"use client";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, CheckCheck, Headset, Mic, MicOff, PackageSearch, RotateCcw, SendHorizontal } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { VerifyProvider, useVerify } from "@/components/customer/verify";
import { AuthGate } from "@/components/customer/auth-gate";
import { api } from "@/lib/client/api";
import type { QuickReply } from "@/lib/advisor/orchestrator";
import { cn } from "@/lib/utils";

/**
 * The WhatsApp-style front end. It is not a separate bot: every message goes through the same conversation controller that answers real
 * WhatsApp (see lib/channels/chat.ts), so commands, plans, prices and order tracking behave identically on both.
 */
interface Msg { id: string; from: "me" | "bot"; text: string; at: number; done?: boolean }
interface ChatResp { messages: string[]; chips: QuickReply[]; needsVerify?: boolean }
interface SR { lang: string; interimResults: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null; start(): void; stop(): void }

const STORE = "ud_wa_chat";
const uid = () => Math.random().toString(36).slice(2, 10);

/** WhatsApp formatting only: *bold*, _italic_, and links. Nothing else is interpreted and no HTML is ever injected. */
function Formatted({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, li, all) => (
        <Fragment key={li}>
          {line.split(/(\*[^*\n]+\*|_[^_\n]+_|https?:\/\/[^\s]+)/g).map((p, i) => {
            if (/^\*[^*\n]+\*$/.test(p)) return <b key={i}>{p.slice(1, -1)}</b>;
            if (/^_[^_\n]+_$/.test(p)) return <i key={i}>{p.slice(1, -1)}</i>;
            if (/^https?:\/\//.test(p)) {
              const url = p.replace(/[).,]+$/, ""), tail = p.slice(url.length);
              let same = false;
              try { same = new URL(url).origin === window.location.origin; } catch { /* external */ }
              return <Fragment key={i}><a href={url} {...(same ? {} : { target: "_blank", rel: "noopener noreferrer" })} className="break-all font-medium text-[#027eb5] underline underline-offset-2 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-[#027eb5]">{url}</a>{tail}</Fragment>;
            }
            return <span key={i}>{p}</span>;
          })}
          {li < all.length - 1 && <br />}
        </Fragment>
      ))}
    </>
  );
}

const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function Chat() {
  const { lang, setLang } = useI18n();
  const { ensureVerified } = useVerify();
  const hi = lang === "hi";
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [chips, setChips] = useState<QuickReply[]>([]);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [listening, setListening] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const recog = useRef<SR | null>(null);
  const busy = useRef(false);

  const bot = useCallback((texts: string[]) => setMsgs((m) => [...m.map((x) => (x.from === "me" ? { ...x, done: true } : x)), ...texts.map((t) => ({ id: uid(), from: "bot" as const, text: t, at: Date.now() }))]), []);

  const send = useCallback(async (raw: string, opts: { silent?: boolean } = {}) => {
    const t = raw.trim();
    if (!t || busy.current) return;
    busy.current = true;
    if (!opts.silent) setMsgs((m) => [...m, { id: uid(), from: "me", text: t, at: Date.now() }]);
    setChips([]); setTyping(true);
    try {
      let r = await api<ChatResp>("POST", "/api/channels/web", { text: t });
      if (r.needsVerify) {
        bot(r.messages); setTyping(false);
        if (await ensureVerified()) { setTyping(true); r = await api<ChatResp>("POST", "/api/channels/web", { text: t }); }
        else { setChips([]); return; }
      }
      bot(r.messages); setChips(r.chips ?? []);
    } catch {
      bot([hi ? "क्षमा करें, कुछ गड़बड़ हो गई। कृपया फिर कोशिश करें।" : "Sorry, something went wrong. Please try again."]);
    } finally { setTyping(false); busy.current = false; }
  }, [bot, ensureVerified, hi]);

  // restore the transcript for this tab, or open the conversation with the server's own greeting
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let saved: { msgs: Msg[]; chips: QuickReply[] } | null = null;
    try { saved = JSON.parse(sessionStorage.getItem(STORE) ?? "null"); } catch { /* storage unavailable: start fresh */ }
    queueMicrotask(() => {
      if (saved?.msgs?.length) { setMsgs(saved.msgs); setChips(saved.chips ?? []); }
      else void send("hi", { silent: true });
    });
  }, [send]);
  useEffect(() => { try { if (msgs.length) sessionStorage.setItem(STORE, JSON.stringify({ msgs: msgs.slice(-80), chips })); } catch { /* ignore */ } }, [msgs, chips]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "end" }); }, [msgs, typing, chips]);

  function onSubmit(e: React.FormEvent) { e.preventDefault(); const t = text; setText(""); void send(t); }

  function mic() {
    if (listening) { recog.current?.stop(); return; }
    const W = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) { bot([hi ? "इस ब्राउज़र में आवाज़ से लिखना उपलब्ध नहीं है — कृपया टाइप करें।" : "Voice input isn't available in this browser — please type instead."]); return; }
    const r = new Ctor();
    r.lang = hi ? "hi-IN" : "en-IN"; r.interimResults = false;
    r.onresult = (e) => setText((p) => (p ? p + " " : "") + e.results[0][0].transcript);
    r.onend = () => setListening(false); r.onerror = () => setListening(false);
    recog.current = r; setListening(true); r.start();
  }

  function newChat() {
    try { sessionStorage.removeItem(STORE); } catch { /* ignore */ }
    setMsgs([]); setChips([]);
    void send("new", { silent: true });
  }
  function chooseLang(l: "en" | "hi") { setLang(l); void send(l === "hi" ? "hindi" : "english"); }

  const tools = [
    { icon: PackageSearch, label: hi ? "ऑर्डर ट्रैक करें" : "Track order", cmd: "track" },
    { icon: Headset, label: hi ? "इंसान से बात" : "Talk to a person", cmd: "human" },
    { icon: RotateCcw, label: hi ? "नया चैट" : "New chat", cmd: "new" },
  ] as const;
  function runTool(cmd: "track" | "human" | "new") { if (cmd === "new") newChat(); else void send(cmd); }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col bg-[#efeae2] text-[#111b21] shadow-xl">
      <header className="flex items-center gap-2 bg-[#008069] px-2 py-2 text-white">
        <Link href="/" aria-label={hi ? "होम पर वापस" : "Back to home"} className="grid size-11 place-items-center rounded-full hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"><ArrowLeft className="size-5" aria-hidden /></Link>
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white" aria-hidden>
          <svg viewBox="0 0 96 96" className="size-8"><rect width="96" height="96" rx="22" fill="#E40000" /><path d="M26 58c0-17 11-30 28-30 9 0 15 4 15 11 0 8-8 13-19 13-6 0-10-2-13-5-1 9 4 15 14 15 7 0 13-3 17-8l6 5c-5 7-14 11-24 11-15 0-24-8-24-18z" fill="#fff" /></svg>
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <h1 className="truncate text-base font-semibold">Accel Business</h1>
          <p className="truncate text-xs text-white/85">{typing ? (hi ? "लिख रहा है…" : "typing…") : hi ? "सलाहकार · ऑनलाइन" : "Advisor · online"}</p>
        </div>
        <div role="group" aria-label={hi ? "भाषा" : "Language"} className="flex overflow-hidden rounded-full bg-white/15 text-sm font-medium">
          {(["en", "hi"] as const).map((l) => (
            <button key={l} type="button" onClick={() => chooseLang(l)} aria-pressed={lang === l} className={cn("h-9 min-w-11 px-3 focus-visible:outline-2 focus-visible:outline-white", lang === l ? "bg-white text-[#008069]" : "text-white")}>{l === "en" ? "EN" : "हि"}</button>
          ))}
        </div>
      </header>

      <div className="flex gap-1.5 overflow-x-auto bg-[#f0f2f5] px-2 py-2" role="toolbar" aria-label={hi ? "त्वरित कार्य" : "Quick actions"}>
        {tools.map((x) => (
          <button key={x.label} type="button" onClick={() => runTool(x.cmd)} className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-white px-3 text-[13px] font-medium text-[#008069] shadow-sm ring-1 ring-black/10 hover:bg-[#f7f8f8] focus-visible:outline-2 focus-visible:outline-[#008069]"><x.icon className="size-4" aria-hidden />{x.label}</button>
        ))}
      </div>

      <div role="log" aria-live="polite" aria-label={hi ? "बातचीत" : "Conversation"} className="flex-1 space-y-1.5 overflow-y-auto px-3 py-3">
        <p className="mx-auto w-fit max-w-[90%] rounded-lg bg-[#fff5c4] px-3 py-1.5 text-center text-xs text-[#54656f]">{hi ? "प्रोटोटाइप · काल्पनिक डेटा। यहाँ असली निजी दस्तावेज़ साझा न करें।" : "Prototype · synthetic data. Please don't share real personal documents here."}</p>
        {msgs.map((m) => (
          <div key={m.id} className={cn("flex", m.from === "me" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[86%] rounded-lg px-2.5 pb-1 pt-1.5 text-[15px] leading-snug shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]", m.from === "me" ? "rounded-tr-none bg-[#d9fdd3]" : "rounded-tl-none bg-white")}>
              <span className="sr-only">{m.from === "me" ? (hi ? "आप: " : "You: ") : hi ? "सलाहकार: " : "Advisor: "}</span>
              <Formatted text={m.text} />
              <span className="float-right ml-3 mt-1 flex items-center gap-0.5 text-[11px] text-[#54656f]">
                {fmtTime(m.at)}
                {m.from === "me" && (m.done ? <CheckCheck className="size-3.5 text-[#027eb5]" aria-label={hi ? "देखा गया" : "Read"} /> : <Check className="size-3.5" aria-label={hi ? "भेजा गया" : "Sent"} />)}
              </span>
              <span className="clear-both block" />
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex justify-start" role="status" aria-label={hi ? "सलाहकार लिख रहा है" : "Advisor is typing"}>
            <div className="flex gap-1 rounded-lg rounded-tl-none bg-white px-3 py-3 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]" aria-hidden>
              {[0, 1, 2].map((i) => <span key={i} className="size-2 rounded-full bg-[#8696a0] motion-safe:animate-bounce" style={{ animationDelay: `${i * 120}ms` }} />)}
            </div>
          </div>
        )}
        {!typing && chips.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1" role="group" aria-label={hi ? "सुझाए गए जवाब" : "Suggested replies"}>
            {chips.map((c) => (
              <button key={c.label + c.value} type="button" onClick={() => send(c.label)} className="min-h-11 rounded-full bg-white px-4 text-sm font-medium text-[#008069] shadow-sm ring-1 ring-[#008069]/40 hover:bg-[#f0fdf4] focus-visible:outline-2 focus-visible:outline-[#008069]">{c.label}</button>
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={onSubmit} className="flex items-center gap-2 bg-[#f0f2f5] px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <label htmlFor="wa-input" className="sr-only">{hi ? "अपना संदेश लिखें" : "Type your message"}</label>
        <input id="wa-input" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} autoComplete="off" enterKeyHint="send"
          placeholder={hi ? "संदेश लिखें" : "Type a message"} className="h-11 min-w-0 flex-1 rounded-full bg-white px-4 text-[15px] text-[#111b21] placeholder:text-[#667781] focus-visible:outline-2 focus-visible:outline-[#008069]" />
        <button type="button" onClick={mic} aria-pressed={listening} aria-label={hi ? "आवाज़ से बोलें" : "Speak your message"} className={cn("grid size-11 shrink-0 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-[#008069]", listening ? "bg-[#008069] text-white" : "bg-white text-[#54656f]")}>{listening ? <MicOff className="size-5" aria-hidden /> : <Mic className="size-5" aria-hidden />}</button>
        <button type="submit" disabled={!text.trim() || typing} aria-label={hi ? "भेजें" : "Send"} className="grid size-11 shrink-0 place-items-center rounded-full bg-[#008069] text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#008069]"><SendHorizontal className="size-5" aria-hidden /></button>
      </form>
    </div>
  );
}

export default function WhatsAppPage() {
  return <VerifyProvider><AuthGate><Chat /></AuthGate></VerifyProvider>;
}
