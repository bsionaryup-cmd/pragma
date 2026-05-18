import { requirePermission } from "@/lib/auth";

export default async function InboxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermission("reservations:read");

  return <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>;
}
