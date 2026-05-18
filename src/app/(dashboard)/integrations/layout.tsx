import { requirePermission } from "@/lib/auth";

export default async function IntegrationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermission("properties:read");
  return children;
}
