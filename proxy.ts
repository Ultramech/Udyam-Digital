import { NextResponse, type NextRequest } from "next/server";
import { loginUrl, needsAccount } from "@/lib/accounts/routes";

/**
 * Next.js 16 proxy (formerly middleware). Runs before every page: a customer page requested without an account cookie is sent
 * to sign-in first, with ?next= so they come straight back after the OTP. It only checks that the cookie exists — validity and
 * profile setup are checked by <AuthGate> and, authoritatively, by every API (lib/accounts/guard.ts).
 */
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  // a rep in co-pilot mode fills the advisor on the owner's behalf; the API verifies the staff session
  const coPilot = pathname === "/advisor" && req.nextUrl.searchParams.get("copilot") === "1" && !!req.cookies.get("ud_staff")?.value;
  if (needsAccount(pathname) && !coPilot && !req.cookies.get("ud_auth")?.value) {
    return NextResponse.redirect(new URL(loginUrl(pathname + search), req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)"] };
