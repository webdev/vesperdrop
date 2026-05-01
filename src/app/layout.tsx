import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Geist, Newsreader, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { PostHogProvider } from "@/components/posthog-provider";
import { env } from "@/lib/env";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-serif" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

const SITE_URL = env.SITE_URL.replace(/\/$/, "");
const SITE_NAME = "Vesperdrop";
const SITE_DESCRIPTION =
  "AI lifestyle photography for Shopify and Amazon sellers. Drop a product photo, get a library of lifestyle shots in 90 seconds.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — lifestyle photography, generated`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "AI product photography",
    "lifestyle photography",
    "Shopify product photos",
    "Amazon A+ content",
    "ecommerce photography",
    "virtual photoshoot",
    "product to lifestyle",
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — lifestyle photography, generated`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — lifestyle photography, generated`,
    description: SITE_DESCRIPTION,
  },
  robots: env.SITE_PUBLIC
    ? {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          "max-image-preview": "large",
          "max-snippet": -1,
        },
      }
    : { index: false, follow: false, nocache: true },
  icons: { icon: "/favicon.ico" },
  category: "technology",
};

export const viewport: Viewport = {
  themeColor: "#faf7f0",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${newsreader.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Suspense fallback={null}>
          <PostHogProvider>{children}</PostHogProvider>
        </Suspense>
      </body>
    </html>
  );
}
