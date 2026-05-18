import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";

type PropertyDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function PropertyDetailPage({
  params,
}: PropertyDetailPageProps) {
  await requirePermission("properties:read");
  const { id } = await params;
  redirect(`/properties?property=${id}`);
}
