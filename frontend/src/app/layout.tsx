import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AegisLead",
  description:
    "AegisLead — AI-powered security operations and sales platform for guard services.",
};

import { Providers } from "./providers";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${geistMono.variable} antialiased`}>
        <Providers>{children}</Providers>
        {/*
          lazyOnload rather than afterInteractive: this is a third-party chat
          widget on a different origin, and nothing on any page depends on it.
          afterInteractive starts it as soon as hydration finishes, so it
          competed for the main thread and a fresh connection during the window
          that decides LCP and TBT -- on the login screens most of all, where
          there is almost nothing else to load and the widget was a visible
          share of the work. lazyOnload holds it until the page is idle. The
          widget still appears on every page exactly as before; it just stops
          being on the critical path.
        */}
        <Script
          src="https://widgets.leadconnectorhq.com/loader.js"
          data-resources-url="https://widgets.leadconnectorhq.com/chat-widget/loader.js"
          data-widget-id="6a6cf83a75ab8940e79a20d5"
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}

