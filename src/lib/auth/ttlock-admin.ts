import { requireRole } from "@/lib/auth";

export async function requireTTLockAdmin() {
  return requireRole("ADMIN");
}
