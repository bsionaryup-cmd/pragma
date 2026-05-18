import { requirePermission } from "@/lib/auth";

export default async function PropertiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermission("properties:read");
  return children;
}
