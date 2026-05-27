import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { airbnbEmailLog } from "@/lib/airbnb-email/airbnb-email-logger";
import { processInboundAirbnbEmail } from "@/modules/airbnb-email";
import {
  fetchResendReceivedEmail,
  isResendInboundConfigured,
  verifyResendInboundWebhook,
} from "@/modules/airbnb-email/integrations/resend-inbound.client";
import { resolvePropertyIdFromEmailSignals } from "@/modules/airbnb-email/matching/property-resolver";
import {
  buildEmailBody,
  extractReservationSignals,
} from "@/modules/airbnb-email/parsing/extractors";
import {
  recordIntegrationInboundReceived,
  resolveOrganizationByInboundEmail,
  touchIntegrationEmailReceived,
} from "@/services/integrations/tenant-airbnb-email-integration.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isResendInboundConfigured()) {
    return NextResponse.json(
      { error: "Resend inbound no configurado" },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const headerPayload = await headers();
  let integrationId: string | null = null;

  try {
    const event = verifyResendInboundWebhook(rawBody, {
      svixId: headerPayload.get("svix-id"),
      svixTimestamp: headerPayload.get("svix-timestamp"),
      svixSignature: headerPayload.get("svix-signature"),
    });

    if (event.type !== "email.received" || !event.data?.email_id) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const webhookTo = event.data.to ?? [];
    let resolved = await resolveOrganizationByInboundEmail(webhookTo);

    const email = await fetchResendReceivedEmail(event.data.email_id);

    if (!resolved) {
      resolved = await resolveOrganizationByInboundEmail([
        ...webhookTo,
        ...(email.to ?? []),
      ]);
    }

    if (!resolved) {
      airbnbEmailLog.warn("inbound_address_unknown", {
        toRaw: webhookTo.join(",") || undefined,
        toFetched: email.to?.join(",") || undefined,
        configuredDomain:
          process.env.AIRBNB_INBOUND_EMAIL_DOMAIN?.trim() ||
          "inbound.pragmapms.com",
      });
      return NextResponse.json(
        { ok: false, error: "Inbound address no registrado" },
        { status: 404 },
      );
    }

    airbnbEmailLog.info("inbound_tenant_resolved", {
      organizationId: resolved.organizationId,
      matchedAddress: resolved.matchedAddress,
    });

    if (!resolved.enabled) {
      airbnbEmailLog.info("skipped_disabled", {
        organizationId: resolved.organizationId,
      });
      return NextResponse.json({ ok: true, status: "skipped_disabled" });
    }

    integrationId = resolved.integrationId;
    await recordIntegrationInboundReceived(integrationId);
    const bodyPreview = buildEmailBody({
      subject: email.subject,
      html: email.html,
      text: email.text,
    });

    const signals = extractReservationSignals({
      subject: email.subject,
      body: bodyPreview,
      html: email.html,
    });

    const propertyResolution = await resolvePropertyIdFromEmailSignals(
      resolved.organizationId,
      signals,
      null,
    );

    airbnbEmailLog.info("property_resolution", {
      organizationId: resolved.organizationId,
      propertyId: propertyResolution.propertyId ?? undefined,
      ambiguous: propertyResolution.ambiguous,
      method: propertyResolution.resolutionMethod,
      airbnbRoomId: signals.airbnbRoomId ?? undefined,
    });

    const outcome = await processInboundAirbnbEmail(
      {
        messageId: email.message_id ?? event.data.message_id ?? email.id,
        from: email.from,
        to: email.to[0] ?? null,
        subject: email.subject,
        html: email.html,
        text: email.text,
        receivedAt: email.created_at ?? event.created_at,
        raw: { provider: "resend", eventType: event.type, emailId: email.id },
      },
      {
        organizationId: resolved.organizationId,
        integrationId: resolved.integrationId,
        propertyId: propertyResolution.propertyId,
        listingAmbiguous: propertyResolution.ambiguous,
      },
    );

    const success =
      outcome.status === "processed" ||
      outcome.status === "manual_review" ||
      outcome.status === "ignored" ||
      outcome.status === "skipped_duplicate";

    await touchIntegrationEmailReceived(
      resolved.integrationId,
      success,
      outcome.errorReason,
    );

    revalidatePath("/integrations/airbnb");
    if (outcome.reservationId) {
      revalidatePath("/reservations");
    }

    return NextResponse.json({ ok: true, outcome });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    const isAuth =
      message.includes("Svix") ||
      message.includes("RESEND_INBOUND") ||
      message.includes("Unauthorized");

    if (integrationId && !isAuth) {
      await touchIntegrationEmailReceived(integrationId, false, message).catch(
        () => undefined,
      );
      revalidatePath("/integrations/airbnb");
    }

    if (isAuth) {
      airbnbEmailLog.warn("webhook_auth_failed", { error: message });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    airbnbEmailLog.error("resend_webhook_failed", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
