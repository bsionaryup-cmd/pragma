import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";

export default async function NewReservationPage() {
  await requirePermission("reservations:write");
  redirect("/reservations?create=true");
}
