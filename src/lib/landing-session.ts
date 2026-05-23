import { APP_DEMO_CTA, APP_LOGIN_CTA, APP_SIGN_IN_PATH } from "@/lib/constants";

export type LandingSession = {
  signedIn: boolean;
  needsTrialSetup: boolean;
};

export const EMPTY_LANDING_SESSION: LandingSession = {
  signedIn: false,
  needsTrialSetup: false,
};

export function getLandingPrimaryCta(session: LandingSession): {
  href: string;
  label: string;
} {
  if (!session.signedIn) {
    return { href: "/sign-up", label: APP_DEMO_CTA };
  }
  if (session.needsTrialSetup) {
    return { href: "/onboarding", label: "Comenzar prueba gratis" };
  }
  return { href: "/panel", label: "Ir al panel" };
}

export function getLandingSecondaryCta(session: LandingSession): {
  href: string;
  label: string;
} | null {
  if (!session.signedIn) {
    return { href: APP_SIGN_IN_PATH, label: APP_LOGIN_CTA };
  }
  if (session.needsTrialSetup) {
    return { href: "/panel", label: "Explorar panel" };
  }
  return null;
}
