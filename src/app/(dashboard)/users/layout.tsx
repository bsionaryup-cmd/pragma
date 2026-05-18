import { requirePermission } from "@/lib/auth";

export default async function UsersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermission("users:read");
  return children;
}
