import { requirePermission } from "@/lib/auth";

export default async function NewReservationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermission("reservations:write");
  return children;
}
