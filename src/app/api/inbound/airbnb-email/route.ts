import { NextResponse } from "next/server";
import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";
import { processInboundAirbnbEmail } from "@/modules/airbnb-email";
import {
  assertAirbnbEmailIntegrationEnabled,
  assertPropertyInOrganization,
} from "@/modules/airbnb-email/lib/tenant-guard";
import type { InboundAirbnbEmailPayload } from "@/modules/airbnb-email/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const secret = process.env.AIRBNB_EMAIL_WEBHOOK_SECRET?.trim();
  if (!secret) return false;

  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

type InboundBody = InboundAirbnbEmailPayload & {
  propertyId?: string | null;
  organizationId?: string | null;
};

export async function POST(request: Request) {
  if (!process.env.AIRBNB_EMAIL_WEBHOOK_SECRET?.trim()) {
    return NextResponse.json(
      { error: "Inbound email no configurado" },
      { status: 503 },
    );
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: InboundBody;
  try {
    body = (await request.json()) as InboundBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body.from?.trim() || !body.subject?.trim()) {
    return NextResponse.json(
      { error: "from y subject son obligatorios" },
      { status: 400 },
    );
  }

  if (!body.organizationId?.trim()) {
    return NextResponse.json(
      { error: "organizationId es obligatorio para inbound manual" },
      { status: 400 },
    );
  }

  try {
    await assertAirbnbEmailIntegrationEnabled(body.organizationId);
    if (body.propertyId) {
      await assertPropertyInOrganization(
        body.propertyId,
        body.organizationId,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Forbidden";
    return NextResponse.json({ error: message }, { status: 403 });
  }

  const outcome = await processInboundAirbnbEmail(body, {
    propertyId: body.propertyId ?? null,
    organizationId: body.organizationId,
  });

  airbnbEmailLog.info("manual_inbound", {
    organizationId: body.organizationId,
    status: outcome.status,
    auditId: outcome.auditId || undefined,
  });

  return NextResponse.json({ ok: true, outcome });
}
