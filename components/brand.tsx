import { Activity, Cloud, Flame, Globe, Hash, Mail, MessageCircle, MessageSquare, Network, Package, Phone, PhoneCall, Radio, Receipt, Server, Shield, ShieldCheck, Smartphone, Truck, Video, Wifi, Zap, type LucideIcon } from "lucide-react";
import { productIcon } from "@/lib/catalogue/plain";
import { cn } from "@/lib/utils";

/** The red Airtel-style swirl mark. Original drawing, not Airtel's trademark artwork. */
export function Mark({ className, tone = "red" }: { className?: string; tone?: "red" | "white" }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("shrink-0", className ?? "size-9")} aria-hidden>
      <path d="M8 27c0-12 9-20 21-20 6 0 10 3 10 8 0 6-6 10-14 10-4 0-7-1-9-3 0 6 3 10 10 10 5 0 9-2 12-6l4 3c-4 6-10 9-18 9C15 38 8 34 8 27z" fill={tone === "white" ? "#fff" : "var(--primary)"} />
    </svg>
  );
}

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Mark />
      {!compact && (
        <span className="flex items-center gap-2.5 leading-none">
          <span className="text-[1.375rem] font-extrabold lowercase tracking-tight text-primary">airtel</span>
          <span aria-hidden className="h-6 w-px bg-border" />
          <span className="text-[1.25rem] font-extrabold tracking-tight">SYNC</span>
          <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-accent-foreground">Business</span>
        </span>
      )}
    </span>
  );
}

const ICONS: Record<string, LucideIcon> = {
  wifi: Wifi, zap: Zap, radio: Radio, server: Server, smartphone: Smartphone, "shield-check": ShieldCheck, network: Network, hash: Hash,
  "phone-call": PhoneCall, phone: Phone, "message-square": MessageSquare, "message-circle": MessageCircle, mail: Mail, cloud: Cloud, globe: Globe,
  receipt: Receipt, shield: Shield, flame: Flame, video: Video, activity: Activity, truck: Truck, package: Package,
};
export function ProductIcon({ id, className }: { id: string; className?: string }) {
  const I = ICONS[productIcon(id)] ?? Package;
  return <I className={className ?? "size-4"} aria-hidden />;
}
