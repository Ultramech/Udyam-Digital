import type { Check, KycStatus } from "./types";

/**
 * After the owner drops GST products (re-quote), a GST-related BLOCK no longer stops the order — but anything else still does.
 * A human review decision overrides review/reupload flags.
 */
export function effectiveKycStatus(
  checks: Check[],
  opts: { requeued?: boolean; decision?: "approved" | "rejected" | "correction" },
): KycStatus | "approved" | "rejected" {
  if (opts.decision === "approved") return "approved";
  if (opts.decision === "rejected") return "rejected";
  const live = checks.filter((c) => !(opts.requeued && c.severity === "block"));
  if (opts.decision === "correction") return "reupload";
  if (live.some((c) => c.severity === "block")) return "blocked";
  if (live.some((c) => c.severity === "reupload")) return "reupload";
  if (live.some((c) => c.severity === "review")) return "review";
  return "verified";
}
