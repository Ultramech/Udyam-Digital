import { ok, route } from "@/lib/api";
import { serviceStatus } from "@/lib/services/status";

/** Public and safe: reports whether each component is live, never any secret. */
export const GET = route(async () => ok({ services: serviceStatus() }));
