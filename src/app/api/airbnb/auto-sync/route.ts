import { NextResponse } from "next/server";
import { getAuthContext, hasPermission } from "@/lib/auth";
import { withTimeout } from "@/lib/async-timeout";
import type { AppUserRole } from "@/types/auth";
import {
  cleanupDisconnectedAirbnbImportsAction,
  getAirbnbSyncStatusAction,
  syncAirbnbCalendarsAction,
} from "@/features/properties/actions/airbnb-sync.actions";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const SYNC_TIMEOUT_MS = 90_000;

async function requirePropertiesWriteApi() {
  const auth = await getAuthContext();
  if (!auth || !hasPermission(auth.role as AppUserRole, "properties:write")) {
    return null;
  }
  return auth;
}

/**
 * Auto-sync estable: evita POST de Server Actions a rutas sin manifiesto (p. ej. /integrations → 404 + timeout).
 */
export async function POST(request: Request) {
  const auth = await requirePropertiesWriteApi();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    phase?: string;
  };
  const phase = body.phase ?? "sync";

  if (phase === "status") {
    const result = await getAirbnbSyncStatusAction();
    return NextResponse.json(result);
  }

  if (phase === "cleanup") {
    const result = await cleanupDisconnectedAirbnbImportsAction();
    return NextResponse.json(result);
  }

  try {
    const result = await withTimeout(
      syncAirbnbCalendarsAction(),
      SYNC_TIMEOUT_MS,
      "La sincronización Airbnb tardó demasiado en local. Reintenta en unos segundos.",
    );
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al sincronizar Airbnb";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
