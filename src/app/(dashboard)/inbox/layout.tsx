import { ModuleShellFill } from "@/components/layout/module-shell";
import { requirePermission } from "@/lib/auth";

export default async function InboxLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermission("reservations:read");

  return <ModuleShellFill>{children}</ModuleShellFill>;
}
