import Link from "next/link";
import { Sparkles } from "lucide-react";
import { SUBSCRIPTION_TRIAL_LABEL } from "@/lib/constants";
import { computeTrialDaysRemaining } from "@/lib/billing/trial-days-remaining";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TrialBannerProps = {
  trialEndsAt: string | null;
  isAdmin: boolean;
};

function trialBannerCopy(trialEndsAt: string | null): string {
  const days = computeTrialDaysRemaining(trialEndsAt);
  if (days <= 0) return SUBSCRIPTION_TRIAL_LABEL;
  if (days === 1) return "Te queda 1 día de prueba gratis";
  return `Te quedan ${days} días de prueba gratis`;
}

export function TrialBanner({ trialEndsAt, isAdmin }: TrialBannerProps) {
  const daysRemaining = computeTrialDaysRemaining(trialEndsAt);
  const urgent = daysRemaining > 0 && daysRemaining <= 3;
  const endLabel = trialEndsAt
    ? new Date(trialEndsAt).toLocaleDateString("es-CO", { dateStyle: "medium" })
    : null;

  return (
    <div
      className={cn(
        "border-b px-4 py-2.5",
        urgent
          ? "border-red-300/80 bg-red-50 text-red-950 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100"
          : "border-pragma-cyan/20 bg-pragma-light-blue/50",
      )}
    >
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-center gap-3 text-center text-sm">
        <Sparkles
          className={cn(
            "hidden h-4 w-4 sm:block",
            urgent ? "text-red-600 dark:text-red-400" : "text-pragma-electric",
          )}
        />
        <p>
          <span className={cn("font-medium", urgent && "text-red-700 dark:text-red-300")}>
            {trialBannerCopy(trialEndsAt)}
          </span>
          {endLabel ? (
            <span className={cn(urgent ? "text-red-800/90" : "text-muted-foreground")}>
              {" "}
              · vence {endLabel}
            </span>
          ) : null}
        </p>
        {isAdmin ? (
          <Button
            size="sm"
            variant={urgent ? "destructive" : "outline"}
            className="h-8"
            asChild
          >
            <Link href="/settings/billing">Activar suscripción</Link>
          </Button>
        ) : (
          <p className={cn("text-xs", urgent ? "text-red-800/80" : "text-muted-foreground")}>
            Contacta al administrador para activar la suscripción.
          </p>
        )}
      </div>
    </div>
  );
}
