import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/features/onboarding/components/onboarding-wizard";
import { getUserDisplayName } from "@/lib/helpers/user-display";
import { requireDbUser, requirePermission } from "@/lib/auth";
import { resolvePostAuthHomePath } from "@/lib/auth/role-definitions.server";
import { isSuperAdminOwner } from "@/lib/platform/platform-owner";
import { userNeedsOnboarding } from "@/services/onboarding/onboarding.service";

export default async function OnboardingPage() {
  await requirePermission("billing:manage");
  const user = await requireDbUser();

  if (isSuperAdminOwner(user)) {
    redirect("/owner-dashboard");
  }

  if (!userNeedsOnboarding(user)) {
    redirect(resolvePostAuthHomePath(user));
  }

  return (
    <OnboardingWizard
      displayName={getUserDisplayName(user.firstName, user.lastName, user.email)}
      email={user.email}
    />
  );
}
