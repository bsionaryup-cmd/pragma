import { redirect } from "next/navigation";
import { OWNER_DASHBOARD_PATH } from "@/lib/platform/constants";

/** Owner INTIENDAS admin retired. */
export default function RetailAdminRetiredPage() {
  redirect(OWNER_DASHBOARD_PATH);
}
