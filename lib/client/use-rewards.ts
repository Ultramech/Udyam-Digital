"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import type { Rewards } from "@/lib/rewards/coins";

/** The signed-in owner's Udyam Coins (null while loading or when signed out). */
export function useRewards(enabled = true): Rewards | null {
  const [r, setR] = useState<Rewards | null>(null);
  useEffect(() => { if (enabled) api<Rewards>("GET", "/api/me/rewards").then(setR).catch(() => setR(null)); }, [enabled]);
  return r;
}
