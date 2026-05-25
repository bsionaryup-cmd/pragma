"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireDbUser, requirePermission } from "@/lib/auth";
import {
  createSupportTicket,
  listMySupportTickets,
  replyToSupportTicket,
} from "@/services/support/support.service";
import { isSuperAdminOwner } from "@/lib/platform/platform-owner";

const createTicketSchema = z.object({
  subject: z.string().min(3).max(200),
  body: z.string().min(10).max(8000),
  category: z.enum([
    "BUG",
    "BILLING",
    "RESERVATIONS",
    "INTEGRATIONS",
    "ACCESS",
    "OTHER",
  ]),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  propertyId: z.string().optional(),
  reservationId: z.string().optional(),
  routeContext: z.string().max(500).optional(),
  screenshotUrl: z.string().url().optional().or(z.literal("")),
  screenshotPreview: z.string().max(120_000).optional(),
  clientErrors: z
    .array(
      z.object({
        message: z.string(),
        stack: z.string().optional(),
        at: z.string(),
        route: z.string().optional(),
      }),
    )
    .max(12)
    .optional(),
  browser: z.record(z.string(), z.union([z.string(), z.null()])).optional(),
});

export async function createSupportTicketAction(
  raw: z.infer<typeof createTicketSchema>,
) {
  await requirePermission("dashboard:read");
  const user = await requireDbUser();
  const parsed = createTicketSchema.parse(raw);

  const ticket = await createSupportTicket({
    ...parsed,
    screenshotUrl: parsed.screenshotUrl || null,
    screenshotPreview: parsed.screenshotPreview ?? null,
    routeContext: parsed.routeContext ?? null,
    clientErrors: parsed.clientErrors,
    browser: parsed.browser,
    userId: user.id,
  });

  revalidatePath("/owner-dashboard/support");
  return { success: true as const, ticketId: ticket.id };
}

export async function listMySupportTicketsAction() {
  await requirePermission("dashboard:read");
  const user = await requireDbUser();
  const tickets = await listMySupportTickets(user.id);
  return { success: true as const, tickets };
}

const platformReplySchema = z.object({
  ticketId: z.string().min(1),
  body: z.string().min(1).max(8000),
  status: z
    .enum(["OPEN", "IN_REVIEW", "WAITING_FOR_USER", "RESOLVED", "CLOSED"])
    .optional(),
});

export async function platformReplySupportTicketAction(
  raw: z.infer<typeof platformReplySchema>,
) {
  const user = await requireDbUser();
  if (!isSuperAdminOwner(user)) {
    return { success: false as const, error: "No autorizado" } as const;
  }

  const parsed = platformReplySchema.parse(raw);
  await replyToSupportTicket({
    ticketId: parsed.ticketId,
    body: parsed.body,
    authorId: user.id,
    authorKind: "platform",
    nextStatus: parsed.status ?? "IN_REVIEW",
  });

  revalidatePath("/owner-dashboard/support");
  return { success: true as const };
}
