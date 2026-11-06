import { z } from "zod";

/** Owner-editable business fields (registry-verified identifiers are set by KYC only). */
export const BusinessFields = z.object({
  name: z.string().trim().min(2).max(80),
  businessType: z.string().trim().max(60).nullable().optional(),
  city: z.string().trim().max(60).nullable().optional(),
  employees: z.number().int().min(1).max(100_000).nullable().optional(),
  sites: z.number().int().min(1).max(500).nullable().optional(),
});
