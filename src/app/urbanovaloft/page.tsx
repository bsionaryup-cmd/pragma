import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { serializePublishedSite } from "@/lib/web-builder/serialize-public-site";
import { renderTenantPublicSite } from "@/modules/web-builder/render-public-site";
import { getPublishedSiteBySlug } from "@/services/web-builder/web-site.service";

const PILOT_SLUG = "urbanovaloft";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getPublishedSiteBySlug(PILOT_SLUG);
  if (!site) {
    return { title: "URBA NOVA LOFT 33" };
  }
  const title =
    site.seoTitle?.trim() ||
    "URBA NOVA LOFT 33 | Lofts amoblados en Laureles, Medellín";
  const description =
    site.seoDescription?.trim() ||
    "Disfruta de una estancia cómoda en Laureles, Medellín. Conoce nuestros lofts amoblados, consulta disponibilidad y reserva directamente.";
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: site.ogImageUrl ? [{ url: site.ogImageUrl }] : undefined,
    },
    alternates: {
      canonical: site.seoCanonicalUrl || undefined,
    },
  };
}

export default async function UrbanovaLoftLandingPage() {
  const site = await getPublishedSiteBySlug(PILOT_SLUG);
  if (!site) notFound();

  if (site.slug !== PILOT_SLUG) {
    permanentRedirect(`/w/${site.slug}`);
  }

  const payload = serializePublishedSite(site);
  return renderTenantPublicSite(payload);
}