"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireDbUser, requirePermission } from "@/lib/auth";
import { requireTenantContext } from "@/lib/platform/tenant-context";
import {
  createSupportTicket,
  getPlatformSupportTicketDetail,
  listMySupportTickets,
  listTenantSupportTickets,
  getTenantSupportTicketDetail,
  listPlatformSupportTickets,
  assignPlatformSupportTicket,
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

export async function listTenantSupportTicketsAction() {
  await requirePermission("dashboard:read");
  const user = await requireDbUser();
  const ctx = await requireTenantContext();
  if (ctx.effectiveRole !== "ADMIN") {
    return { success: false as const, error: "No autorizado" } as const;
  }
  const tickets = await listTenantSupportTickets({ organizationId: ctx.organizationId, limit: 30 });
  return { success: true as const, tickets, userEmail: user.email };
}

const tenantTicketDetailSchema = z.object({
  ticketId: z.string().min(1),
});

export async function getTenantSupportTicketDetailAction(
  raw: z.infer<typeof tenantTicketDetailSchema>,
) {
  await requirePermission("dashboard:read");
  const ctx = await requireTenantContext();
  if (ctx.effectiveRole !== "ADMIN") {
    return { success: false as const, error: "No autorizado" } as const;
  }
  const parsed = tenantTicketDetailSchema.parse(raw);
  const ticket = await getTenantSupportTicketDetail(parsed.ticketId);
  if (!ticket) return { success: false as const, error: "Ticket no encontrado" } as const;
  return { success: true as const, ticket };
}

const tenantReplySchema = z.object({
  ticketId: z.string().min(1),
  body: z.string().min(1).max(8000),
});

export async function tenantReplySupportTicketAction(
  raw: z.infer<typeof tenantReplySchema>,
) {
  await requirePermission("dashboard:read");
  const user = await requireDbUser();
  const ctx = await requireTenantContext();
  if (ctx.effectiveRole !== "ADMIN") {
    return { success: false as const, error: "No autorizado" } as const;
  }
  const parsed = tenantReplySchema.parse(raw);
  const ticket = await getTenantSupportTicketDetail(parsed.ticketId);
  if (!ticket) return { success: false as const, error: "Ticket no encontrado" } as const;

  await replyToSupportTicket({
    ticketId: parsed.ticketId,
    body: parsed.body,
    authorId: user.id,
    authorKind: "tenant",
    nextStatus: "IN_PROGRESS",
  });

  return { success: true as const };
}

const tenantCloseSchema = z.object({
  ticketId: z.string().min(1),
});

export async function tenantCloseSupportTicketAction(
  raw: z.infer<typeof tenantCloseSchema>,
) {
  await requirePermission("dashboard:read");
  const user = await requireDbUser();
  const ctx = await requireTenantContext();
  if (ctx.effectiveRole !== "ADMIN") {
    return { success: false as const, error: "No autorizado" } as const;
  }
  const parsed = tenantCloseSchema.parse(raw);
  const ticket = await getTenantSupportTicketDetail(parsed.ticketId);
  if (!ticket) return { success: false as const, error: "Ticket no encontrado" } as const;

  await replyToSupportTicket({
    ticketId: parsed.ticketId,
    body: "Ticket marcado como resuelto por el cliente.",
    authorId: user.id,
    authorKind: "tenant",
    nextStatus: "RESOLVED",
  });

  return { success: true as const };
}

const platformListSchema = z.object({
  status: z
    .enum(["ALL", "OPEN", "IN_PROGRESS", "WAITING_CLIENT", "RESOLVED", "CLOSED", "ESCALATED"])
    .optional(),
  priority: z.enum(["ALL", "LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  unresolvedOnly: z.boolean().optional(),
  tenantId: z.string().optional(),
  assigned: z.enum(["ANY", "UNASSIGNED", "ME"]).optional(),
  search: z.string().max(200).optional(),
  limit: z.number().min(1).max(100).optional(),
});

export async function listPlatformSupportTicketsAction(
  raw: z.infer<typeof platformListSchema>,
) {
  const user = await requireDbUser();
  if (!isSuperAdminOwner(user)) {
    return { success: false as const, error: "No autorizado" } as const;
  }

  const parsed = platformListSchema.parse(raw);
  const status = parsed.status && parsed.status !== "ALL" ? parsed.status : undefined;
  const priority =
    parsed.priority && parsed.priority !== "ALL" ? parsed.priority : undefined;
  const assignedToId =
    parsed.assigned === "ME"
      ? user.id
      : parsed.assigned === "UNASSIGNED"
        ? null
        : undefined;

  const tickets = await listPlatformSupportTickets({
    status: status as any,
    priority: priority as any,
    unresolvedOnly: parsed.unresolvedOnly,
    tenantId: parsed.tenantId,
    assignedToId,
    search: parsed.search,
    limit: parsed.limit ?? 80,
  });

  return { success: true as const, tickets };
}

const platformDetailSchema = z.object({
  ticketId: z.string().min(1),
});

export async function getPlatformSupportTicketDetailAction(
  raw: z.infer<typeof platformDetailSchema>,
) {
  const user = await requireDbUser();
  if (!isSuperAdminOwner(user)) {
    return { success: false as const, error: "No autorizado" } as const;
  }
  const parsed = platformDetailSchema.parse(raw);
  const ticket = await getPlatformSupportTicketDetail(parsed.ticketId);
  if (!ticket) return { success: false as const, error: "Ticket no encontrado" } as const;
  return { success: true as const, ticket };
}

const platformAssignSchema = z.object({
  ticketId: z.string().min(1),
  reason: z.string().max(300).optional(),
});

export async function assignPlatformSupportTicketAction(
  raw: z.infer<typeof platformAssignSchema>,
) {
  const user = await requireDbUser();
  if (!isSuperAdminOwner(user)) {
    return { success: false as const, error: "No autorizado" } as const;
  }
  const parsed = platformAssignSchema.parse(raw);
  await assignPlatformSupportTicket({
    platformUser: user,
    ticketId: parsed.ticketId,
    reason: parsed.reason,
  });
  revalidatePath("/owner-dashboard/support");
  return { success: true as const };
}

const platformReplySchema = z.object({
  ticketId: z.string().min(1),
  body: z.string().min(1).max(8000),
  status: z
    .enum(["OPEN", "IN_PROGRESS", "WAITING_CLIENT", "RESOLVED", "CLOSED", "ESCALATED"])
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
    nextStatus: parsed.status ?? "IN_PROGRESS",
  });

  revalidatePath("/owner-dashboard/support");
  return { success: true as const };
}
