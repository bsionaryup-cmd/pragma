import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveApiAuth } from "@/lib/api/require-api-auth";
import {
  appendProspectingActivity,
  updateProspectingLeadCrm,
} from "@/services/prospecting/prospecting-crm.service";
import { getProspectingLeadRow } from "@/services/prospecting/prospecting-lead.service";

const activitySchema = z.object({
  type: z.enum([
    "CONTACT_WHATSAPP",
    "CONTACT_WEBSITE",
    "PHONE_COPIED",
  ]),
  summary: z.string().trim().min(1).max(500).optional(),
});

const patchSchema = z.object({
  status: z
    .enum([
      "NEW",
      "CONTACTED",
      "RESPONDED",
      "INTERESTED",
      "FOLLOW_UP",
      "DEMO",
      "CUSTOMER",
      "NOT_INTERESTED",
      "ARCHIVED",
    ])
    .optional(),
  notes: z.string().max(8000).nullable().optional(),
  nextFollowUpDate: z.string().datetime().nullable().optional(),
  activity: activitySchema.optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await resolveApiAuth("integrations:read");
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  const lead = await getProspectingLeadRow(auth.context.organizationId, id);
  if (!lead) {
    return NextResponse.json({ success: false, error: "Prospecto no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ success: true, lead });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await resolveApiAuth("integrations:read");
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const { id } = await context.params;
    const json: unknown = await request.json();
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Solicitud inválida" }, { status: 400 });
    }

    if (parsed.data.activity) {
      const summary =
        parsed.data.activity.summary ??
        ({
          CONTACT_WHATSAPP: "Abrió WhatsApp",
          CONTACT_WEBSITE: "Abrió sitio web",
          PHONE_COPIED: "Copió teléfono",
        }[parsed.data.activity.type] ?? "Actividad de contacto");

      const withActivity = await appendProspectingActivity(auth.context.organizationId, id, {
        type: parsed.data.activity.type,
        summary,
      });
      if (!withActivity) {
        return NextResponse.json({ success: false, error: "Prospecto no encontrado" }, { status: 404 });
      }
    }

    const lead = await updateProspectingLeadCrm(auth.context.organizationId, id, {
      status: parsed.data.status,
      notes: parsed.data.notes,
      nextFollowUpDate:
        parsed.data.nextFollowUpDate === undefined
          ? undefined
          : parsed.data.nextFollowUpDate
            ? new Date(parsed.data.nextFollowUpDate)
            : null,
      touchContact: Boolean(parsed.data.activity),
      incrementFollowUp: parsed.data.status === "FOLLOW_UP",
    });

    if (!lead) {
      return NextResponse.json({ success: false, error: "Prospecto no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ success: true, lead });
  } catch (error) {
    console.error("[prospecting/leads/patch]", error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: "No se pudo actualizar el prospecto" }, { status: 500 });
  }
}
