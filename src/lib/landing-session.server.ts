import { auth } from "@clerk/nextjs/server";
import { currentDbUser } from "@/lib/auth";
import {
  EMPTY_LANDING_SESSION,
  type LandingSession,
} from "@/lib/landing-session";
import { userNeedsOnboarding } from "@/services/onboarding/onboarding.service";

export async function getLandingSession(): Promise<LandingSession> {
  const { userId } = await auth();
  if (!userId) return EMPTY_LANDING_SESSION;

  const user = await currentDbUser();
  return {
    signedIn: true,
    needsTrialSetup: user ? userNeedsOnboarding(user) : false,
  };
}
