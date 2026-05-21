import { requirePermission } from "@/lib/auth";

export default async function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermission("finance:read");
  return children;
}
