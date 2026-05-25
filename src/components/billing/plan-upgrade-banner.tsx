import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  getCommercialPlanLabel,
  getRequiredPlanForFeature,
  type PlanFeature,
} from "@/lib/billing/plan-entitlements";
import { Button } from "@/components/ui/button";

type PlanUpgradeBannerProps = {
  feature: PlanFeature;
  title?: string;
};

export function PlanUpgradeBanner({ feature, title }: PlanUpgradeBannerProps) {
  const required = getRequiredPlanForFeature(feature);
  const planLabel = getCommercialPlanLabel(required);

  return (
    <div className="rounded-xl border border-pragma-cyan/30 bg-pragma-light-blue/20 p-6">
      <p className="text-sm font-semibold text-foreground">
        {title ?? `Disponible en plan ${planLabel}`}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Tu suscripción actual no incluye este módulo. Mejora a {planLabel} o superior
        para desbloquearlo sin perder tus datos.
      </p>
      <Button asChild className="mt-4 bg-pragma-electric hover:bg-pragma-electric/90">
        <Link href="/settings/billing">
          Ver planes y actualizar
          <ArrowUpRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}
