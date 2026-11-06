"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {  } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/components/i18n-provider";
import { CustomerShell } from "@/components/customer/shell";
import { fmtDate } from "@/lib/client/format";
import { loadNotes, markSeen, seenSet, type Note } from "@/lib/client/notifications";
import { cn } from "@/lib/utils";

const ICON: Record<string, string> = { stage: "✅", delay: "⏳", action: "📎", chase: "📞", message: "💬", payment: "💳", kyc: "🪪", visit: "🧰", reply: "🧑‍💼" };

export default function NotificationsPage() {
  const { lang } = useI18n();
  const hi = lang === "hi" || lang === "mr";
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [unread, setUnread] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadNotes().then((n) => {
      const seen = seenSet();
      setUnread(new Set(n.filter((x) => !seen.has(x.id)).map((x) => x.id)));
      setNotes(n);
      markSeen(n.map((x) => x.id)); // opening the inbox marks everything read (still highlighted for this visit)
      window.dispatchEvent(new Event("ud-notes-seen"));
    });
  }, []);

  return (
    <CustomerShell>
      <div className="space-y-4 pb-10">
        <h1 className="text-[1.625rem] font-extrabold leading-tight tracking-tight">{hi ? "सूचनाएँ" : "Notifications"}</h1>
        {!notes ? <div className="space-y-2"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
          : notes.length === 0 ? <Card className="space-y-2 p-4 text-sm text-muted-foreground"><p>{hi ? "अभी कोई सूचना नहीं। ऑर्डर करने के बाद हर अपडेट यहाँ दिखेगा।" : "No notifications yet. After you order, every update shows up here."}</p><Link href="/advisor"><Button size="sm">{hi ? "प्लान बनाएँ" : "Find my plan"}</Button></Link></Card>
          : (
            <ul className="space-y-2">
              {notes.map((n) => (
                <li key={n.id}>
                  <Link href={n.href} className={cn("flex gap-3 rounded-2xl border bg-card shadow-card p-3 text-sm transition-colors hover:border-primary", unread.has(n.id) && "border-primary/50 bg-accent")}>
                    <span aria-hidden className="text-base">{ICON[n.kind] ?? "💬"}</span>
                    <div className="min-w-0 flex-1"><div className="whitespace-pre-wrap">{n.text}</div><div className="mt-0.5 text-xs text-muted-foreground">{n.orderName ? `${n.orderName} · ` : ""}{fmtDate(n.date, lang)}{unread.has(n.id) ? ` · ${hi ? "नया" : "new"}` : ""}</div></div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        <p className="text-xs text-muted-foreground">{hi ? "यही अपडेट WhatsApp/Telegram पर भी आते हैं, अगर आपने चैट जोड़ी है।" : "The same updates also go to WhatsApp/Telegram if you've linked a chat."}</p>
      </div>
    </CustomerShell>
  );
}
