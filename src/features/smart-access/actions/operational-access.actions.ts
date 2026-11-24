"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";
import type { CreateOperationalAccessCodeInput } from "@/services/integrations/ttlock/operational-access.schema";
import {
  createOperationalAccessCode,
  revokeOperationalAccessCode,
} from "@/services/integrations/ttlock/ttlock-operational-access.service";

function revalidateOperationalAccess(): void {
  revalidatePath("/smart-access");
}

export async function createOperationalAccessCodeAction(
  input: CreateOperationalAccessCodeInput,
) {
  const [user, scope] = await Promise.all([
    requirePermission("access:manage"),
    requireTenantDataScope(),
  ]);
  const result = await createOperationalAccessCode(
    input,
    scope,
    user.dbUserId,
  );
  if (result.ok) revalidateOperationalAccess();
  return result;
}

export async function revokeOperationalAccessCodeAction(
  credentialId: string,
) {
  const [user, scope] = await Promise.all([
    requirePermission("access:manage"),
    requireTenantDataScope(),
  ]);
  const result = await revokeOperationalAccessCode(
    credentialId,
    scope,
    user.dbUserId,
  );
  if (result.ok) revalidateOperationalAccess();
  return result;
}

