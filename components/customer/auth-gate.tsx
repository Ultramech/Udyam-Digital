"use client";
import { useEffect, useSyncExternalStore } from "react";

const noop = () => () => {};
import { usePathname, useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { loginUrl, needsAccount, SETUP_PATH } from "@/lib/accounts/routes";
import { useVerify } from "./verify";

/**
 * Customer pages render only for a signed-in account (phone verified by OTP) whose profile is set up.
 * No session → /login?next=…; signed in but not set up → /account/setup?next=…. Public pages render as they are.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { verified, account } = useVerify();
  // co-pilot (staff on the owner's behalf) is authorised by the staff session, checked by the advisor API
  const search = useSyncExternalStore(noop, () => window.location.search, () => ""); // "" during SSR/hydration → no mismatch
  const coPilot = path === "/advisor" && new URLSearchParams(search).get("copilot") === "1";
  const gated = needsAccount(path) && !coPilot;
  const here = path + search;
  const state: "public" | "loading" | "signin" | "setup" | "ok" =
    !gated ? "public" : verified === null ? "loading" : !account ? "signin" : !account.onboarded && path !== SETUP_PATH ? "setup" : "ok";

  useEffect(() => {
    if (state === "signin") router.replace(loginUrl(here));
    if (state === "setup") router.replace(`${SETUP_PATH}?next=${encodeURIComponent(here)}`);
  }, [state, here, router]);

  if (state === "public" || state === "ok") return <>{children}</>;
  return <div className="space-y-3" aria-busy="true"><Skeleton className="h-10" /><Skeleton className="h-48" /></div>;
}
