import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/styles/globals.css";
import "@/styles/components.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SessionProvider } from "next-auth/react";
import { Analytics } from "@vercel/analytics/react";
import { SentryUserContext } from "@/components/SentryUserContext";
import { PWAProvider } from "@/components/PWAProvider";
import { IntlProvider } from "@/components/IntlProvider";
import { cookies } from "next/headers";
import { locales, defaultLocale, type Locale } from "@/i18n";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: { default: "Ajosave — On-Chain Rotating Savings on Stellar", template: "%s | Ajosave" },
  description: "Join or create trustless savings circles (Ajo/Esusu) powered by Stellar Soroban smart contracts and USDC.",
  keywords: ["ajo", "esusu", "savings", "stellar", "soroban", "usdc", "nigeria", "defi"],
  metadataBase: new URL("https://www.ajosave.app"),
  openGraph: {
    title: "Ajosave — On-Chain Rotating Savings",
    description: "Trustless Ajo/Esusu savings circles on Stellar. Contribute in Naira, receive in USDC.",
    url: "https://www.ajosave.app",
    siteName: "Ajosave",
    type: "website",
    images: [{ url: "/og-default.svg", width: 1200, height: 630, alt: "Ajosave — Trustless rotating savings on Stellar" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ajosave — On-Chain Rotating Savings",
    description: "Trustless Ajo/Esusu savings circles on Stellar. Contribute in Naira, receive in USDC.",
    images: ["/og-default.svg"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies();
  const rawLocale = cookieStore.get("locale")?.value ?? defaultLocale;
  const locale: Locale = locales.includes(rawLocale as Locale) ? (rawLocale as Locale) : defaultLocale;
  const messages = (await import(`../../messages/${locale}.json`)).default;

  return (
    <html lang={locale} className={inter.variable}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('theme')||((window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light');document.documentElement.setAttribute('data-theme',t);})();`,
          }}
        />
      </head>
      <body>
        <SessionProvider>
          <IntlProvider locale={locale} messages={messages}>
            <a href="#main-content" className="skip-link">Skip to main content</a>
            <SentryUserContext />
            <Navbar />
            <main id="main-content">{children}</main>
            <Footer />
            <PWAProvider />
            <Analytics />
          </IntlProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
