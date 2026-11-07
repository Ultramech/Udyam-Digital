import Image from "next/image";
import { Activity, Cloud, Flame, Globe, Hash, Mail, MessageCircle, MessageSquare, Network, Package, Phone, PhoneCall, Radio, Receipt, Server, Shield, ShieldCheck, Smartphone, Truck, Video, Wifi, Zap, type LucideIcon } from "lucide-react";
import { productIcon } from "@/lib/catalogue/plain";
import { cn } from "@/lib/utils";

/** The Airtel mark, from /logo.png (transparent copy of the supplied logo). `white` recolours it for dark or red backgrounds. */
export function Mark({ className, tone = "red" }: { className?: string; tone?: "red" | "white" }) {
  return <Image src="/logo.png" alt="" width={216} height={216} priority className={cn("shrink-0 object-contain", className ?? "size-9", tone === "white" && "brightness-0 invert")} />;
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
