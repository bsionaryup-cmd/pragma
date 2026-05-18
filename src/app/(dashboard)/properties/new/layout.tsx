import { requirePermission } from "@/lib/auth";

export default async function NewPropertyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermission("properties:write");
  return children;
}
