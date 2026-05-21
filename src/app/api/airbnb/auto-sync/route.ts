import { NextResponse } from "next/server";
import { isBillingLockedError } from "@/lib/billing/billing-guard";
import { getAuthContext, hasPermission } from "@/lib/auth";
import type { AppUserRole } from "@/types/auth";
import {
  handleAirbnbSyncAll,
  handleAirbnbSyncCleanup,
  handleAirbnbSyncProperty,
  handleAirbnbSyncStatus,
} from "@/services/airbnb/airbnb-auto-sync.handlers";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function requireOwnerContext(permission: "properties:read" | "properties:write") {
  const auth = await getAuthContext();
  if (!auth || !hasPermission(auth.role as AppUserRole, permission)) {
    return null;
  }
  return auth;
}

/**
 * Auto-sync vía Route Handler (no Server Actions POST a rutas sin manifiesto).
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    phase?: string;
    propertyId?: string;
  };
  const phase = body.phase ?? "sync";

  if (phase === "status") {
    const auth = await requireOwnerContext("properties:read");
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
      const result = await handleAirbnbSyncStatus(auth.dbUserId);
      return NextResponse.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error de estado";
      return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
  }

  if (phase === "cleanup") {
    const auth = await requireOwnerContext("properties:write");
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
      const result = await handleAirbnbSyncCleanup(auth.dbUserId);
      return NextResponse.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error de limpieza";
      return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
  }

  if (phase === "property") {
    const auth = await requireOwnerContext("properties:write");
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const propertyId = body.propertyId?.trim();
    if (!propertyId) {
      return NextResponse.json({ error: "propertyId requerido" }, { status: 400 });
    }
    try {
      const result = await handleAirbnbSyncProperty(auth.dbUserId, propertyId);
      return NextResponse.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error de sync";
      const status = message.includes("no encontrada") ? 404 : 500;
      return NextResponse.json({ success: false, error: message }, { status });
    }
  }

  const auth = await requireOwnerContext("properties:write");
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await handleAirbnbSyncAll(auth.dbUserId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al sincronizar Airbnb";
    const status = isBillingLockedError(error) ? 402 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
