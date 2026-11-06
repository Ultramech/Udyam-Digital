import type { Ticket } from "@/lib/store/types";
/** What the owner (or an agent) may see: never the access token or the visitor session id. */
export const publicTicket = ({ token: _t, sessionId: _s, ...rest }: Ticket) => (void _t, void _s, rest);
export type PublicTicket = ReturnType<typeof publicTicket>;
