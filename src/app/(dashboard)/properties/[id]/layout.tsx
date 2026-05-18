import { requirePermission } from "@/lib/auth";

export default async function EditPropertyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermission("properties:read");
  return children;
}
