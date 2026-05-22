import Link from "next/link";
import { Sparkles } from "lucide-react";
import { SUBSCRIPTION_TRIAL_LABEL } from "@/lib/constants";
import { Button } from "@/components/ui/button";

type TrialBannerProps = {
  trialEndsAt: string | null;
  isAdmin: boolean;
};

export function TrialBanner({ trialEndsAt, isAdmin }: TrialBannerProps) {
  const endLabel = trialEndsAt
    ? new Date(trialEndsAt).toLocaleDateString("es-CO", { dateStyle: "medium" })
    : null;

  return (
    <div className="border-b border-pragma-cyan/20 bg-pragma-light-blue/50 px-4 py-2.5">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-center gap-3 text-center text-sm">
        <Sparkles className="hidden h-4 w-4 text-pragma-electric sm:block" />
        <p>
          <span className="font-medium">{SUBSCRIPTION_TRIAL_LABEL}</span>
          {endLabel ? <span className="text-muted-foreground"> · hasta {endLabel}</span> : null}
        </p>
        {isAdmin ? (
          <Button size="sm" variant="outline" className="h-8" asChild>
            <Link href="/settings/billing">Activar suscripción</Link>
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            Contacta al administrador para activar la suscripción.
          </p>
        )}
      </div>
    </div>
  );
}
