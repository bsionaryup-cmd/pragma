import "server-only";

import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import {
  DEFAULT_ORGANIZATION_PAYMENT_METHODS,
  type OrganizationPaymentMethod,
} from "@/lib/payments/organization-payment-methods-types";
import { requireTenantDataScope } from "@/lib/platform/require-tenant-data-scope";

function parseMethods(value: unknown): OrganizationPaymentMethod[] {
  if (!Array.isArray(value)) return DEFAULT_ORGANIZATION_PAYMENT_METHODS;

  const parsed = value
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const item = row as Record<string, unknown>;
      const type = item.type;
      if (
        type !== "payment_link" &&
        type !== "cash" &&
        type !== "bank_transfer" &&
        type !== "other"
      ) {
        return null;
      }
      const id = String(item.id ?? randomUUID()).trim();
      if (!id) return null;
      return {
        id,
        enabled: item.enabled !== false,
        type,
        ...(item.label ? { label: String(item.label).trim() } : {}),
        ...(item.account_holder
          ? { account_holder: String(item.account_holder).trim() }
          : {}),
      } satisfies OrganizationPaymentMethod;
    })
    .filter((row): row is OrganizationPaymentMethod => row !== null);

  return parsed.length > 0 ? parsed : DEFAULT_ORGANIZATION_PAYMENT_METHODS;
}

export async function getOrganizationPaymentMethods(): Promise<
  OrganizationPaymentMethod[]
> {
  const scope = await requireTenantDataScope();
  if (!scope.organizationId) return DEFAULT_ORGANIZATION_PAYMENT_METHODS;

  const row = await db.organizationPaymentMethodConfig.findUnique({
    where: { organizationId: scope.organizationId },
    select: { methods: true },
  });

  if (!row) return DEFAULT_ORGANIZATION_PAYMENT_METHODS;
  return parseMethods(row.methods);
}

export async function saveOrganizationPaymentMethods(
  methods: OrganizationPaymentMethod[],
): Promise<OrganizationPaymentMethod[]> {
  const scope = await requireTenantDataScope();
  if (!scope.organizationId) {
    throw new Error("Organización no disponible");
  }

  const normalized = parseMethods(methods).map((method) => ({
    ...method,
    id: method.id || randomUUID(),
  }));

  await db.organizationPaymentMethodConfig.upsert({
    where: { organizationId: scope.organizationId },
    create: {
      organizationId: scope.organizationId,
      methods: normalized,
    },
    update: { methods: normalized },
  });

  return normalized;
}

export function findOrganizationPaymentMethodLabel(
  methods: OrganizationPaymentMethod[],
  accountMethodId: string | null | undefined,
): string | null {
  if (!accountMethodId) return null;
  const match = methods.find((method) => method.id === accountMethodId);
  if (!match) return null;
  return match.label ?? match.account_holder ?? match.type;
}
