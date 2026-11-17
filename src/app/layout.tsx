import type { Metadata, Viewport } from "next";
import { Inter, Unbounded, Noto_Sans_Malayalam, Noto_Sans_Devanagari } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { ThemeScript } from "@/components/portal/theme-script";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const unbounded = Unbounded({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-unbounded", display: "swap" });
const malayalam = Noto_Sans_Malayalam({ subsets: ["malayalam"], weight: ["400", "500", "600", "700"], variable: "--font-malayalam", display: "swap" });
const devanagari = Noto_Sans_Devanagari({ subsets: ["devanagari"], weight: ["400", "500", "600"], variable: "--font-devanagari", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Beehive Home", template: "%s · Beehive Home" },
  description: "Run the Beehive Home apartments in Panampilly Nagar, Kochi.",
  applicationName: "Beehive Home",
  appleWebApp: { capable: true, title: "Beehive", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ECEEF2" },
    { media: "(prefers-color-scheme: dark)", color: "#0E1014" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} suppressHydrationWarning className={`${inter.variable} ${unbounded.variable} ${malayalam.variable} ${devanagari.variable}`}>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-dvh">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
