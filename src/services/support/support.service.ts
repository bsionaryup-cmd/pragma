import "server-only";

import type {
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from "@prisma/client";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { requireTenantContext } from "@/lib/platform/tenant-context";
import { isSuperAdminOwner } from "@/lib/platform/platform-owner";
import type { User } from "@prisma/client";
import { assertSuperAdminOwner } from "@/lib/platform/platform-owner";
import { writePlatformAuditLog } from "@/services/platform/platform-audit.service";

export type SupportClientError = {
  message: string;
  stack?: string;
  at: string;
  route?: string;
};

export type SupportAutoContext = {
  tenantId: string | null;
  route: string | null;
  userRole: string;
  propertyId?: string | null;
  reservationId?: string | null;
  userAgent?: string | null;
  deviceLabel?: string | null;
  browser?: Record<string, string | null> | null;
  recentClientErrors?: SupportClientError[];
  screenshotPreview?: string | null;
  capturedAt: string;
};

export async function captureSupportAutoContext(input?: {
  propertyId?: string | null;
  reservationId?: string | null;
}): Promise<SupportAutoContext> {
  const ctx = await requireTenantContext();
  const headerStore = await headers();
  const userAgent = headerStore.get("user-agent");
  const route =
    headerStore.get("x-pathname") ??
    headerStore.get("x-invoke-path") ??
    headerStore.get("next-url") ??
    null;

  return {
    tenantId: ctx.organizationId,
    route,
    userRole: ctx.effectiveRole,
    propertyId: input?.propertyId ?? null,
    reservationId: input?.reservationId ?? null,
    userAgent,
    deviceLabel: userAgent?.includes("Mobile") ? "Mobile" : "Desktop",
    capturedAt: new Date().toISOString(),
  };
}

export async function createSupportTicket(input: {
  subject: string;
  body: string;
  category: SupportTicketCategory;
  priority?: SupportTicketPriority;
  propertyId?: string | null;
  reservationId?: string | null;
  screenshotUrl?: string | null;
  routeContext?: string | null;
  clientErrors?: SupportClientError[];
  browser?: Record<string, string | null> | null;
  screenshotPreview?: string | null;
  userId: string;
}) {
  const ctx = await requireTenantContext();
  const baseContext = await captureSupportAutoContext({
    propertyId: input.propertyId,
    reservationId: input.reservationId,
  });
  const autoContext: SupportAutoContext = {
    ...baseContext,
    route: input.routeContext ?? baseContext.route,
    recentClientErrors: input.clientErrors?.slice(-8),
    browser: input.browser ?? null,
    screenshotPreview: input.screenshotPreview?.slice(0, 120_000) ?? null,
  };

  const ticket = await db.supportTicket.create({
    data: {
      organizationId: ctx.organizationId,
      createdById: input.userId,
      subject: input.subject.trim(),
      category: input.category,
      priority: input.priority ?? "NORMAL",
      routeContext: input.routeContext ?? autoContext.route,
      propertyId: input.propertyId ?? null,
      reservationId: input.reservationId ?? null,
      autoContext,
      screenshotUrl: input.screenshotUrl ?? null,
      messages: {
        create: {
          authorId: input.userId,
          authorKind: "tenant",
          body: input.body.trim(),
        },
      },
    },
    include: {
      messages: { orderBy: { createdAt: "asc" }, take: 5 },
    },
  });

  return ticket;
}

export async function listMySupportTickets(userId: string) {
  return db.supportTicket.findMany({
    where: { createdById: userId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      subject: true,
      status: true,
      priority: true,
      category: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function listTenantSupportTickets(options?: {
  organizationId?: string | null;
  limit?: number;
}) {
  const ctx = await requireTenantContext();
  const organizationId = options?.organizationId ?? ctx.organizationId;
  if (!organizationId) return [];

  const limit = Math.min(options?.limit ?? 30, 100);
  return db.supportTicket.findMany({
    where: { organizationId },
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      createdBy: { select: { email: true, role: true } },
      assignedTo: { select: { email: true } },
    },
  });
}

export async function getTenantSupportTicketDetail(ticketId: string) {
  const ctx = await requireTenantContext();
  if (!ctx.organizationId) return null;
  return db.supportTicket.findFirst({
    where: { id: ticketId, organizationId: ctx.organizationId },
    include: {
      messages: { orderBy: { createdAt: "asc" }, take: 200 },
      createdBy: { select: { email: true, role: true } },
      assignedTo: { select: { email: true } },
    },
  });
}

export async function listPlatformSupportTickets(options?: {
  status?: SupportTicketStatus;
  priority?: SupportTicketPriority;
  tenantId?: string;
  assignedToId?: string | null;
  unresolvedOnly?: boolean;
  search?: string;
  limit?: number;
}) {
  const limit = Math.min(options?.limit ?? 50, 100);
  const search = options?.search?.trim();
  const unresolvedStatuses: SupportTicketStatus[] = [
    "OPEN",
    "IN_PROGRESS",
    "WAITING_CLIENT",
    "ESCALATED",
  ];
  return db.supportTicket.findMany({
    where: {
      ...(options?.status ? { status: options.status } : {}),
      ...(options?.priority ? { priority: options.priority } : {}),
      ...(options?.tenantId ? { organizationId: options.tenantId } : {}),
      ...(options?.assignedToId === null ? { assignedToId: null } : {}),
      ...(options?.assignedToId ? { assignedToId: options.assignedToId } : {}),
      ...(options?.unresolvedOnly ? { status: { in: unresolvedStatuses } } : {}),
      ...(search
        ? {
            OR: [
              { subject: { contains: search, mode: "insensitive" } },
              { id: { contains: search, mode: "insensitive" } },
              { createdBy: { email: { contains: search, mode: "insensitive" } } },
              { organization: { name: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: {
      assignedTo: {
        select: { id: true, email: true },
      },
      createdBy: {
        select: { email: true, role: true, organizationId: true },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 2,
      },
      organization: { select: { id: true, name: true } },
    },
  });
}

export async function getPlatformSupportTicketDetail(ticketId: string) {
  return db.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      assignedTo: { select: { id: true, email: true } },
      createdBy: {
        select: {
          id: true,
          email: true,
          role: true,
          organizationId: true,
        },
      },
      organization: { select: { id: true, name: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        take: 200,
      },
    },
  });
}

export async function assignPlatformSupportTicket(input: {
  platformUser: User;
  ticketId: string;
  reason?: string;
}) {
  assertSuperAdminOwner(input.platformUser);

  const ticket = await db.supportTicket.findUnique({
    where: { id: input.ticketId },
    select: { id: true, assignedToId: true, status: true, organizationId: true },
  });
  if (!ticket) throw new Error("Ticket no encontrado");

  const nextStatus =
    ticket.status === "OPEN" ? ("IN_PROGRESS" as const) : ticket.status;

  await db.supportTicket.update({
    where: { id: input.ticketId },
    data: {
      assignedToId: input.platformUser.id,
      status: nextStatus,
    },
  });

  await writePlatformAuditLog({
    platformUserId: input.platformUser.id,
    ownerEmail: input.platformUser.email,
    action: "support_assign",
    targetTenantId: ticket.organizationId ?? null,
    previousState: { assignedToId: ticket.assignedToId, status: ticket.status },
    newState: { assignedToId: input.platformUser.id, status: nextStatus },
    metadata: { reason: input.reason ?? "owner_ops" },
  });
}

export async function replyToSupportTicket(input: {
  ticketId: string;
  body: string;
  authorId: string;
  authorKind: "tenant" | "platform";
  isInternal?: boolean;
  nextStatus?: SupportTicketStatus;
}) {
  const ticket = await db.supportTicket.findUnique({
    where: { id: input.ticketId },
    select: { id: true, status: true, assignedToId: true, organizationId: true },
  });
  if (!ticket) throw new Error("Ticket no encontrado");

  const [message] = await db.$transaction([
    db.supportMessage.create({
      data: {
        ticketId: input.ticketId,
        authorId: input.authorId,
        authorKind: input.authorKind,
        body: input.body.trim(),
        isInternal: input.isInternal ?? false,
      },
    }),
    db.supportTicket.update({
      where: { id: input.ticketId },
      data: {
        status: input.nextStatus ?? ticket.status,
        updatedAt: new Date(),
        resolvedAt:
          input.nextStatus === "RESOLVED" || input.nextStatus === "CLOSED"
            ? new Date()
            : undefined,
      },
    }),
  ]);

  if (input.authorKind === "platform") {
    const actor = await db.user.findUnique({
      where: { id: input.authorId },
      select: { id: true, email: true, platformRole: true },
    });
    if (actor) {
      await writePlatformAuditLog({
        platformUserId: actor.id,
        ownerEmail: actor.email,
        action: "support_reply",
        targetTenantId: ticket.organizationId ?? null,
        previousState: { status: ticket.status, assignedToId: ticket.assignedToId },
        newState: { status: input.nextStatus ?? ticket.status },
        metadata: { internal: Boolean(input.isInternal) },
      });
    }
  }

  return message;
}

export function canAccessPlatformSupportConsole(user: User): boolean {
  return isSuperAdminOwner(user);
}
