import { OwnerTenantDetailView } from "@/components/owner/owner-tenant-detail-view";
import { getOwnerClientDetail } from "@/services/platform/owner-dashboard.service";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function OwnerTenantDetailPage({ params }: PageProps) {
  const { id } = await params;
  const tenant = await getOwnerClientDetail(id);
  if (!tenant) notFound();

  return <OwnerTenantDetailView tenant={tenant} />;
}
