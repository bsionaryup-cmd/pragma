"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { TTLockEnvironment, TTLockExpirationStrategy } from "@prisma/client";
import {
  assertBillingUnlocked,
  isBillingLockedError,
} from "@/lib/billing/billing-guard";
import { requireTTLockAdmin } from "@/lib/auth/ttlock-admin";
import {
  completeTTLockConnect,
  disconnectTTLock,
  refreshTTLockToken,
  savePropertyLockMapping,
  saveTTLockAutomationSettings,
  saveTTLockCredentials,
  syncTTLockLocks,
  testTTLockConnection,
  unassignTTLockByLockId,
} from "@/services/integrations/ttlock.service";
import { headers } from "next/headers";
import { resolveRequestContextFromHeaders } from "@/lib/integrations/ttlock-config";

function revalidateTTLock() {
  revalidatePath("/integrations");
  revalidatePath("/integrations/ttlock");
  revalidatePath("/integrations/ttlock/connect");
}

async function getTTLockRequestContext() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const proto = headerStore.get("x-forwarded-proto") ?? "http";
  const requestOrigin = host ? `${proto}://${host}` : null;
  return resolveRequestContextFromHeaders(headerStore, requestOrigin);
}

export async function saveTTLockCredentialsAction(formData: FormData) {
  const user = await requireTTLockAdmin();
  await assertBillingUnlocked();
  const rawEnv = String(formData.get("environment") ?? "PRODUCTION");
  const environment = Object.values(TTLockEnvironment).includes(
    rawEnv as TTLockEnvironment,
  )
    ? (rawEnv as TTLockEnvironment)
    : TTLockEnvironment.PRODUCTION;

  await saveTTLockCredentials(
    user.dbUserId,
    {
      clientId: String(formData.get("clientId") ?? ""),
      clientSecret: String(formData.get("clientSecret") ?? ""),
      environment,
    },
    await getTTLockRequestContext(),
  );
  revalidateTTLock();
}

export async function completeTTLockConnectAction(formData: FormData) {
  const user = await requireTTLockAdmin();
  const state = String(formData.get("state") ?? "").trim();

  try {
    await assertBillingUnlocked();
  } catch (error) {
    if (isBillingLockedError(error)) {
      const params = new URLSearchParams({
        error: error.message,
      });
      if (state) params.set("state", state);
      redirect(`/integrations/ttlock/connect?${params.toString()}`);
    }
    throw error;
  }

  try {
    await completeTTLockConnect(
      user.dbUserId,
      {
        username: String(formData.get("username") ?? ""),
        password: String(formData.get("password") ?? ""),
      },
      await getTTLockRequestContext(),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al conectar TTLock";
    const params = new URLSearchParams({ error: message });
    if (state) params.set("state", state);
    redirect(`/integrations/ttlock/connect?${params.toString()}`);
  }

  revalidateTTLock();

  try {
    await syncTTLockLocks(user.dbUserId);
    redirect("/integrations/ttlock?connected=1&synced=1");
  } catch {
    redirect("/integrations/ttlock?connected=1&sync=manual");
  }
}

export async function testTTLockConnectionAction() {
  const user = await requireTTLockAdmin();
  await assertBillingUnlocked();
  const result = await testTTLockConnection(user.dbUserId, await getTTLockRequestContext());
  revalidateTTLock();
  return result;
}

export async function disconnectTTLockAction() {
  const user = await requireTTLockAdmin();
  await assertBillingUnlocked();
  await disconnectTTLock(user.dbUserId);
  revalidateTTLock();
  redirect("/integrations/ttlock?disconnected=1");
}

export async function refreshTTLockTokenAction() {
  const user = await requireTTLockAdmin();
  await assertBillingUnlocked();
  await refreshTTLockToken(user.dbUserId, await getTTLockRequestContext());
  revalidateTTLock();
}

export async function syncTTLockLocksAction() {
  const user = await requireTTLockAdmin();
  await assertBillingUnlocked();
  await syncTTLockLocks(user.dbUserId);
  revalidateTTLock();
  redirect("/integrations/ttlock?synced=1");
}

export async function savePropertyLockMappingAction(formData: FormData) {
  const user = await requireTTLockAdmin();
  await assertBillingUnlocked();

  const propertyId = String(formData.get("propertyId") ?? "").trim();
  const ttlockLockId = String(formData.get("ttlockLockId") ?? "").trim();

  if (!propertyId && ttlockLockId) {
    await unassignTTLockByLockId(user.dbUserId, ttlockLockId);
    revalidateTTLock();
    redirect("/integrations/ttlock?mapped=1");
  }

  if (!propertyId) {
    redirect(
      "/integrations/ttlock?error=" +
        encodeURIComponent("Selecciona una propiedad para asignar la cerradura."),
    );
  }

  await savePropertyLockMapping(user.dbUserId, {
    propertyId,
    ttlockLockId,
    alias: String(formData.get("alias") ?? ""),
    timezone: String(formData.get("timezone") ?? ""),
  });
  revalidateTTLock();
  redirect("/integrations/ttlock?mapped=1");
}

export async function saveTTLockAutomationSettingsAction(formData: FormData) {
  const user = await requireTTLockAdmin();
  await assertBillingUnlocked();
  const rawStrategy = String(formData.get("expirationStrategy") ?? "CHECKOUT_TIME");
  const expirationStrategy = Object.values(TTLockExpirationStrategy).includes(
    rawStrategy as TTLockExpirationStrategy,
  )
    ? (rawStrategy as TTLockExpirationStrategy)
    : TTLockExpirationStrategy.CHECKOUT_TIME;

  await saveTTLockAutomationSettings(user.dbUserId, {
    generateAfterGuestRegistration:
      formData.get("generateAfterGuestRegistration") === "on",
    revokeAfterCheckout: formData.get("revokeAfterCheckout") === "on",
    requireManualApproval: formData.get("requireManualApproval") === "on",
    autoSendCode: formData.get("autoSendCode") === "on",
    allowRegeneration: formData.get("allowRegeneration") === "on",
    expirationStrategy,
  });
  revalidateTTLock();
}

/** @deprecated */
export async function saveTTLockConnectionAction(formData: FormData) {
  return saveTTLockCredentialsAction(formData);
}
