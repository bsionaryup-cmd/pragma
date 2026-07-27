import { redirect } from "next/navigation";
import { OWNER_DASHBOARD_PATH } from "@/lib/platform/constants";

/** Owner INTIENDAS users admin retired. */
export default function RetailUsersRetiredPage() {
  redirect(OWNER_DASHBOARD_PATH);
}
