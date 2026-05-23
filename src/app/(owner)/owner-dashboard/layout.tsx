import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireDbUser } from "@/lib/auth";
import { getRoleScreenDefinition } from "@/lib/auth/role-definitions.server";
import { isSuperAdminOwner } from "@/lib/platform/platform-owner";
import { OWNER_LOGIN_PATH } from "@/lib/platform/constants";

export const metadata: Metadata = {
  title: "Owner Dashboard | PRAGMA",
  robots: { index: false, follow: false },
};

export default async function OwnerDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireDbUser();
  if (!isSuperAdminOwner(user)) {
    redirect(`${OWNER_LOGIN_PATH}?error=forbidden`);
  }

  const roleDef = getRoleScreenDefinition(user);

  return (
    <div className="min-h-dvh bg-pragma-soft-gray text-foreground">
      <div className="border-b border-border bg-card px-4 py-2 text-center text-xs text-muted-foreground sm:px-6">
        {roleDef.label} — {roleDef.description}
      </div>
      {children}
    </div>
  );
}
