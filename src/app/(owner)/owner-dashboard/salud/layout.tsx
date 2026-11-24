import { redirect } from "next/navigation";
import { OWNER_DASHBOARD_PATH } from "@/lib/platform/constants";

export default function OwnerSaludLayout() {
  redirect(OWNER_DASHBOARD_PATH);
}
