"use client";
import Link from "next/link";
import { UserRound } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { useVerify } from "./verify";

/** Header: initial of the signed-in owner (→ My account), or a person icon that opens sign-in. Icon-sized for 360–390px headers. */
export function AccountButton() {
  const { account, ensureVerified } = useVerify();
  const { lang } = useI18n();
  const hi = lang === "hi" || lang === "mr";
  if (account) {
    const initial = (account.name?.trim()[0] ?? "").toUpperCase();
    return (
      <Link href="/account" aria-label={hi ? "मेरा अकाउंट" : `My account${account.name ? ` (${account.name})` : ""}`}
        className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
        {initial || <UserRound className="size-4" />}
      </Link>
    );
  }
  return (
    <button type="button" onClick={() => ensureVerified()} aria-label={hi ? "साइन इन करें" : "Sign in"}
      className="flex size-8 items-center justify-center rounded-full border bg-card">
      <UserRound className="size-4" />
    </button>
  );
}
