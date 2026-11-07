import type { Metadata, Viewport } from "next";
import { Geist_Mono, Noto_Sans_Devanagari, Noto_Sans_Tamil, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/components/i18n-provider";
import { CatalogueSync } from "@/components/catalogue-sync";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const deva = Noto_Sans_Devanagari({ variable: "--font-deva", subsets: ["devanagari"], weight: ["400", "500", "600", "700"] });
const tamil = Noto_Sans_Tamil({ variable: "--font-tamil", subsets: ["tamil"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "Udyam Digital · Airtel Business",
  description: "Find the right business bundle, verify in minutes and get activated — on your phone, in your language. (Prototype · synthetic data)",
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/logo.png", type: "image/png" }], apple: "/logo.png" },
};
export const viewport: Viewport = { themeColor: "#F7F4EE", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${jakarta.variable} ${geistMono.variable} ${deva.variable} ${tamil.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>
          <I18nProvider>{children}</I18nProvider>
          <Toaster position="top-center" richColors />
          <CatalogueSync />
        </ThemeProvider>
      </body>
    </html>
  );
}
