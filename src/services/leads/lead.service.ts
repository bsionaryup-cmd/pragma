import { LeadStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { isValidPhoneNumber } from "@/lib/phone/phone-number";

export type CreateLeadInput = {
  fullName: string;
  email: string;
  phone?: string;
  propertyCount?: number;
  message?: string;
  source?: string;
};

function isLeadSchemaMissing(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: string }).code;
  return code === "P2021" || code === "P2022";
}

export async function createLead(
  input: CreateLeadInput,
): Promise<{ ok: boolean; message: string }> {
  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone?.trim() || null;

  if (phone && !isValidPhoneNumber(phone)) {
    return { ok: false, message: "Indica un teléfono válido con código de país" };
  }

  if (fullName.length < 2) {
    return { ok: false, message: "Indica tu nombre completo" };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: "Email inválido" };
  }

  try {
    const existing = await db.lead.findFirst({
      where: { email, status: { in: [LeadStatus.NEW, LeadStatus.CONTACTED] } },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      return {
        ok: true,
        message: "Ya recibimos tu solicitud. Te contactaremos pronto.",
      };
    }

    await db.lead.create({
      data: {
        fullName,
        email,
        phone,
        propertyCount: input.propertyCount ?? null,
        message: input.message?.trim() || null,
        source: input.source ?? "landing",
      },
    });

    return { ok: true, message: "Solicitud recibida. Te contactaremos en breve." };
  } catch (error) {
    if (isLeadSchemaMissing(error)) {
      return {
        ok: false,
        message: "Captura de leads no disponible. Regístrate directamente.",
      };
    }
    throw error;
  }
}

export async function listRecentLeads(limit = 50) {
  try {
    return await db.lead.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  } catch (error) {
    if (isLeadSchemaMissing(error)) return [];
    throw error;
  }
}
