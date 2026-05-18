import { requirePermission } from "@/lib/auth";

export default async function TasksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermission("tasks:read");
  return children;
}
