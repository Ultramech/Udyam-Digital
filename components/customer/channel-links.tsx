"use client";
import { MessageCircle, Send } from "lucide-react";

/**
 * Links to the real chat channels, shown only when configured: NEXT_PUBLIC_WHATSAPP_NUMBER (digits with country code, e.g. 14155238886)
 * and NEXT_PUBLIC_TELEGRAM_BOT (bot username without @). `prefill` opens the chat with a first message, e.g. "track".
 * NEXT_PUBLIC_WHATSAPP_JOIN (e.g. "join silver-tiger") marks a Twilio sandbox line: the link pre-fills the one-time join message instead,
 * and a note says so — the owner sends it once, then chats normally.
 */
export const WA = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "");
export const WA_JOIN = process.env.NEXT_PUBLIC_WHATSAPP_JOIN?.trim();
export const TG = process.env.NEXT_PUBLIC_TELEGRAM_BOT?.replace(/^@/, "");
export const waLink = (prefill?: string) => (WA ? `https://wa.me/${WA}${WA_JOIN || prefill ? `?text=${encodeURIComponent(WA_JOIN || prefill!)}` : ""}` : null);
export const tgLink = (prefill?: string) => (TG ? `https://t.me/${TG}${prefill ? `?start=${encodeURIComponent(prefill)}` : ""}` : null);

export function ChannelLinks({ lang, prefill, className = "" }: { lang: string; prefill?: string; className?: string }) {
  if (!WA && !TG) return null;
  const hi = lang === "hi" || lang === "mr";
  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        {WA && <a href={waLink(prefill)!} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#008069] px-3 text-sm font-medium text-[#008069] hover:bg-[#008069]/5"><MessageCircle className="size-4" />{hi ? "WhatsApp पर" : "On WhatsApp"}</a>}
        {TG && <a href={tgLink(prefill)!} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#229ED9] px-3 text-sm font-medium text-[#229ED9] hover:bg-[#229ED9]/5"><Send className="size-4" />{hi ? "Telegram पर" : "On Telegram"}</a>}
      </div>
      {WA && WA_JOIN && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {hi
            ? <>WhatsApp: पहला संदेश <b>&quot;{WA_JOIN}&quot;</b> भरा हुआ आएगा — एक बार भेजें, फिर{prefill ? <> <b>{prefill}</b> लिखें या</> : ""} बात करें। (टेस्ट लाइन — Meta बिज़नेस नंबर की मंज़ूरी बाकी)</>
            : <>WhatsApp: the first message <b>&quot;{WA_JOIN}&quot;</b> is pre-filled — send it once to connect, then{prefill ? <> type <b>{prefill}</b> or</> : ""} just chat. (Test line while our Meta business number is under review.)</>}
        </p>
      )}
    </div>
  );
}
