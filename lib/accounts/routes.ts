/**
 * Which customer pages need a verified phone (OTP) + completed profile. Shared by proxy.ts (instant redirect when there is no
 * account cookie at all) and <AuthGate> (checks the session is real and the profile is set up). The APIs behind these pages
 * enforce the same rule server-side (lib/accounts/guard.ts), so the UI gate is a convenience, not the protection.
 */
export const PUBLIC_PAGES = ["/", "/login", "/privacy", "/connect"];
const PUBLIC_PREFIXES = ["/p/", "/ops", "/api", "/_next"];

export const needsAccount = (path: string) => !PUBLIC_PAGES.includes(path) && !PUBLIC_PREFIXES.some((p) => path.startsWith(p)) && !/\.[a-z0-9]{2,5}$/i.test(path);
export const SETUP_PATH = "/account/setup";
export const loginUrl = (next: string) => `/login?next=${encodeURIComponent(next)}`;
