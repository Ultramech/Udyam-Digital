import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_Devanagari, Noto_Sans_Tamil } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/components/i18n-provider";
import { CatalogueSync } from "@/components/catalogue-sync";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const deva = Noto_Sans_Devanagari({ variable: "--font-deva", subsets: ["devanagari"], weight: ["400", "500", "600", "700"] });
const tamil = Noto_Sans_Tamil({ variable: "--font-tamil", subsets: ["tamil"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "Airtel Business · Udyam Digital",
  description: "Find the right business bundle, verify in minutes and get activated — on your phone, in your language. (Prototype · synthetic data)",
  manifest: "/manifest.webmanifest",
};
export const viewport: Viewport = { themeColor: "#E40000", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${deva.variable} ${tamil.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <I18nProvider>{children}</I18nProvider>
        <Toaster position="top-center" richColors />
        <CatalogueSync />
      </body>
    </html>
  );
}
