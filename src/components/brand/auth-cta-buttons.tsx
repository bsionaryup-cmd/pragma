"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, LogIn, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  APP_DEMO_CTA,
  APP_LOGIN_CTA,
  APP_SIGN_IN_PATH,
  SUBSCRIPTION_TRIAL_LABEL,
} from "@/lib/constants";
import {
  getLandingPrimaryCta,
  type LandingSession,
} from "@/lib/landing-session";

type CtaSize = "sm" | "md" | "lg";

const sizeStyles: Record<CtaSize, { trial: string; login: string }> = {
  sm: {
    trial: "h-9 gap-1.5 px-4 text-sm",
    login: "h-9 px-3.5 text-sm",
  },
  md: {
    trial: "h-11 gap-2 px-5 text-[15px]",
    login: "h-11 px-5 text-[15px]",
  },
  lg: {
    trial: "h-12 gap-2 px-7 text-base",
    login: "h-12 px-7 text-base",
  },
};

type FreeTrialButtonProps = {
  href?: string;
  label?: string;
  size?: CtaSize;
  className?: string;
  showBadge?: boolean;
};

/** CTA principal — gradiente de marca, alto contraste, invita al clic. */
export function FreeTrialButton({
  href = "/sign-up",
  label = APP_DEMO_CTA,
  size = "md",
  className,
  showBadge = true,
}: FreeTrialButtonProps) {
  return (
    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
      <Link
        href={href}
        className={cn(
          "group relative inline-flex items-center justify-center overflow-hidden rounded-xl font-semibold text-white shadow-[0_4px_24px_-4px_rgba(0,102,255,0.55)] transition-shadow duration-300 hover:shadow-[0_8px_32px_-4px_rgba(0,245,160,0.45)]",
          "bg-gradient-to-r from-pragma-electric via-[#0088ff] to-[#00c9a7]",
          sizeStyles[size].trial,
          className,
        )}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        />
        <Sparkles
          className="relative h-4 w-4 shrink-0 text-pragma-cyan drop-shadow-sm"
          strokeWidth={2.25}
        />
        <span className="relative">{label}</span>
        {showBadge ? (
          <span className="trial-badge relative rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide backdrop-blur-sm">
            7 días
          </span>
        ) : null}
        <ArrowRight
          className="relative h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
          strokeWidth={2.25}
        />
      </Link>
    </motion.div>
  );
}

type LogInButtonProps = {
  href?: string;
  label?: string;
  size?: CtaSize;
  className?: string;
};

/** CTA secundario — acceso para cuentas existentes. */
export function LogInButton({
  href = APP_SIGN_IN_PATH,
  label = APP_LOGIN_CTA,
  size = "md",
  className,
}: LogInButtonProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl border border-pragma-border bg-white font-medium text-pragma-black shadow-pragma-soft transition-all duration-200",
        "hover:border-pragma-electric/40 hover:bg-pragma-light-blue/60 hover:text-pragma-electric",
        sizeStyles[size].login,
        className,
      )}
    >
      <LogIn className="h-4 w-4 shrink-0 opacity-80" strokeWidth={2} />
      {label}
    </Link>
  );
}

type AuthCtaPairProps = {
  session?: LandingSession;
  size?: CtaSize;
  className?: string;
  layout?: "row" | "column";
};

/** Par de CTAs alineado con el estado de sesión (landing / marketing). */
export function AuthCtaPair({
  session = { signedIn: false, needsTrialSetup: false },
  size = "md",
  className,
  layout = "row",
}: AuthCtaPairProps) {
  const primary = getLandingPrimaryCta(session);
  const isRow = layout === "row";

  const loginButton = <LogInButton size={size} />;

  const trialButton = (
    <FreeTrialButton
      href={primary.href}
      label={primary.label}
      size={size}
      showBadge={!session.signedIn || session.needsTrialSetup}
    />
  );

  return (
    <div
      className={cn(
        "flex gap-2 sm:gap-3",
        isRow ? "flex-row flex-wrap items-center" : "flex-col",
        className,
      )}
    >
      {isRow && loginButton ? (
        <>
          {loginButton}
          {trialButton}
        </>
      ) : (
        <>
          {trialButton}
          {loginButton}
        </>
      )}
    </div>
  );
}

type AuthPageCtaProps = {
  mode: "sign-in" | "sign-up";
};

/** CTAs debajo del formulario Clerk en páginas de auth. */
export function AuthPageCta({ mode }: AuthPageCtaProps) {
  if (mode === "sign-in") {
    return (
      <div className="mt-6 space-y-3 border-t border-border pt-6 text-center">
        <p className="text-sm text-muted-foreground">
          ¿Aún no tienes cuenta?{" "}
          <span className="font-medium text-foreground">{SUBSCRIPTION_TRIAL_LABEL}</span>
        </p>
        <div className="flex flex-col items-center gap-3">
          <FreeTrialButton size="md" className="w-full max-w-[280px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3 border-t border-border pt-6 text-center">
      <p className="text-sm text-muted-foreground">¿Ya tienes cuenta?</p>
      <div className="flex flex-col items-center gap-3">
        <LogInButton size="md" className="w-full max-w-[280px]" />
      </div>
    </div>
  );
}
