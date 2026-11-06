"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/components/i18n-provider";
import { api, ApiError } from "@/lib/client/api";
import type { ProfileType } from "@/lib/i18n/profile";

export interface Account { id: string; name: string | null; phoneMasked: string; lang: string; onboarded: boolean; profileType: ProfileType }
interface Ctx { ensureVerified: () => Promise<boolean>; verified: boolean | null; account: Account | null; refresh: () => Promise<void>; signOut: () => Promise<void> }
const Verify = createContext<Ctx>({ ensureVerified: async () => true, verified: null, account: null, refresh: async () => {}, signOut: async () => {} });
export const useVerify = () => useContext(Verify);

/**
 * Phone verification is asked for only when it matters (saving a quote, ordering, requesting a callback) — never up front.
 * The OTP is real: the server sends the SMS through 2Factor.in and checks the code.
 */
export function VerifyProvider({ children }: { children: React.ReactNode }) {
  const t = useT();
  const [verified, setVerified] = useState<boolean | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const otpId = useRef<string | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const refresh = useCallback(async () => {
    try { const r = await api<{ session: { verified?: boolean } | null; user: Account | null }>("GET", "/api/session"); setVerified(!!r.session?.verified); setAccount(r.user); }
    catch { setVerified(false); setAccount(null); }
  }, []);
  useEffect(() => {
    let live = true; // first load: state is set only in the promise callbacks
    api<{ session: { verified?: boolean } | null; user: Account | null }>("GET", "/api/session")
      .then((r) => { if (live) { setVerified(!!r.session?.verified); setAccount(r.user); } })
      .catch(() => { if (live) { setVerified(false); setAccount(null); } });
    return () => { live = false; };
  }, []);
  const signOut = useCallback(async () => { await api("POST", "/api/auth/logout").catch(() => {}); setVerified(false); setAccount(null); }, []);

  const ensureVerified = useCallback(async () => {
    if (verified) return true;
    setOpen(true);
    return new Promise<boolean>((res) => { resolver.current = res; });
  }, [verified]);

  const finish = (ok: boolean) => { setOpen(false); resolver.current?.(ok); resolver.current = null; };

  async function send() {
    setBusy(true);
    const p = phone.replace(/\s/g, "");
    if (!/^[6-9]\d{9}$/.test(p)) { toast.error("Enter a valid 10-digit mobile number"); setBusy(false); return; }
    try {
      const r = await api<{ otpId: string }>("POST", "/api/otp", { phone: p });
      otpId.current = r.otpId; setSent(true);
    } catch (e) {
      const c = e instanceof ApiError ? e.code : "";
      toast.error(c === "OTP_TOO_SOON" ? "Please wait 30 seconds before asking for another code." : c === "OTP_LIMIT" ? "Too many codes requested. Try again in an hour." : c === "OTP_UNAVAILABLE" ? "Phone verification isn't available right now." : "Could not send the code. Try again in a minute.");
    }
    setBusy(false);
  }
  async function check() {
    setBusy(true);
    try {
      if (!otpId.current) throw new ApiError(401, "OTP_EXPIRED");
      await api("PUT", "/api/otp", { otpId: otpId.current, code }); setVerified(true); await refresh(); finish(true);
    } catch (e) {
      const c = e instanceof ApiError ? e.code : "";
      if (c === "OTP_EXPIRED" || c === "OTP_ATTEMPTS") { setSent(false); setCode(""); toast.error("That code expired. Request a new one."); }
      else toast.error(c === "WRONG_OTP" ? "That code isn't right" : t("error_generic"));
    }
    setBusy(false);
  }

  return (
    <Verify.Provider value={{ ensureVerified, verified, account, refresh, signOut }}>
      {children}
      <Dialog open={open} onOpenChange={(o) => { if (!o) finish(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("otp_title")}</DialogTitle>
            <DialogDescription>{t("otp_sms")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="phone">{t("phone")}</Label>
              <Input id="phone" inputMode="numeric" autoComplete="tel" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d ]/g, ""))} disabled={sent} />
            </div>
            {sent && (
              <div className="space-y-1.5">
                <Label htmlFor="otp">{t("otp_code")}</Label>
                <Input id="otp" inputMode="numeric" maxLength={6} placeholder="123456" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus />
              </div>
            )}
            {!sent ? <Button className="w-full" disabled={busy || phone.replace(/\s/g, "").length < 10} onClick={send}>{t("send_otp")}</Button>
              : <Button className="w-full" disabled={busy || code.length < 6} onClick={check}>{t("verify")}</Button>}
          </div>
        </DialogContent>
      </Dialog>
    </Verify.Provider>
  );
}
