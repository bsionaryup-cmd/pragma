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

export async function listPlatformSupportTickets(options?: {
  status?: SupportTicketStatus;
  limit?: number;
}) {
  const limit = Math.min(options?.limit ?? 50, 100);
  return db.supportTicket.findMany({
    where: options?.status ? { status: options.status } : undefined,
    orderBy: { updatedAt: "desc" },
    take: limit,
    include: {
      createdBy: {
        select: { email: true, role: true, organizationId: true },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      organization: { select: { id: true, name: true } },
    },
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
        status: input.nextStatus,
        updatedAt: new Date(),
        resolvedAt:
          input.nextStatus === "RESOLVED" || input.nextStatus === "CLOSED"
            ? new Date()
            : undefined,
      },
    }),
  ]);

  return message;
}

export function canAccessPlatformSupportConsole(user: User): boolean {
  return isSuperAdminOwner(user);
}
