import { redirect } from "next/navigation";
import { OWNER_DASHBOARD_PATH } from "@/lib/platform/constants";

/** Sales console parked — PMS-first. */
export default function OwnerSalesPage() {
  redirect(OWNER_DASHBOARD_PATH);
}
