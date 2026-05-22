import { requirePermission } from "@/lib/auth";

export async function requireTTLockAdmin() {
  return requirePermission("integrations:manage");
}
