import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SUBSCRIPTION_TRIAL_LABEL } from "@/lib/constants";

export function StartTrialBanner() {
  return (
    <div className="border-b border-pragma-cyan/30 bg-gradient-to-r from-pragma-light-blue/80 to-white px-4 py-3">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-center gap-3 text-center text-sm sm:justify-between sm:text-left">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0 text-pragma-electric" />
          <p>
            <span className="font-medium">Activa tu {SUBSCRIPTION_TRIAL_LABEL.toLowerCase()}</span>
            <span className="text-muted-foreground">
              {" "}
              · configura tu operación y usa PRAGMA con tus propiedades
            </span>
          </p>
        </div>
        <Button size="sm" className="h-8" asChild>
          <Link href="/onboarding">Comenzar prueba</Link>
        </Button>
      </div>
    </div>
  );
}
