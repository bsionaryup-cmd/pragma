import { redirect } from "next/navigation";
import { OwnerSupportConsole } from "@/components/owner/owner-support-console";
import { requireDbUser } from "@/lib/auth";
import { isSuperAdminOwner } from "@/lib/platform/platform-owner";
import { listPlatformSupportTickets } from "@/services/support/support.service";

export default async function OwnerSupportPage() {
  const user = await requireDbUser();
  if (!isSuperAdminOwner(user)) {
    redirect("/unauthorized");
  }

  const tickets = await listPlatformSupportTickets({ limit: 80 });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <OwnerSupportConsole initialTickets={tickets} />
    </div>
  );
}
