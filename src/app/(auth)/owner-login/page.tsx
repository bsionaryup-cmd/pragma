import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { PragmaAuthLayout } from "@/components/auth/pragma-auth-layout";
import { OwnerLoginForm } from "@/components/owner/owner-login-form";
import { OwnerWrongSession } from "@/components/owner/owner-wrong-session";
import { currentDbUser } from "@/lib/auth";
import { OWNER_DASHBOARD_PATH } from "@/lib/platform/constants";
import { isSuperAdminOwner } from "@/lib/platform/platform-owner";

export const metadata: Metadata = {
  title: "Owner Login | PRAGMA",
  robots: { index: false, follow: false },
};

type OwnerLoginPageProps = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

export default async function OwnerLoginPage({ searchParams }: OwnerLoginPageProps) {
  const params = await searchParams;
  const { userId } = await auth();

  if (userId) {
    const user = await currentDbUser();
    if (user && isSuperAdminOwner(user)) {
      const next = params.next?.startsWith("/") ? params.next : OWNER_DASHBOARD_PATH;
      redirect(next);
    }

    if (user) {
      return (
        <PragmaAuthLayout
          hint={
            params.error === "forbidden" ? (
              <p className="mb-4 text-center text-sm text-destructive">
                No tienes permisos de Super Admin Owner.
              </p>
            ) : null
          }
        >
          <OwnerWrongSession email={user.email} />
        </PragmaAuthLayout>
      );
    }
  }

  return (
    <PragmaAuthLayout>
      <Suspense fallback={<div className="py-8 text-center text-sm text-muted-foreground">Cargando…</div>}>
        <OwnerLoginForm />
      </Suspense>
    </PragmaAuthLayout>
  );
}
