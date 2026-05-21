import type { Metadata } from "next";
import { APP_NAME } from "@/lib/constants";
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
    default: `${APP_NAME} — Software para anfitriones de Airbnb`,
    template: `%s | ${APP_NAME}`,
  },
  description: BRAND.positioning,
  keywords: [...SEO_KEYWORDS],
  authors: [{ name: APP_NAME }],
  creator: APP_NAME,
  openGraph: {
    type: "website",
    locale: "es_CO",
    url: siteUrl,
    siteName: APP_NAME,
    title: `${APP_NAME} — Controla tu Airbnb desde un solo lugar`,
    description: BRAND.tagline,
    images: [
      {
        url: `${siteUrl}/og-pragma.png`,
        width: 1200,
        height: 630,
        alt: `${APP_NAME} — Airbnb Host Command Center`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} — Airbnb Host Command Center`,
    description: BRAND.tagline,
    images: [`${siteUrl}/og-pragma.png`],
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
  title: "Software para Airbnb — Gestión y automatización para anfitriones",
  description:
    "PRAGMA centraliza reservas, smart access, pricing y operaciones. El copiloto inteligente para anfitriones de Airbnb que escalan sin caos.",
  openGraph: {
    title: "Controla tu Airbnb desde un solo lugar | PRAGMA",
    description: BRAND.tagline,
    url: siteUrl,
  },
  alternates: { canonical: siteUrl },
};

export const dashboardMetadata: Metadata = {
  title: "Command Center",
  description: "Airbnb Host Command Center — operación, reservas y automatización.",
  robots: { index: false, follow: false },
};
