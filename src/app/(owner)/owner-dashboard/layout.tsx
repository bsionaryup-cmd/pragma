import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireDbUser } from "@/lib/auth";
import { isSuperAdminOwner } from "@/lib/platform/platform-owner";

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
    redirect("/unauthorized");
  }

  return (
    <div className="min-h-dvh bg-pragma-soft-gray text-foreground">{children}</div>
  );
}
