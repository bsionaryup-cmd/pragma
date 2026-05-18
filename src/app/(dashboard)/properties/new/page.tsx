import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";

export default async function NewPropertyPage() {
  await requirePermission("properties:write");
  redirect("/properties?create=true");
}
