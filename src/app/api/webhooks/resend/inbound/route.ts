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
import { extractReservationSignals } from "@/modules/airbnb-email/parsing/extractors";
import {
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

  try {
    const event = verifyResendInboundWebhook(rawBody, {
      svixId: headerPayload.get("svix-id"),
      svixTimestamp: headerPayload.get("svix-timestamp"),
      svixSignature: headerPayload.get("svix-signature"),
    });

    if (event.type !== "email.received" || !event.data?.email_id) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const resolved = await resolveOrganizationByInboundEmail(
      event.data.to ?? [],
    );
    if (!resolved) {
      airbnbEmailLog.warn("inbound_address_unknown", {
        to: event.data.to?.join(",") ?? "",
      });
      return NextResponse.json(
        { ok: false, error: "Inbound address no registrado" },
        { status: 404 },
      );
    }

    if (!resolved.enabled) {
      airbnbEmailLog.info("skipped_disabled", {
        organizationId: resolved.organizationId,
      });
      return NextResponse.json({ ok: true, status: "skipped_disabled" });
    }

    const email = await fetchResendReceivedEmail(event.data.email_id);
    const bodyText = email.text ?? "";
    const signals = extractReservationSignals({
      subject: email.subject,
      body: bodyText,
      html: email.html,
    });

    const propertyResolution = await resolvePropertyIdFromEmailSignals(
      resolved.organizationId,
      signals,
      null,
    );

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
      outcome.status === "ignored";

    await touchIntegrationEmailReceived(
      resolved.integrationId,
      success,
      outcome.errorReason,
    );

    return NextResponse.json({ ok: true, outcome });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    const isAuth =
      message.includes("Svix") ||
      message.includes("RESEND_INBOUND") ||
      message.includes("Unauthorized");

    if (isAuth) {
      airbnbEmailLog.warn("webhook_auth_failed", { error: message });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    airbnbEmailLog.error("resend_webhook_failed", { error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
