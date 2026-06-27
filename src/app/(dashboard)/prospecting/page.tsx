import { redirect } from "next/navigation";
import { requireDbUser } from "@/lib/auth";
import { isSuperAdminOwner } from "@/lib/platform/platform-owner";

/** Tenant prospecting moved to owner dashboard only. */
export default async function ProspectingPage() {
  const user = await requireDbUser();
  if (isSuperAdminOwner(user)) {
    redirect("/owner-dashboard/sales");
  }
  redirect("/unauthorized");
}
