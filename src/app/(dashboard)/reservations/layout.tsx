import { requirePermission } from "@/lib/auth";

export default async function ReservationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermission("reservations:read");
  return children;
}
