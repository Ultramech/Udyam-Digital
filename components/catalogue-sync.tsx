"use client";
import { useEffect } from "react";
import { applyOverrides, type Override } from "@/lib/catalogue/overrides";

/** Mirrors ops' catalogue edits (pause / price / setup) into the browser copy so displayed prices match what the server charges. */
export function CatalogueSync() {
  useEffect(() => {
    fetch("/api/catalogue").then((r) => (r.ok ? r.json() : null)).then((d: { overrides?: Override[] } | null) => { if (d?.overrides) applyOverrides(d.overrides); }).catch(() => undefined);
  }, []);
  return null;
}
