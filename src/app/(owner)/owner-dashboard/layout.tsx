import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OwnerShellHeader } from "@/components/owner/owner-shell-header";
import { requireDbUser } from "@/lib/auth";
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

  return (
    <div className="min-h-dvh bg-pragma-soft-gray text-foreground">
      <OwnerShellHeader
        user={{
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          imageUrl: user.imageUrl,
        }}
        hasOwnOrganization={Boolean(user.organizationId)}
        context="platform"
      />
      {children}
    </div>
  );
}
