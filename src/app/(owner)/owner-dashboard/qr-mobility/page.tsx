import { redirect } from "next/navigation";
import { OWNER_DASHBOARD_PATH } from "@/lib/platform/constants";

/** QR Mobility owner console parked — PMS-first. */
export default function QrMobilityDashboardPage() {
  redirect(OWNER_DASHBOARD_PATH);
}
