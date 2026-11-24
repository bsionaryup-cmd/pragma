import { redirect } from "next/navigation";
import { OWNER_DASHBOARD_PATH } from "@/lib/platform/constants";

/** Platform health console parked — PMS-first. */
export default function OwnerHealthPage() {
  redirect(OWNER_DASHBOARD_PATH);
}
