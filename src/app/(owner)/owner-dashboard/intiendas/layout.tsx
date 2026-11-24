import { redirect } from "next/navigation";
import { OWNER_DASHBOARD_PATH } from "@/lib/platform/constants";

export default function OwnerIntiendasLayout() {
  redirect(OWNER_DASHBOARD_PATH);
}
