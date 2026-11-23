import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { serializePublishedSite } from "@/lib/web-builder/serialize-public-site";
import { renderTenantPublicSite } from "@/modules/web-builder/render-public-site";
import { getPublishedSiteBySlug } from "@/services/web-builder/web-site.service";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const site = await getPublishedSiteBySlug(slug);
  if (!site) return { title: "Sitio no encontrado" };

  const title = site.seoTitle?.trim() || site.siteName;
  const description = site.seoDescription?.trim() || site.heroSubtitle || undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: site.ogImageUrl ? [{ url: site.ogImageUrl }] : undefined,
    },
    alternates: site.seoCanonicalUrl
      ? { canonical: site.seoCanonicalUrl }
      : undefined,
  };
}

export default async function PublicWebSitePage({ params }: PageProps) {
  const { slug } = await params;
  const site = await getPublishedSiteBySlug(slug);
  if (!site) notFound();

  const payload = serializePublishedSite(site);
  return renderTenantPublicSite(payload);
}