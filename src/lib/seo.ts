import type { Metadata, Viewport } from "next";
import { BRAND_ASSETS } from "@/lib/brand-assets";
import { BRAND, SEO_KEYWORDS } from "@/lib/brand";

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "https://pragma-pms.vercel.app";

export function getSiteUrl(): string {
  return siteUrl;
}

export const defaultMetadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: BRAND.productName,
    template: `%s | ${BRAND.productName}`,
  },
  description: BRAND.tagline,
  applicationName: BRAND.productName,
  keywords: [...SEO_KEYWORDS],
  authors: [{ name: BRAND.name }],
  creator: BRAND.name,
  icons: {
    icon: [
      { url: BRAND_ASSETS.favicon16, type: "image/png", sizes: "16x16" },
      { url: BRAND_ASSETS.favicon32, type: "image/png", sizes: "32x32" },
      { url: BRAND_ASSETS.symbolSvg, type: "image/svg+xml" },
    ],
    apple: [{ url: BRAND_ASSETS.appleTouch, sizes: "180x180", type: "image/png" }],
    shortcut: BRAND_ASSETS.favicon32,
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "es_CO",
    url: siteUrl,
    siteName: BRAND.productName,
    title: BRAND.productName,
    description: BRAND.tagline,
    images: [
      {
        url: BRAND_ASSETS.og,
        width: 1200,
        height: 630,
        alt: BRAND.productName,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND.productName,
    description: BRAND.tagline,
    images: [BRAND_ASSETS.og],
  },
  alternates: {
    canonical: siteUrl,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const landingMetadata: Metadata = {
  title: `${BRAND.name} — Property Management Software`,
  description: BRAND.positioning,
  openGraph: {
    title: BRAND.productName,
    description: BRAND.tagline,
    url: siteUrl,
    images: [BRAND_ASSETS.og],
  },
  alternates: { canonical: siteUrl },
};

export const defaultViewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: BRAND.colors.white },
    { media: "(prefers-color-scheme: dark)", color: BRAND.colors.darkNavy },
  ],
};

export const dashboardMetadata: Metadata = {
  title: "Command Center",
  description: "PRAGMA Command Center — operación, reservas y automatización.",
  robots: { index: false, follow: false },
};
