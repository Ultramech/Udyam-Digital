"use client";
import { ThemeProvider as NextThemes } from "next-themes";

/** Light / dark theme for the whole app. The choice is saved on this device; "light" until the owner switches it in Account. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <NextThemes attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>{children}</NextThemes>;
}
