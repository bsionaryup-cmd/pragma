import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";
import { processInboundAirbnbEmail } from "@/modules/airbnb-email";
import { recordReservationActivityFromInboundEmail } from "@/modules/reservation-activity";
import { recordModificationObservabilityFromInboundEmail } from "@/modules/reservation-events";
import {
  assertAirbnbEmailIntegrationEnabled,
  assertPropertyInOrganization,
} from "@/modules/airbnb-email/lib/tenant-guard";
import {
  buildEmailBody,
  extractReservationSignals,
} from "@/modules/airbnb-email/parsing/extractors";
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

  if (outcome.auditId) {
    const bodyPreview = buildEmailBody({
      subject: body.subject,
      html: body.html,
      text: body.text,
    });
    const signals = extractReservationSignals({
      subject: body.subject,
      body: bodyPreview,
      html: body.html,
    });

    await recordReservationActivityFromInboundEmail({
      organizationId: body.organizationId,
      auditId: outcome.auditId,
      reservationId: outcome.reservationId ?? null,
      propertyId: body.propertyId ?? null,
      subject: body.subject,
      html: body.html,
      text: body.text,
      from: body.from,
      signals,
      pipelineEventKind: outcome.eventKind ?? null,
      receivedAt: body.receivedAt ?? null,
    }).catch((error) => {
      airbnbEmailLog.warn("reservation_activity_failed", {
        auditId: outcome.auditId,
        reservationId: outcome.reservationId ?? undefined,
        error: error instanceof Error ? error.message : "unknown",
      });
    });

    await recordModificationObservabilityFromInboundEmail({
      organizationId: body.organizationId,
      auditId: outcome.auditId,
      reservationId: outcome.reservationId ?? null,
      propertyId: body.propertyId ?? null,
      subject: body.subject,
      html: body.html,
      text: body.text,
      signals,
    })
      .then((result) => {
        if (result.recorded) {
          revalidatePath("/novedades");
        }
      })
      .catch((error) => {
        airbnbEmailLog.warn("modification_observability_failed", {
          auditId: outcome.auditId,
          reservationId: outcome.reservationId ?? undefined,
          error: error instanceof Error ? error.message : "unknown",
        });
      });
  }

  airbnbEmailLog.info("manual_inbound", {
    organizationId: body.organizationId,
    status: outcome.status,
    auditId: outcome.auditId || undefined,
  });

  if (outcome.auditId) {
    revalidatePath("/novedades");
  }

  return NextResponse.json({ ok: true, outcome });
}
