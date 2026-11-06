import { Activity, Cloud, Flame, Globe, Hash, Mail, MessageCircle, MessageSquare, Network, Package, Phone, PhoneCall, Radio, Receipt, Server, Shield, ShieldCheck, Smartphone, Truck, Video, Wifi, Zap, type LucideIcon } from "lucide-react";
import { productIcon } from "@/lib/catalogue/plain";
import { cn } from "@/lib/utils";

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <svg viewBox="0 0 96 96" className="size-8 shrink-0" aria-hidden>
        <rect width="96" height="96" rx="22" fill="var(--primary)" />
        <path d="M26 58c0-17 11-30 28-30 9 0 15 4 15 11 0 8-8 13-19 13-6 0-10-2-13-5-1 9 4 15 14 15 7 0 13-3 17-8l6 5c-5 7-14 11-24 11-15 0-24-8-24-18z" fill="#fff" />
      </svg>
      {!compact && <span className="leading-none">Airtel <span className="font-normal text-muted-foreground">Business</span></span>}
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
