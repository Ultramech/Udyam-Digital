import type { Metadata } from "next";

export const metadata: Metadata = { title: "Operations · Airtel Business", robots: { index: false } };

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
