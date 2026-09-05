import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import { SITE, siteUrl } from "@/lib/site";
import { SITE_KEYWORDS } from "@/lib/keywords";
import { softwareApplicationLd, websiteLd } from "@/lib/seo";
import { DownloadGuide } from "@/components/DownloadGuide";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { JsonLd } from "@/components/JsonLd";
import { MixpanelProvider } from "@/components/MixpanelProvider";
import "./globals.css";

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const url = siteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(url),
  title: {
    default: SITE.seoTitle,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.seoDescription,
  applicationName: SITE.name,
  authors: [{ name: SITE.author, url: SITE.website }],
  creator: SITE.author,
  publisher: SITE.name,
  category: "DeveloperApplication",
  keywords: [...SITE_KEYWORDS],
  alternates: { canonical: url },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: SITE.seoTitle,
    description: SITE.seoDescription,
    url,
    siteName: SITE.name,
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE.seoTitle,
    description: SITE.seoDescription,
  },
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    apple: [{ url: "/favicon.png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#171717",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} dark`}>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <MixpanelProvider>
          <JsonLd data={softwareApplicationLd()} />
          <JsonLd data={websiteLd()} />
          <DownloadGuide>
            <SiteHeader />
            {children}
            <SiteFooter />
          </DownloadGuide>
        </MixpanelProvider>
      </body>
    </html>
  );
}
