import { requirePermission } from "@/lib/auth";

export default async function CalendarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermission("calendar:read");
  return children;
}
