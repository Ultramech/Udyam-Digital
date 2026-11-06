"use client";
import { useState } from "react";
import { Headset } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";
import { useVerify } from "./verify";
import { api, readJourney, writeJourney } from "@/lib/client/api";

/** Never a dead end: asking for a person creates a lead (with everything the advisor already knows) and says so. */
export function TalkToPerson({ variant = "outline", compact }: { variant?: "outline" | "ghost" | "default"; compact?: boolean }) {
  const { t, lang } = useI18n();
  const { ensureVerified } = useVerify();
  const [busy, setBusy] = useState(false);
  async function go() {
    if (!(await ensureVerified())) return;
    setBusy(true);
    try {
      const j = readJourney();
      const r = await api<{ conversationId: string }>("POST", "/api/advisor", { conversationId: j.conversationId, text: "I want to talk to a person please", lang });
      writeJourney({ conversationId: r.conversationId });
      toast.success((lang === "hi" || lang === "mr") ? "विशेषज्ञ आपको 2 कार्य-घंटों में कॉल करेगा — आपकी जानकारी उसे मिल गई है।" : "A specialist will call you within 2 working hours — they already have your details.");
    } catch { toast.error(t("error_generic")); }
    setBusy(false);
  }
  if (compact) {
    return (
      <Button variant="ghost" size="icon" onClick={go} disabled={busy} aria-label={t("talk_person")} title={t("talk_person")}>
        <Headset className="size-5" />
      </Button>
    );
  }
  return (
    <Button variant={variant} onClick={go} disabled={busy}>
      <Headset className="size-4" />{t("talk_person")}
    </Button>
  );
}
