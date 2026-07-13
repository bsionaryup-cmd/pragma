import { redirect } from "next/navigation";
import { RetailAdminSectionShell } from "@/components/retail-admin/retail-admin-section-shell";
import { RetailUsersView } from "@/components/retail-admin/retail-users-view";
import {
  PlatformOwnerForbiddenError,
  requirePlatformOwnerUser,
} from "@/lib/platform/require-platform-owner";
import { listRetailAccounts } from "@/modules/retail-admin/services/retail-admin-user.service";

export const dynamic = "force-dynamic";

export default async function RetailUsersPage() {
  try {
    await requirePlatformOwnerUser();
  } catch (error) {
    if (error instanceof PlatformOwnerForbiddenError) redirect("/unauthorized");
    throw error;
  }
  const users = await listRetailAccounts();
  return (
    <RetailAdminSectionShell activeSection="usuarios" sectionTitle="Usuarios">
      <RetailUsersView users={users} />
    </RetailAdminSectionShell>
  );
}
