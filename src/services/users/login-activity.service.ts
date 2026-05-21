import type { LoginActivityStatus } from "@prisma/client";
import { db } from "@/lib/db";

function parseDeviceLabel(userAgent: string | null): string | null {
  if (!userAgent?.trim()) return null;
  const ua = userAgent;
  if (/Edg\//i.test(ua)) return "Microsoft Edge";
  if (/Chrome\//i.test(ua) && !/Edg/i.test(ua)) return "Chrome";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) return "Safari";
  return "Navegador";
}

export async function recordLoginActivity(input: {
  userId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  status?: LoginActivityStatus;
}) {
  const userAgent = input.userAgent?.trim() || null;
  await db.loginActivity.create({
    data: {
      userId: input.userId,
      ipAddress: input.ipAddress?.trim() || null,
      userAgent,
      deviceLabel: parseDeviceLabel(userAgent),
      status: input.status ?? "SUCCESS",
    },
  });
}

export async function listLoginActivitiesForUser(userId: string, limit = 50) {
  return db.loginActivity.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function listRecentLoginActivities(limit = 100) {
  return db.loginActivity.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      },
    },
  });
}
