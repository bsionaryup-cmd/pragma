import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { serializePreviewSite } from "@/lib/web-builder/serialize-public-site";
import { requireTenantContext } from "@/lib/platform/tenant-context";
import { renderTenantPublicSite } from "@/modules/web-builder/render-public-site";
import { getTenantWebSitePreviewBySlug } from "@/services/web-builder/web-site.service";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export const metadata: Metadata = {
  title: "Vista previa · Web Builder",
  robots: { index: false, follow: false },
};

export default async function WebSitePreviewPage({ params }: PageProps) {
  await requirePermission("website:read");
  const ctx = await requireTenantContext();
  if (!ctx.organizationId) notFound();

  const { slug } = await params;
  const site = await getTenantWebSitePreviewBySlug(slug, ctx.organizationId);
  if (!site) notFound();

  const payload = serializePreviewSite(site);
  return renderTenantPublicSite(payload, { preview: true });
}