import { requireAnyPermission } from "@/lib/auth";

export default async function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAnyPermission("finance:read", "finance:operations:read");
  return children;
}
