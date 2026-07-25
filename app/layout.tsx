import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { LeagueProvider } from "@/contexts/LeagueContext";
import { RefreshProvider } from "@/contexts/RefreshContext";
import { ThemeProvider } from "@/components/theme-provider";

// UI font — Resend's "Inter for UI" lane. Drives buttons, nav, labels, card body.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// ABC Favorit substitute (per DESIGN.md "Note on Font Substitutes").
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Code / tabular data — exact match to DESIGN.md's code-md token.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Domaine Display substitute — the editorial serif signature for hero numbers/headings.
const instrumentSerif = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Interactive League",
  description: "Play now.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${inter.variable} ${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <RefreshProvider>
          <LeagueProvider>
            {children}
          </LeagueProvider>
        </RefreshProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
