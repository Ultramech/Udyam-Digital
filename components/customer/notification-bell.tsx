"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { readJourney } from "@/lib/client/api";
import { loadNotes, seenSet } from "@/lib/client/notifications";

/** Header bell with an unread count. Only fetches when this device holds an order or a support request. */
export function NotificationBell() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const refresh = () => {
      const j = readJourney();
      if (!j.orders.length && !(j.tickets ?? []).length) { setN(0); return; }
      loadNotes().then((notes) => { const seen = seenSet(); setN(notes.filter((x) => !seen.has(x.id)).length); }).catch(() => {});
    };
    refresh();
    const t = setInterval(refresh, 30000);
    window.addEventListener("ud-notes-seen", refresh);
    return () => { clearInterval(t); window.removeEventListener("ud-notes-seen", refresh); };
  }, []);
  return (
    <Link href="/notifications" className="relative flex size-8 items-center justify-center rounded-full border bg-card" aria-label={n ? `Notifications, ${n} unread` : "Notifications"}>
      <Bell className="size-4" />
      {n > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] font-bold leading-4 text-primary-foreground">{n > 9 ? "9+" : n}</span>}
    </Link>
  );
}
