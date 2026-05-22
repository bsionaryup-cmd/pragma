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
    return { href: "/sign-up", label: "Prueba gratis 14 días" };
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
    return { href: "/sign-in", label: "Iniciar sesión" };
  }
  if (session.needsTrialSetup) {
    return { href: "/panel", label: "Explorar panel" };
  }
  return null;
}
