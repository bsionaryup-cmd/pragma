import type { UserRole } from "@prisma/client";

export type AppUserRole = UserRole;

export type ClerkUserPayload = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
};

export type SessionUser = ClerkUserPayload;

export type AuthContext = {
  dbUserId: string;
  clerkId: string;
  email: string;
  role: AppUserRole;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
};
