"use client";
import { usePathname } from "next/navigation";
import { DemoDrawer } from "@/components/demo-drawer";
import { needsAccount } from "@/lib/accounts/routes";
import { cn } from "@/lib/utils";
import { BrowseBar, FlowBar, PublicBar, SideRail, TabBar } from "./app-nav";
import { AuthGate } from "./auth-gate";
import { VerifyProvider, useVerify } from "./verify";

export { LanguageSwitch } from "./app-nav";

const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";

/**
 * Frame for every customer screen. Three modes, chosen for you:
 *  - signed out: a light bar with one way in;
 *  - browsing (signed in): five tabs on a phone, a side rail on a laptop;
 *  - buying (a `step` is given): a focused bar with back, progress and a person one tap away, and no tabs.
 */
export function CustomerShell({ children, step, total = 6, wide }: { children: React.ReactNode; step?: number; total?: number; wide?: boolean }) {
  return (
    <VerifyProvider>
      <Frame step={step} total={total} wide={wide}>{children}</Frame>
      <DemoDrawer />
    </VerifyProvider>
  );
}

function Frame({ children, step, total, wide }: { children: React.ReactNode; step?: number; total: number; wide?: boolean }) {
  const path = usePathname();
  const { account, verified } = useVerify();
  const flow = step !== undefined;
  // a gated page is for a signed-in owner (or is about to send them to sign in), so show the signed-in frame without a flash
  const signedIn = !!account || (verified === null && needsAccount(path));
  const tabs = signedIn && !flow && !(account && !account.onboarded);

  return (
    <>
      {tabs && <SideRail demo={DEMO} />}
      <div className={cn("flex min-h-dvh flex-col", tabs && "md:pl-64")}>
        {flow ? <FlowBar step={step} total={total} /> : tabs ? <BrowseBar /> : <PublicBar />}
        <main className={cn("mx-auto w-full flex-1 px-4 py-5 md:px-8 md:py-8", flow ? (wide ? "max-w-5xl" : "max-w-3xl") : wide ? "max-w-5xl" : tabs ? "max-w-3xl" : "max-w-5xl", tabs && "pb-tabbar md:pb-10", flow && "pb-24")}>
          <AuthGate>{children}</AuthGate>
        </main>
        {tabs && <TabBar />}
      </div>
    </>
  );
}
