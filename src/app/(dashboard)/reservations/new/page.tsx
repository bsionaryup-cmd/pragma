import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { redirectIfBillingLocked } from "@/lib/billing/require-billing-route";

export default async function NewReservationPage() {
  await requirePermission("reservations:create");
  await redirectIfBillingLocked("/reservations/new");
  redirect("/reservations?create=true");
}
