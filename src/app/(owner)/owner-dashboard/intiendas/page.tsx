import { redirect } from "next/navigation";
import { OWNER_DASHBOARD_PATH } from "@/lib/platform/constants";

/** INTIENDAS owner console parked — PMS-first. */
export default function RetailAdminDashboardPage() {
  redirect(OWNER_DASHBOARD_PATH);
}
